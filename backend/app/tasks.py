import asyncio
import os
import shutil
import signal
import subprocess
import uuid
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
from app.models import File, Run, SetupFile, Target, Tool
from app.tkq import broker

SessionDep = Annotated[Session, TaskiqDepends(get_db)]

async def run_command_in_subprocess(session: Session, run_id: uuid.UUID, command: str, tmp_dir: Path) -> tuple[int, str]:
    """
    Securely run a command in a subprocess while ensuring that:
    - The tool and its subprocesses are correctly managed.
    - The process is properly terminated if cancelled.
    - Outputs are safely captured and stored.

    Args:
        session (Session): Database session for job tracking.
        run_id (uuid.UUID): The unique ID of the run.
        command (str): The command to execute.
        tmp_dir (Path): The working directory for the subprocess.

    Returns:
        Tuple[int, str]: (Exit code, stdout output)
    """

    print(f"Preparing to execute command safely for Run(id={run_id})")

    # Tokenize command safely (prevents shell injection)
    print(f"Running command: {command}")
    command = f"set -euo pipefail; {command}"

    stdout_path = tmp_dir / "_portal.stdout.log"

    # Open log files for stdout and stderr
    with open(stdout_path, "wb") as stdout_file:

        try:
            process = subprocess.Popen(
                command,
                shell=True,
                executable="/bin/bash",
                cwd=tmp_dir,
                stdout=stdout_file,
                stderr=subprocess.STDOUT,
                start_new_session=True,  # Creates a new session (prevents orphaned processes)
            )
        except Exception as e:
            print(f"Failed to start subprocess for Run(id={run_id}): {e}")
            return -1, str(e)

        print(f"Run(id={run_id}) started with PID: {process.pid}")

        try:
            # Monitor process execution and check for cancellation
            while process.poll() is None:
                run = session.execute(select(Run).where(Run.id == run_id)).scalar_one()
                session.refresh(run)
                if run.status == "cancelled":
                    print(f"Run(id={run_id}) was cancelled. Attempting to terminate process group.")

                    # Send SIGTERM to process group
                    os.killpg(process.pid, signal.SIGTERM)

                    # Wait for termination, then force kill if necessary
                    await asyncio.sleep(3)
                    if process.poll() is None:
                        print(f"Run(id={run_id}) did not terminate, sending SIGKILL.")
                        os.killpg(process.pid, signal.SIGKILL)

                    process.wait()
                    return -15, "Process cancelled by user"

                await asyncio.sleep(1)

            # Get final exit code
            return_code = process.returncode
        except Exception as e:
            print(f"Error monitoring process for Run(id={run_id}): {e}")
            os.killpg(process.pid, signal.SIGTERM)  # Ensure termination
            await asyncio.sleep(2)
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)  # Force kill if still running
            raise

    # Read stdout output
    stdout_content = ""
    try:
        with open(stdout_path) as f:
            stdout_content = f.read()
    except Exception as e:
        print(f"Failed to read stdout log for Run(id={run_id}): {e}")

    return return_code, stdout_content


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
            print(f"Conda environment for Tool(id={tool_id}) already exists. Will force create.")
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
        post_install_command=tool.post_install
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

