import asyncio
import json
import os
import shutil
import signal
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Annotated

from jinja2 import Environment as JinjaEnvironment
from sqlmodel import Session, select
from taskiq import TaskiqDepends

from app import sandbox
from app.api.deps import get_db
from app.conda import CondaEnvManger, CondaEnvMangerError
from app.core.app_settings import get_or_create_app_settings
from app.core.config import settings
from app.core.db import engine
from app.crud import save_file
from app.metrics import read_tree
from app.models import File, Run, RunStatus, SetupFile, Target, Tool, ToolStatus
from app.scheduling import dispatch_pending_runs
from app.tkq import broker
from app.utils import (
    escape,
    generate_run_finished_email,
    input_file_name,
    send_email,
)
from app.wsmanager import manager

SessionDep = Annotated[Session, TaskiqDepends(get_db)]

WORK_SUBDIR = "work"
INPUTS_SUBDIR = "inputs"
TMP_SUBDIR = "tmp"


@dataclass(frozen=True)
class RunDirs:
    """Directories backing a single run."""

    work: Path
    """Working directory of the tool, bind mounted read-write at /work."""

    inputs: Path
    """Read-only bind mount targets for the run's input files."""

    tmp: Path
    """Scratch directory of the tool, bind mounted read-write at /tmp."""


async def run_command_in_subprocess(
    session: Session, run_id: uuid.UUID, argv: list[str], work_dir: Path
) -> tuple[int, str]:
    """
    Run a command in an asynchronous subprocess, capture its stdout in real time,
    and update logs to the DB as output is generated.

    Args:
        session (Session): Database session.
        run_id (uuid.UUID): Unique ID of the run.
        argv (list[str]): The command to execute, as an argument vector.
        work_dir (Path): Working directory for the subprocess.

    Returns:
        Tuple[int, str]: (Exit code, full concatenated stdout output)
    """
    print(f"Preparing to execute command safely for Run(id={run_id})")

    # Start the subprocess with stdout piped.
    process = await asyncio.create_subprocess_exec(
        *argv,
        cwd=work_dir,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        start_new_session=True,  # Prevents orphaned subprocesses
    )

    print(f"Run(id={run_id}) started with PID: {process.pid}")
    log_lines = []  # Buffer to store logs in memory

    async def read_stdout():
        run = session.execute(select(Run).where(Run.id == run_id)).scalar_one()
        # Read output line by line as it becomes available.
        while True:
            line = await process.stdout.readline()
            if not line:
                break  # EOF reached
            decoded_line = line.decode().rstrip()
            print(decoded_line)
            log_lines.append(decoded_line)

            # Update the DB immediately
            try:
                # For immediate update
                session.refresh(run)
                run.stdout += decoded_line + "\n"
                session.add(run)
                session.commit()
                await manager.broadcast(
                    json.dumps(
                        {
                            "log": decoded_line,
                        }
                    ),
                    str(run_id),
                )
            except Exception as e:
                print(f"DB update error for Run(id={run_id}): {e}")

    async def monitor_cancellation():
        # Periodically check if the run status has been changed to 'cancelled'
        while process.returncode is None:
            run = session.execute(select(Run).where(Run.id == run_id)).scalar_one()
            session.refresh(run)
            if run.status == "cancelled":
                print(f"Run(id={run_id}) was cancelled. Terminating process group.")
                os.killpg(process.pid, signal.SIGTERM)
                # Give the process a moment to clean up
                await asyncio.sleep(3)
                if process.returncode is None:
                    print(f"Run(id={run_id}) did not terminate; sending SIGKILL.")
                    os.killpg(process.pid, signal.SIGKILL)
                break
            await asyncio.sleep(1)

    async def sample_metrics():
        """Record what the command's process tree is using, until it finishes."""
        interval = settings.RUN_METRICS_INTERVAL
        if interval <= 0:
            return

        started = time.monotonic()
        seen: dict[int, float] = {}
        samples: list[dict] = []
        last = started

        while process.returncode is None:
            await asyncio.sleep(interval)
            if process.returncode is not None:
                break
            now = time.monotonic()
            elapsed = now - last
            if elapsed <= 0:
                continue
            last = now

            reading = await asyncio.to_thread(read_tree, process.pid, seen)
            if reading is None:
                continue

            samples.append(
                {
                    "t": round(now - started, 1),
                    "cpu": round(reading.cpu_seconds / elapsed * 100, 1),
                    "rss": reading.rss_bytes,
                    "procs": reading.processes,
                    "threads": reading.threads,
                    "read": reading.read_bytes,
                    "write": reading.write_bytes,
                }
            )
            if len(samples) >= settings.RUN_METRICS_MAX_SAMPLES:
                # Keep the shape of a long run without growing the row forever.
                del samples[1::2]

            # Its own session: the run's own is busy streaming logs.
            with Session(engine) as metrics_session:
                metrics_run = metrics_session.get(Run, run_id)
                if metrics_run is not None:
                    metrics_run.metrics = list(samples)
                    metrics_session.add(metrics_run)
                    metrics_session.commit()

    # Read the logs, watch for cancellation, and profile the run together.
    await asyncio.gather(read_stdout(), monitor_cancellation(), sample_metrics())

    # Wait for the process to finish
    await process.wait()
    return_code = process.returncode

    # Optionally, if you want to have the full log output as one string:
    full_log_output = "\n".join(log_lines)

    return return_code, full_log_output


