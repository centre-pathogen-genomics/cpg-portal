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
from taskiq import TaskiqDepends

from app.api.deps import get_db
from app.core.config import settings
from app.crud import save_file
from app.models import File, Result, Task
from app.tkq import broker

SessionDep = Annotated[Session, TaskiqDepends(get_db)]

async def run_task_in_subprocess(session: Session, task_id: uuid.UUID, run_command: list[str] | str, tmp_dir: Path, shell: bool = False) -> subprocess.Popen:
    if isinstance(run_command, list) and shell:
        raise ValueError("Cannot use shell=True with a list command")

    # Start the process in a new session
    preexec_fn = os.setsid if shell else None
    print(f"Running command: {run_command}")
    res = subprocess.Popen(
        run_command,
        shell=shell,
        text=True,
        cwd=tmp_dir,
        preexec_fn=preexec_fn,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    print(f"Task(id={task_id}) started with PID: {res.pid}")
    try:
        while res.poll() is None:
            # Check if the task is cancelled
            task = session.execute(select(Task).where(Task.id == task_id)).scalar_one()
            session.refresh(task)
            if task.status == "cancelled":
                print(f"Task(id={task_id}) was cancelled")
                # Send SIGTERM to the entire process group
                os.killpg(os.getpgid(res.pid), signal.SIGTERM)
                return res
            await asyncio.sleep(1)
    except Exception as e:
        print(f"An error occurred: {e}")
        os.killpg(os.getpgid(res.pid), signal.SIGTERM)  # Ensure to kill the group on error
        raise e
    if res.returncode != 0:
        print(f"Task(id={task_id}) failed with return code: {res.returncode}")
        task.status = "failed"
        session.add(task)
        session.commit()
    return res

@broker.task
async def run_tool(
        task_id: uuid.UUID,
        run_command: list[str],
        file_ids: list[uuid.UUID] | None = None,
        session: Session = TaskiqDepends(get_db),
    ) -> bool:
    if file_ids is None:
        file_ids = []
    task: Task = session.get(Task, task_id)
    if task is None:
        return False
    # only run the task if it is pending
    if task.status != "pending":
        return False
    print(f"Starting Task(id={task_id}) for Tool(id={task.tool_id})")
    task.status = "running"
    task.started_at = datetime.utcnow()
    if task.stdout is None:
        task.stdout = ""
    if task.stderr is None:
        task.stderr = ""
    if task.command is None:
        task.command = ""
    task.command = " ".join(run_command)
    session.add(task)
    session.commit()
    # create tmp directory to run the tool
    tmp_dir = Path(settings.TMP_PATH) / str(task_id)
    try:
        tmp_dir.mkdir(parents=True, exist_ok=False)
    except FileExistsError:
        print(f"Task(id={task_id}) directory already exists")
        task.status = "failed"
        session.add(task)
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
        task.stderr += f"Error symlinking files: {e}"
        task.status = "failed"
        session.add(task)
        session.commit()
        return False
    # Set up the tool
    if task.tool.setup_command:
        setup_command = task.tool.setup_command
        setup_res = await run_task_in_subprocess(
                session, task_id, setup_command, tmp_dir, shell=True
            )
        if setup_res.returncode != 0:
            print(setup_res.stdout.read())
            print(setup_res.stderr.read())
            task.stderr += "Tool setup failed. Please contact an administrator."
            session.add(task)
            session.commit()
            return False
    # Run the tool
    res = await run_task_in_subprocess(session, task_id, run_command, tmp_dir)
    task.finished_at = datetime.utcnow()
    task.stderr += res.stderr.read()
    task.stdout += res.stdout.read()
    if res.returncode != 0:
        print(f"Task(id={task_id}) failed with return code: {res.returncode}")
        # canceled or failed
        if res.returncode == -15:
            task.status = "cancelled"
        session.add(task)
        session.commit()
        return False
    for target in task.tool.targets:
        # format the target path with tool params
        print(f"Formatting target path: {target.path}")
        target_file = tmp_dir / target.path
        for key, value in task.params.items():
            if f"{{{key}}}" not in str(target_file):
                continue
            print(f"Replacing {{{key}}} with {value}")
            target_file = Path(str(target_file).replace(f"{{{key}}}", str(value)))
        # check if the target file exists
        if target.required and not target_file.exists():
            print(f"Target file {target_file} does not exist")
            task.stderr += f"Target file {target_file} does not exist!"
            task.status = "failed"
            session.add(task)
            session.commit()
            return False
        file = save_file(
            session=session,
            file_path=target_file,
            owner_id=task.owner_id
        )
        result = Result(file_id=file.id, target_id=target.id, task_id=task.id, owner_id=task.owner_id)
        session.add(result)
        session.commit()
        session.refresh(result)
    task.status = "completed"
    session.add(task)
    session.commit()
    shutil.rmtree(tmp_dir)
    print(f"Task(id={task_id}) completed")
    return True


