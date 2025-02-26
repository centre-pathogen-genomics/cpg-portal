import asyncio
import json
import os
import shutil
import signal
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Annotated

from jinja2 import Environment as JinjaEnvironment
from sqlmodel import Session, select
from taskiq import TaskiqDepends

from app.api.deps import get_db
from app.conda import CondaEnvManger, CondaEnvMangerError
from app.core.config import settings
from app.crud import save_file
from app.models import File, Run, RunStatus, SetupFile, Target, Tool
from app.tkq import broker
from app.utils import generate_run_finished_email, send_email
from app.wsmanager import manager

SessionDep = Annotated[Session, TaskiqDepends(get_db)]


async def run_command_in_subprocess(
    session: Session, run_id: uuid.UUID, command: str, tmp_dir: Path
) -> tuple[int, str]:
    """
    Run a command in an asynchronous subprocess, capture its stdout in real time,
    and update logs to the DB as output is generated.

    Args:
        session (Session): Database session.
        run_id (uuid.UUID): Unique ID of the run.
        command (str): The shell command to execute.
        tmp_dir (Path): Working directory for the subprocess.

    Returns:
        Tuple[int, str]: (Exit code, full concatenated stdout output)
    """
    print(f"Preparing to execute command safely for Run(id={run_id})")

    # Enhance the command for safety.
    command = f"set -euo pipefail; {command}"

    # Start the subprocess with stdout piped.
    process = await asyncio.create_subprocess_shell(
        command,
        shell=True,
        executable="/bin/bash",
        cwd=tmp_dir,
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
            print(decoded_line)  # Optional: print to console
            log_lines.append(decoded_line)

            # Update the DB immediately
            try:
                # For immediate update
                print(f"Updating log for Run(id={run_id})")
                session.refresh(run)
                run.stdout += decoded_line + "\n"
                session.add(run)
                session.commit()
                # Broadcast the log line to the client
                print(f"Broadcasting log for Run(id={run_id})")
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

    # Run both the log reading and cancellation monitor concurrently.
    await asyncio.gather(read_stdout(), monitor_cancellation())

    # Wait for the process to finish
    await process.wait()
    return_code = process.returncode

    # Optionally, if you want to have the full log output as one string:
    full_log_output = "\n".join(log_lines)

    return return_code, full_log_output


def update_run(session: Session, run: Run, status: RunStatus, message=None):
    """Update the run status and optionally add a message, then commit."""
    run.status = str(status)
    if message:
        print(f"Adding message to Run(id={run.id}): {message}")
        run.stdout += "\n" + message
    if run.email_on_completion and settings.emails_enabled and run.owner.email:
        print(f"Sending email for Run(id={run.id})")
        email_html = generate_run_finished_email(run.tool.name, str(run.id), run.status)
        send_email(run.owner.email, email_html)
    session.add(run)
    session.commit()

@contextmanager
def create_tmp_dir(run_id: uuid.UUID) -> Path:
    """Context manager to create and clean up a temporary directory."""
    tmp_dir = Path(settings.TMP_PATH) / str(run_id)
    try:
        tmp_dir.mkdir(parents=True, exist_ok=False)
        yield tmp_dir
    finally:
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir)

def symlink_input_files(session, run, tmp_dir):
    """Symlink input files to the temporary directory."""
    if not run.input_file_ids:
        return True
    try:
        for file_id in run.input_file_ids:
            file = session.get(File, file_id)
            file_name = Path(file.location).name
            print(f"Symlinking {file.location} to {tmp_dir / file_name}")
            os.symlink(Path(file.location), tmp_dir / file_name)
        return True
    except Exception as e:
        print(f"Error symlinking files: {e}")
        update_run(session, run, RunStatus.failed, "Error symlinking files!")
        return False

def write_setup_files(session, run, tmp_dir):
    """Render and write setup files to the temporary directory."""
    env = JinjaEnvironment()
    if run.tool.setup_files:
        for setup_file_data in run.tool.setup_files:
            setup_file = SetupFile(**setup_file_data)
            file_path = tmp_dir / setup_file.name
            if file_path.exists():
                print(f"File '{file_path}' already exists")
                update_run(session, run, RunStatus.failed, "Tool setup failed. Please contact an administrator.")
                return False
            with open(file_path, "w") as f:
                template = env.from_string(setup_file.content)
                content = template.render(**run.params)
                print(f"Writing content to {file_path}\n{content}")
                f.write(content)
    return True