def update_run(session: Session, run: Run, status: RunStatus, message=None):
    """Update the run status and optionally add a message, then commit."""
    print(f"Setting RunStatus Run(id={run.id}): {status}")
    run.status = str(status.value)
    if message:
        print(f"Adding message to Run(id={run.id}): {message}")
        run.stdout += "\n" + message
    if run.email_on_completion and settings.emails_enabled and run.owner.email:
        print(f"Sending email for Run(id={run.id})")
        name = run.tool.name
        if run.name:
            name = f"{name} ({run.name})"
        email_data = generate_run_finished_email(run.tool.name, str(run.id), status)
        send_email(
            email_to=run.owner.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    session.add(run)
    session.commit()
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(
        manager.broadcast(
            json.dumps({"stdout": run.stdout, "status": run.status}),
            str(run.id),
        )
    )


@contextmanager
def create_tmp_dir(run_id: uuid.UUID) -> Iterator[RunDirs]:
    """Context manager to create and clean up the directories of a run."""
    tmp_dir = Path(settings.TMP_PATH) / str(run_id)
    dirs = RunDirs(
        work=tmp_dir / WORK_SUBDIR,
        inputs=tmp_dir / INPUTS_SUBDIR,
        tmp=tmp_dir / TMP_SUBDIR,
    )
    try:
        for directory in (dirs.work, dirs.inputs, dirs.tmp):
            directory.mkdir(parents=True, exist_ok=False)
        yield dirs
    finally:
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir)


def link_input_files(session, run, dirs: RunDirs) -> dict[str, Path] | None:
    """Expose the run's input files in the working directory of the tool.

    Returns the mapping of the file name the tool sees to its storage location,
    or None if the run has to be marked as failed.
    """
    input_files: dict[str, Path] = {}
    if not run.input_file_ids:
        return input_files
    try:
        for file_id in run.input_file_ids:
            file = session.get(File, file_id)
            location = Path(file.location)
            # The tool sees the file's own name, not the id-prefixed one it is
            # stored under.
            file_name = input_file_name(file.name)
            if file_name in input_files:
                # The same file can be given to two parameters.
                continue
            print(f"Linking {location} to {dirs.work / file_name}")
            if settings.SANDBOX_ENABLED:
                # The sandbox mounts the file read-only on top of this
                # placeholder, and the working directory links to it so that
                # the tool finds the file name it was given in its command.
                (dirs.inputs / file_name).touch()
                os.symlink(
                    f"{sandbox.CONTAINER_INPUTS_DIR}/{file_name}", dirs.work / file_name
                )
            else:
                os.symlink(location, dirs.work / file_name)
            input_files[file_name] = location
        return input_files
    except Exception as e:
        print(f"Error linking input files: {e}")
        update_run(session, run, RunStatus.failed, "Error linking input files!")
        return None


