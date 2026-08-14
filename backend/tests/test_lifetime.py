import asyncio
import uuid
from datetime import datetime
from types import SimpleNamespace

from sqlmodel import Session

from app import lifetime
from app.models import Run, RunStatus, Tool, ToolStatus
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def test_recover_interrupted_tasks_requeues_and_marks_interrupted(
    monkeypatch, db: Session
) -> None:
    run_task_ids: list[uuid.UUID] = []
    install_task_ids: list[uuid.UUID] = []

    async def fake_run_kiq(run_id: uuid.UUID, _command: str | None):
        run_task_ids.append(run_id)
        return SimpleNamespace(task_id=f"run-task-{run_id}")

    async def fake_install_kiq(tool_id: uuid.UUID):
        install_task_ids.append(tool_id)
        return SimpleNamespace(task_id=f"install-task-{tool_id}")

    monkeypatch.setattr(lifetime.run_tool, "kiq", fake_run_kiq)
    monkeypatch.setattr(lifetime.install_tool, "kiq", fake_install_kiq)

    owner = create_random_user(db)
    pending_tool = Tool(
        name=f"pending-tool-{random_lower_string()}",
        command="echo pending",
        enabled=True,
        status=ToolStatus.installed,
    )
    running_tool = Tool(
        name=f"running-tool-{random_lower_string()}",
        command="echo running",
        enabled=True,
        status=ToolStatus.installed,
    )
    queued_tool = Tool(
        name=f"queued-install-{random_lower_string()}",
        command="echo install",
        enabled=True,
        status=ToolStatus.install_queued,
        installation_log="old log",
    )
    installing_tool = Tool(
        name=f"installing-tool-{random_lower_string()}",
        command="echo install",
        enabled=True,
        status=ToolStatus.installing,
    )
    db.add(pending_tool)
    db.add(running_tool)
    db.add(queued_tool)
    db.add(installing_tool)
    db.commit()

    pending_run = Run(
        status=RunStatus.pending,
        created_at=datetime.utcnow(),
        command="echo pending",
        params={},
        tool_id=pending_tool.id,
        owner_id=owner.id,
    )
    running_run = Run(
        status=RunStatus.running,
        created_at=datetime.utcnow(),
        started_at=datetime.utcnow(),
        command="echo running",
        params={},
        tool_id=running_tool.id,
        owner_id=owner.id,
    )
    db.add(pending_run)
    db.add(running_run)
    db.commit()

    asyncio.run(lifetime.recover_interrupted_tasks(db))

    db.refresh(pending_run)
    db.refresh(running_run)
    db.refresh(queued_tool)
    db.refresh(installing_tool)

    assert run_task_ids == [pending_run.id]
    assert install_task_ids == [queued_tool.id]
    assert pending_run.status == RunStatus.pending
    assert pending_run.taskiq_id == f"run-task-{pending_run.id}"
    assert running_run.status == RunStatus.cancelled
    assert running_run.stdout == "Run was cancelled due to server restart."
    assert queued_tool.status == ToolStatus.install_queued
    assert queued_tool.installation_log == (
        f"Tool installation task install-task-{queued_tool.id} "
        "restarted after server startup."
    )
    assert installing_tool.status == ToolStatus.failed
    assert installing_tool.installation_log == (
        "Tool installation was interrupted by server restart. "
        "Please retry installation."
    )
