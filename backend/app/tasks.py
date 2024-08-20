import asyncio
import json
import os
import shutil
import signal
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Annotated, Union
from uuid import uuid4

from sqlmodel import Session, select
from taskiq import Context, TaskiqDepends

from app.api.deps import get_db
from app.core.config import settings
from app.crud import save_file_multiple
from app.models import File, Result, Task
from app.tkq import broker

SessionDep = Annotated[Session, TaskiqDepends(get_db)]

async def run_task_in_subprocess(session: Session, task_id: int, run_command: list[str] | str, tmp_dir: Path, shell: bool = False) -> subprocess.Popen:
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
        preexec_fn=preexec_fn
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
        task.status = "failed"
        session.add(task)
        session.commit()
    return res

@broker.task
async def run_workflow(
        task_id: int,
        run_command: list[str],
        file_ids: list[int] | None = None,
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
    print(f"Starting Task(id={task_id}) for Workflow(id={task.workflow_id})")
    task.status = "running"
    task.started_at = datetime.utcnow()
    session.add(task)
    session.commit()
    # create tmp directory to run the workflow
    tmp_dir = Path(settings.TMP_PATH) / str(task_id)
    tmp_dir.mkdir(parents=True, exist_ok=True)
    # symlink the files to the tmp directory
    print(f"Symlinking files to {tmp_dir}")
    try:
        for file_id in file_ids: # do in batches?
            file = session.get(File, file_id)
            print(f"Symlinking {file.location} to {tmp_dir / file.name}")
            os.symlink(Path(file.location), tmp_dir / file.name)
    except Exception as e:
        print(f"Error symlinking files: {e}")
        task.status = "failed"
        session.add(task)
        session.commit()
        return False
    # Set up the workflow
    if task.workflow.setup_command:
        setup_command = task.workflow.setup_command
        setup_res = await run_task_in_subprocess(
                session, task_id, setup_command, tmp_dir, shell=True
            )
        if setup_res.returncode != 0:
            return False
    # Run the workflow
    res = await run_task_in_subprocess(session, task_id, run_command, tmp_dir)
    task.finished_at = datetime.utcnow()
    if res.returncode != 0:
        session.add(task)
        session.commit()
        return False
    target_files = []
    if task.workflow.target_files:
        target_files = [tmp_dir / file for file in task.workflow.target_files]
    for tmp_file_path in target_files:
        if not tmp_file_path.exists():
            task.status = "failed"
            session.add(task)
            session.commit()
            return False
    results = None
    if task.workflow.json_results_file:
        json_results_file = tmp_dir / task.workflow.json_results_file
        if not json_results_file.exists():
            print(f"JSON results file not found: {json_results_file}")
            task.status = "failed"
            session.add(task)
            session.commit()
            return False
        with open(json_results_file) as f:
            try:
                results = json.load(f)
            except json.JSONDecodeError as e:
                print(f"Error loading JSON results file: {e}")
                task.status = "failed"
                session.add(task)
                session.commit()
                return False
    files = save_file_multiple(
        session=session,
        file_paths=target_files,
        owner_id=task.owner_id
        )
    result = Result(results=results, files=files, task_id=task.id, owner_id=task.owner_id)
    session.add(result)
    session.commit()
    session.refresh(result)
    task.result = result
    task.status = "completed"
    session.add(task)
    session.commit()
    shutil.rmtree(tmp_dir)
    print(f"Task(id={task_id}) completed")
    return True