def write_setup_files(session, run, work_dir):
    """Render and write setup files to the working directory."""
    env = JinjaEnvironment()
    if run.tool.setup_files:
        for setup_file_data in run.tool.setup_files:
            setup_file = SetupFile(**setup_file_data)
            file_path = work_dir / setup_file.name
            if file_path.exists():
                print(f"File '{file_path}' already exists")
                update_run(
                    session,
                    run,
                    RunStatus.failed,
                    "Tool setup failed. Please contact an administrator.",
                )
                return False
            with open(file_path, "w") as f:
                template = env.from_string(setup_file.content)
                content = template.render(**run.params)
                print(f"Writing content to {file_path}\n{content}")
                f.write(content)
    return True


def tool_conda_prefix(run) -> Path | None:
    """Path of the tool's conda environment, if the tool has one."""
    if not run.tool.conda_env:
        return None
    return Path(settings.CONDA_PATH) / str(run.tool_id)


def setup_conda_env(session, run, run_command, conda_prefix: Path | None):
    """Prepare the conda environment if required, and update the command accordingly."""
    if conda_prefix is None:
        return run_command
    if not conda_prefix.exists():
        update_run(
            session,
            run,
            RunStatus.failed,
            "Tool environment not found. Please contact an administrator.",
        )
        run.tool.status = "uninstalled"
        return None
    # Prepend the conda activation command.
    return f"{sandbox.conda_activation(conda_prefix)} && {run_command}"


def sandbox_data_path() -> Path | None:
    """Reference data directory to expose to runs, if the worker has one."""
    path = Path(settings.SANDBOX_DATA_PATH)
    return path if path.is_dir() else None


def build_run_argv(
    *,
    command: str,
    conda_prefix: Path | None,
    dirs: RunDirs,
    input_files: dict[str, Path],
    cpus: int,
) -> list[str]:
    """Build the argv of the process that executes the command of a run."""
    shell_command = f"set -euo pipefail; {command}"
    if not settings.SANDBOX_ENABLED:
        return ["/bin/bash", "-c", shell_command]
    sandbox.check_sandbox_image(settings.SANDBOX_IMAGE)
    sandbox.check_sandbox_limits()
    sandbox.check_sandbox_network(settings.SANDBOX_NETWORK)
    return sandbox.sandbox_exec_command(
        image=settings.SANDBOX_IMAGE,
        work_dir=dirs.work,
        tmp_dir=dirs.tmp,
        inputs_dir=dirs.inputs,
        input_files=input_files,
        conda_prefix=conda_prefix,
        data_path=sandbox_data_path(),
        cpus=cpus,
        network=settings.SANDBOX_NETWORK,
        dns=settings.SANDBOX_DNS,
        command=shell_command,
    )


def handle_return_code(session, run, returncode):
    """Handle the subprocess return code and update the run accordingly."""
    if returncode != 0:
        # A container killed by a signal is reported as 128 + signal.
        if returncode in (-signal.SIGTERM, 128 + signal.SIGTERM):
            run.status = RunStatus.cancelled
        else:
            run.status = RunStatus.failed
        update_run(session, run, run.status)
        return False
    return True


