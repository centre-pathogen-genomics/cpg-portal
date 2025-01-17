import asyncio
import os
import shutil
import signal
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Annotated

from sqlmodel import Session, select
from taskiq import TaskiqDepends, TaskiqEvents, TaskiqState

from app.api.deps import get_db
from app.core.config import settings
from app.crud import save_file
from app.models import File, FileType, Run
from app.tkq import broker

SessionDep = Annotated[Session, TaskiqDepends(get_db)]

@broker.on_event(TaskiqEvents.WORKER_SHUTDOWN)
async def shutdown(state: TaskiqState) -> None:
    # TODO: Cancel all running tasks in this worker
    print("Shutting down worker")
    print(state)
    pass

async def run_command_in_subprocess(session: Session, run_id: uuid.UUID, command: list[str] | str, tmp_dir: Path, shell: bool = False) -> subprocess.Popen:
    if isinstance(command, list) and shell:
        raise ValueError("Cannot use shell=True with a list command")

    # Start the process in a new session
    preexec_fn = os.setsid if shell else None
    print(f"Running command: {command}")
    res = subprocess.Popen(
        command,
        shell=shell,
        text=True,
        cwd=tmp_dir,
        preexec_fn=preexec_fn,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    print(f"Run(id={run_id}) started with PID: {res.pid}")
    try:
        while res.poll() is None:
            # Check if the run is cancelled
            run = session.execute(select(Run).where(Run.id == run_id)).scalar_one()
            session.refresh(run)
            if run.status == "cancelled":
                print(f"Run(id={run_id}) was cancelled")
                # Send SIGTERM to the entire process group
                os.killpg(os.getpgid(res.pid), signal.SIGTERM)
                return res
            await asyncio.sleep(1)
    except Exception as e:
        print(f"An error occurred: {e}")
        os.killpg(os.getpgid(res.pid), signal.SIGTERM)  # Ensure to kill the group on error
        raise e
    if res.returncode != 0:
        print(f"Run(id={run_id}) failed with return code: {res.returncode}")
        run.status = "failed"
        session.add(run)
        session.commit()
    return res

@broker.task
async def run_tool(
        run_id: uuid.UUID,
        run_command: list[str],
        file_ids: list[uuid.UUID] | None = None,
        session: Session = TaskiqDepends(get_db),
    ) -> bool:
    if file_ids is None:
        file_ids = []
    run: Run = session.get(Run, run_id)
    if run is None:
        return False
    # only run the run if it is pending
    if run.status != "pending":
        return False
    print(f"Starting Run(id={run_id}) for Tool(id={run.tool_id})")
    run.status = "running"
    run.started_at = datetime.utcnow()
    if run.stdout is None:
        run.stdout = ""
    if run.stderr is None:
        run.stderr = ""
    if run.command is None:
        run.command = ""
    run.command = " ".join(run_command)
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
    print(f"Symlinking files to {tmp_dir}")
    try:
        for file_id in file_ids: # do in batches?
            file = session.get(File, file_id)
            print(f"Symlinking {file.location} to {tmp_dir / file.name}")
            os.symlink(Path(file.location), tmp_dir / file.name)
    except Exception as e:
        print(f"Error symlinking files: {e}")
        run.stderr += f"Error symlinking files: {e}"
        run.status = "failed"
        session.add(run)
        session.commit()
        return False
    # Set up the tool
    if run.tool.setup_command:
        setup_command = run.tool.setup_command
        setup_res = await run_command_in_subprocess(
                session, run_id, setup_command, tmp_dir, shell=True
            )
        if setup_res.returncode != 0:
            print(setup_res.stdout.read())
            print(setup_res.stderr.read())
            run.stderr += "Tool setup failed. Please contact an administrator."
            session.add(run)
            session.commit()
            return False
    # Run the tool
    res = await run_command_in_subprocess(session, run_id, run_command, tmp_dir)
    run.finished_at = datetime.utcnow()
    run.stderr += res.stderr.read()
    run.stdout += res.stdout.read()
    if res.returncode != 0:
        print(f"Run(id={run_id}) failed with return code: {res.returncode}")
        # canceled or failed
        if res.returncode == -15:
            run.status = "cancelled"
        session.add(run)
        session.commit()
        return False
    for target in run.tool.targets:
        # format the target path with tool params
        print(f"Formatting target path: {target.path}")
        target_file = tmp_dir / target.path
        for key, value in run.params.items():
            if f"{{{key}}}" not in str(target_file):
                continue
            print(f"Replacing {{{key}}} with {value}")
            target_file = Path(str(target_file).replace(f"{{{key}}}", str(value)))

        # check if the target file exists
        if target.required and not target_file.exists():
            print(f"Target file {target_file} does not exist")
            run.stderr += f"Target file {target_file} does not exist!"
            run.status = "failed"
            session.add(run)
            session.commit()
            return False
        if not target.required and not target_file.exists():
            print(f"Target file {target_file} does not exist, but is not required")
            continue

        print(f"Saving target file: {target_file}")
        file = save_file(
            session=session,
            file_path=target_file,
            owner_id=run.owner_id,
            file_type=target.target_type,
        )
        run.files.append(file)

    run.status = "completed"
    session.add(run)
    session.commit()
    shutil.rmtree(tmp_dir)
    print(f"Run(id={run_id}) completed")
    return True