def setup_conda_env(session, run, run_command):
    """Prepare the conda environment if required, and update the command accordingly."""
    if run.tool.conda_env:
        conda_env = CondaEnvManger(
            path=Path(settings.CONDA_PATH) / str(run.tool_id),
            env_dict=run.tool.conda_env,
            post_install_command=run.tool.post_install,
        )
        if not conda_env.is_created:
            update_run(session, run, RunStatus.failed, "Tool environment not found. Please contact an administrator.")
            run.tool.status = "uninstalled"
            return None
        # Prepend the conda activation command.
        run_command = f"{conda_env.activate_command} && {run_command}"
    return run_command

def handle_return_code(session, run, returncode):
    """Handle the subprocess return code and update the run accordingly."""
    if returncode != 0:
        if returncode == -15:
            run.status = RunStatus.cancelled
        else:
            run.status = RunStatus.failed
        update_run(session, run, run.status)
        return False
    return True

def process_targets(session, run, tmp_dir):
    """Process target files: check their existence and save them."""
    env = JinjaEnvironment()
    missing_targets = []
    if run.tool.targets:
        for target_data in run.tool.targets:
            target = Target(**target_data)
            print(f"Formatting target path: {target.path}")
            template = env.from_string(target.path)
            rendered_path = template.render(**run.params)
            target_file = tmp_dir / rendered_path
            if target.required and not target_file.exists():
                print(f"Target file {target_file} does not exist")
                run.stdout += f"\nTarget file '{target_file.name}' does not exist!"
                missing_targets.append(target_file)
                continue
            if target.required or target_file.exists():
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
            update_run(session, run, RunStatus.failed, "Missing required target")
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
    if run.tool.status != "installed":
        update_run(session, run, RunStatus.failed, "Tool must be installed first. Please contact an administrator.")
        return False

    # Update run state to running.
    run.status = "running"
    run.started_at = datetime.utcnow()
    run.conda_env_pinned = run.tool.conda_env_pinned
    session.add(run)
    session.commit()

    try:
        with create_tmp_dir(run_id) as tmp_dir:
            # Process input files.
            if not symlink_input_files(session, run, tmp_dir):
                return False

            # Write any required setup files.
            if not write_setup_files(session, run, tmp_dir):
                return False

            # Set up the conda environment if necessary.
            updated_command = setup_conda_env(session, run, run_command)
            if updated_command is None:
                return False

            # Run the command in a subprocess.
            try:
                returncode, stdout = await run_command_in_subprocess(session, run_id, updated_command, tmp_dir)
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
            if not process_targets(session, run, tmp_dir):
                return False

            # Mark the run as completed.
            run.status = "completed"
            session.add(run)
            session.commit()

        print(f"Run(id={run_id}) completed")
        return True

    except FileExistsError:
        update_run(session, run, RunStatus.failed, "Run directory already exists")
        return False
    except Exception as e:
        update_run(session, run, RunStatus.failed, f"An unexpected error occurred: {e}")
        return False

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
        tool.status = "failed"
        session.add(tool)
        session.commit()
        return False
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
                f"Conda environment for Tool(id={tool_id}) already exists. Will force create."
            )
        print(f"Creating conda environment for Tool(id={tool_id})")
        stdout = await conda_env.create()
        conda_env_pinned = await conda_env.pin()
    except Exception as e:
        print(f"An error occurred will creating conda environment: {e}")
        tool.status = "failed"
        tool.installation_log = str(e)
        session.add(tool)
        session.commit()
        raise e

    print(f"Conda environment for Tool(id={tool_id}) created")
    tool.status = "installed"
    tool.installation_log = stdout
    tool.conda_env_pinned = conda_env_pinned
    session.add(tool)
    session.commit()
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
    tool.status = "uninstalled"
    try:
        await conda_env.remove()
    except CondaEnvMangerError as e:
        print(f"Removing conda environment failed: {e}")
        tool.installation_log = str(e)
        tool.status = "failed"
    session.add(tool)
    session.commit()
    return True