def process_targets(session, run, work_dir):
    """Process target files: check their existence and save them."""
    env = JinjaEnvironment()
    missing_targets = []

    if run.tool.targets:
        for target_data in run.tool.targets:
            target = Target(**target_data)
            print(f"Formatting target path: {target.path}")

            # Render the template path with the same escaped values the
            # command was rendered with, so user input can't inject path parts
            template = env.from_string(target.path)
            escaped_params = {k: escape(v) for k, v in (run.params or {}).items()}
            rendered_path = template.render(**escaped_params)

            # Get matching file paths, ignoring anything that resolves outside
            # the working directory (e.g. `..` segments, or the symlinks to the
            # input files that the sandbox mounts read-only)
            work_root = work_dir.resolve()
            matched_files = []
            for match in work_dir.glob(rendered_path):
                if match.resolve().is_relative_to(work_root):
                    matched_files.append(match)
                else:
                    print(f"Skipping target outside run directory: {match}")

            if target.required and not matched_files:
                print(f"No files matched for required target pattern: {rendered_path}")
                run.stdout += f"\nNo files matched pattern '{rendered_path}'!"
                missing_targets.append(rendered_path)
                continue

            # Save all matched files
            for target_file in matched_files:
                print(f"Saving target file: {target_file}")
                with open(target_file, "rb") as tf:
                    file_obj = save_file(
                        session=session,
                        name=target_file.name,
                        file=tf,
                        owner_id=run.owner_id,
                        file_type=target.target_type,
                        saved=False,  # the file is not saved to the "my files" section
                        tags=run.tags,
                    )
                run.files.append(file_obj)

    if missing_targets:
        update_run(session, run, RunStatus.failed, "Missing required target(s)")
        return False

    return True


@broker.task
async def run_tool(
    run_id: uuid.UUID,
    run_command: str,
    session: Session = TaskiqDepends(get_db),
) -> bool:
    run: Run = session.get(Run, run_id)
    if run is None:
        return False

    # Clear previous stdout and check statuses.
    run.stdout = ""
    if run.status != "pending":
        return False
    app_settings = get_or_create_app_settings(session)
    if app_settings.queue_paused:
        run.taskiq_id = None
        session.add(run)
        session.commit()
        return False
    if run.tool.status != "installed":
        update_run(
            session,
            run,
            RunStatus.failed,
            "Tool must be installed first. Please contact an administrator.",
        )
        return False

    # Update run state to running.
    run.status = "running"
    run.started_at = datetime.utcnow()
    run.conda_env_pinned = run.tool.conda_env_pinned
    session.add(run)
    session.commit()

    try:
        with create_tmp_dir(run_id) as dirs:
            # Process input files.
            input_files = link_input_files(session, run, dirs)
            if input_files is None:
                return False

            # Write any required setup files.
            if not write_setup_files(session, run, dirs.work):
                return False

            # Set up the conda environment if necessary.
            conda_prefix = tool_conda_prefix(run)
            updated_command = setup_conda_env(session, run, run_command, conda_prefix)
            if updated_command is None:
                return False

            # Run the command in a subprocess.
            try:
                argv = build_run_argv(
                    command=updated_command,
                    conda_prefix=conda_prefix,
                    dirs=dirs,
                    input_files=input_files,
                    cpus=run.cpus,
                )
                returncode, stdout = await run_command_in_subprocess(
                    session, run_id, argv, dirs.work
                )
                print(f"Run(id={run_id}) finished with return code: {returncode}")
            except Exception as e:
                print(f"An error occurred: {e}")
                update_run(session, run, RunStatus.failed, f"An error occurred: {e}")
                return False

            run.finished_at = datetime.utcnow()
            run.stdout = stdout

            # Check the result of the subprocess.
            if not handle_return_code(session, run, returncode):
                return False

            # Process any target files.
            if not process_targets(session, run, dirs.work):
                return False

            # Mark the run as completed.
            update_run(session, run, RunStatus.completed)

        print(f"Run(id={run_id}) completed")
        return True

    except FileExistsError:
        update_run(session, run, RunStatus.failed, "Run directory already exists")
        return False
    except Exception as e:
        update_run(session, run, RunStatus.failed, f"An unexpected error occurred: {e}")
        return False
    finally:
        # The CPUs of this run are free again, so start what is waiting for them.
        try:
            await dispatch_pending_runs(session)
        except Exception as e:
            print(f"Error dispatching pending runs: {e}")