@broker.task
async def run_tool(
        run_id: uuid.UUID,
        run_command: str,
        session: Session = TaskiqDepends(get_db),
    ) -> bool:
    run: Run = session.get(Run, run_id)
    if run is None:
        return False
    # clear the stdout
    run.stdout = ""
    # only run the run if it is pending
    if run.status != "pending":
        return False
    if run.tool.status != "installed":
        run.stdout += "Tool must be installed first. Please contact an administrator."
        run.status = "failed"
        session.add(run)
        session.commit()
        return False
    run.status = "running"
    run.started_at = datetime.utcnow()
    run.conda_env_pinned = run.tool.conda_env_pinned
    print(f"Starting Run(id={run_id}) for Tool(id={run.tool_id})")
    session.add(run)
    session.commit()

    # create tmp directory to run the tool
    tmp_dir = Path(settings.TMP_PATH) / str(run_id)
    try:
        tmp_dir.mkdir(parents=True, exist_ok=False)
    except FileExistsError:
        print(f"Run(id={run_id}) directory already exists")
        run.status = "failed"
        session.add(run)
        session.commit()
        return
    # symlink the files to the tmp directory
    if run.input_file_ids:
        print(f"Symlinking files to {tmp_dir}")
        try:
            file_ids = run.input_file_ids or []
            for file_id in file_ids: # do in batches?
                file = session.get(File, file_id)
                name = Path(file.location).name
                print(f"Symlinking {file.location} to {tmp_dir / name}")
                os.symlink(Path(file.location), tmp_dir / name)
        except Exception as e:
            print(f"Error symlinking files: {e}")
            run.stdout += "\nError symlinking files!"
            run.status = "failed"
            session.add(run)
            session.commit()
            shutil.rmtree(tmp_dir)
            return False

    env = JinjaEnvironment()
    if run.tool.setup_files:
        # write setup files to tmp directory
        # these are dynamic files that the tool needs to run
        for setup_file in run.tool.setup_files:
            setup_file = SetupFile(**setup_file)
            path = tmp_dir / setup_file.name
            if path.exists():
                print(f"File '{path}' already exists")
                run.stdout += "\nTool setup failed. Please contact an administrator."
                run.status = "failed"
                session.add(run)
                session.commit()
                shutil.rmtree(tmp_dir)
                return
            with open(tmp_dir / setup_file.name, "w") as f:
                template = env.from_string(setup_file.content)
                content = template.render(**run.params)
                print(f"Writing content to {path}")
                print(content)
                f.write(content)
    if run.tool.conda_env:
        conda_env = CondaEnvManger(
            path=Path(settings.CONDA_PATH) / str(run.tool_id),
            env_dict=run.tool.conda_env,
            post_install_command=run.tool.post_install
        )
        if not conda_env.is_created:
            run.stdout += "Tool environment not found. Please contact an administrator."
            run.status = "failed"
            run.tool.status = "uninstalled"
            session.add(run)
            session.commit()
            shutil.rmtree(tmp_dir)
            return False
        # Add the conda environment activation command to the run command
        run_command = f"{conda_env.activate_command} && {run_command}"
    try:
        # Run the tool command in a subprocess
        returncode, stdout = await run_command_in_subprocess(session, run_id, run_command, tmp_dir)
        print(f"Run(id={run_id}) finished with return code: {returncode}")
        print(f"stdout: {stdout}")
    except Exception as e:
        print(f"An error occurred: {e}")
        run.stdout += f"An error occurred: {e}"
        run.status = "failed"
        session.add(run)
        session.commit()
        shutil.rmtree(tmp_dir)
        return False
    run.finished_at = datetime.utcnow()
    run.stdout += stdout
    if returncode != 0:
        print(f"Run(id={run_id}) failed with return code: {returncode}")
        # canceled or failed
        run.status = "failed"
        if returncode == -15:
            run.status = "cancelled"
        session.add(run)
        session.commit()
        return False
    if run.tool.targets:
        missing_targets = []
        for target in run.tool.targets:
            target = Target(**target)
            # format the target path with tool params
            print(f"Formatting target path: {target.path}")
            template = env.from_string(target.path)
            target_file = tmp_dir / template.render(**run.params)
            # check if the target file exists
            if target.required and not target_file.exists():
                print(f"Target file {target_file} does not exist")
                run.stdout += f"\nTarget file '{target_file.name}' does not exist!"
                missing_targets.append(target_file)
                continue
            if not target.required and not target_file.exists():
                print(f"Target file {target_file} does not exist, but is not required")
                continue

            print(f"Saving target file: {target_file}")
            file = save_file(
                session=session,
                file_path=target_file,
                owner_id=run.owner_id,
                file_type=target.target_type,
                saved=False, # the file is not saved to the use my files
                tags=run.tags,
            )
            run.files.append(file)
        if missing_targets:
            run.status = "failed"
            session.add(run)
            session.commit()
            shutil.rmtree(tmp_dir)
            return False

    run.status = "completed"
    session.add(run)
    session.commit()
    shutil.rmtree(tmp_dir)
    print(f"Run(id={run_id}) completed")
    return True


