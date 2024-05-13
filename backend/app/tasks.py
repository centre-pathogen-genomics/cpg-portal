import asyncio
import json
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from sqlmodel import Session
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
    res = subprocess.Popen(
        run_command,
        shell=shell,
        text=True,
        cwd=tmp_dir,
    )
    while res.poll() is None:
        # check if the task is cancelled
        task = session.get(Task, task_id)
        if task.status == "cancelled":
            print(f"Task(id={task_id}) was cancelled")
            res.kill()
            return res
        await asyncio.sleep(1)
    return res

@broker.task
async def run_workflow(
        task_id: int,
        run_command: list[str],
        session: Session = TaskiqDepends(get_db),
    ) -> bool:
    task: Task = session.get(Task, task_id)
    print(f"Starting Task(id={task_id}) for Workflow(id={task.workflow_id})")
    task.status = "running"
    task.started_at = datetime.utcnow()
    session.add(task)
    session.commit()
    # create tmp directory to run the workflow
    tmp_dir = Path(settings.TMP_PATH) / str(task_id)
    tmp_dir.mkdir(parents=True, exist_ok=True)
    # Set up the workflow
    if task.workflow.setup_command:
        setup_command = task.workflow.setup_command
        setup_res = await run_task_in_subprocess(
                session, task_id, setup_command, tmp_dir, shell=True
            )
        if setup_res.returncode != 0:
            task.status = "failed"
            session.add(task)
            session.commit()
            return False
    # Run the workflow
    res = await run_task_in_subprocess(session, task_id, run_command, tmp_dir)
    task.finished_at = datetime.utcnow()
    if res.returncode != 0:
        task.status = "failed"
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
            task.status = "failed"
            session.add(task)
            session.commit()
            return False
        with open(json_results_file) as f:
            results = json.load(f)
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