@broker.task
async def install_tool(
    tool_id: uuid.UUID,
    session: Session = TaskiqDepends(get_db),
) -> bool:
    tool = session.get(Tool, tool_id)
    if tool is None:
        print(f"Tool(id={tool_id}) not found")
        return False
    if tool.conda_env is None:
        print(f"Tool(id={tool_id}) does not have an environment")
        tool.status = ToolStatus.failed
        session.add(tool)
        session.commit()
        return False
    if tool.status != ToolStatus.install_queued:
        print(
            f"Tool(id={tool_id}) install task skipped because status is {tool.status}"
        )
        return False
    tool.status = ToolStatus.installing
    session.add(tool)
    session.commit()
    post_install_command = tool.post_install
    conda_env = CondaEnvManger(
        path=Path(settings.CONDA_PATH) / str(tool_id),
        env_dict=tool.conda_env,
        post_install_command=post_install_command,
        version=tool.version,
    )
    try:
        if conda_env.is_created:
            print(
                f"Conda environment for Tool(id={tool_id}) already exists. Removing before install."
            )
            shutil.rmtree(conda_env.path)
        print(f"Creating conda environment for Tool(id={tool_id})")
        stdout = await conda_env.create()
        conda_env_pinned = await conda_env.pin()
    except Exception as e:
        print(f"An error occurred will creating conda environment: {e}")
        tool.status = ToolStatus.failed
        tool.installation_log = str(e)
        session.add(tool)
        session.commit()
        raise e

    print(f"Conda environment for Tool(id={tool_id}) created")
    tool.status = ToolStatus.installed
    tool.installation_log = stdout
    tool.conda_env_pinned = conda_env_pinned
    session.add(tool)
    session.commit()
    return True


@broker.task
async def update_tool(
    tool_id: uuid.UUID,
    session: Session = TaskiqDepends(get_db),
) -> bool:
    """Re-run a tool's post-install command, keeping its environment."""
    tool = session.get(Tool, tool_id)
    if tool is None:
        print(f"Tool(id={tool_id}) not found")
        return False
    if tool.status not in {ToolStatus.update_queued, ToolStatus.updating}:
        print(
            f"Tool(id={tool_id}) update task skipped because status is {tool.status}"
        )
        return False
    # Mark it as actually running, the way an install does.
    tool.status = ToolStatus.updating
    session.add(tool)
    session.commit()
    conda_env = CondaEnvManger(
        path=Path(settings.CONDA_PATH) / str(tool_id),
        env_dict=tool.conda_env or {},
        post_install_command=tool.post_install,
        version=tool.version,
    )
    try:
        stdout = await conda_env.update()
    except CondaEnvMangerError as e:
        print(f"Updating Tool(id={tool_id}) failed: {e}")
        tool.status = ToolStatus.failed
        tool.installation_log = str(e)
        session.add(tool)
        session.commit()
        return False

    print(f"Conda environment for Tool(id={tool_id}) updated")
    tool.status = ToolStatus.installed
    tool.installation_log = stdout
    session.add(tool)
    session.commit()
    # Runs that were waiting for the tool to come back can start now.
    await dispatch_pending_runs(session)
    return True


@broker.task
async def uninstall_tool(
    tool_id: uuid.UUID,
    session: Session = TaskiqDepends(get_db),
) -> bool:
    tool = session.get(Tool, tool_id)
    if tool is None:
        print(f"Tool(id={tool_id}) not found")
        return False
    conda_env = CondaEnvManger(
        path=Path(settings.CONDA_PATH) / str(tool_id),
        env_dict=tool.conda_env or {},
        post_install_command=tool.post_install,
    )
    print(f"Removing conda environment for Tool(id={tool_id})")
    try:
        if conda_env.is_created:
            await conda_env.remove()
            tool.installation_log = "Conda environment removed successfully."
        else:
            tool.installation_log = (
                "Conda environment already absent; tool uninstalled."
            )
    except CondaEnvMangerError as e:
        print(f"Removing conda environment failed: {e}")
        tool.installation_log = str(e)
        tool.status = ToolStatus.failed
        session.add(tool)
        session.commit()
        return False
    tool.status = ToolStatus.uninstalled
    tool.conda_env_pinned = None
    session.add(tool)
    session.commit()
    return True
