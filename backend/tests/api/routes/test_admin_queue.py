import asyncio
from types import SimpleNamespace

from sqlmodel import Session, func, select

from app.api.routes.admin import QueuePauseRequest, pause_queue, resume_queue
from app.api.routes.runs import create_run
from app.api.routes.settings import read_queue_status
from app.core.app_settings import get_or_create_app_settings
from app.models import Run, Tool, ToolStatus, User
from app.tasks import run_tool
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def _create_tool(db: Session) -> Tool:
    tool = Tool(
        name=f"tool-{random_lower_string()}",
        command="echo hello",
        enabled=True,
        status=ToolStatus.installed,
    )
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return tool


def test_queue_pause_and_resume_endpoints(monkeypatch, db: Session) -> None:
    async def fake_kiq(*args, **kwargs):  # noqa: ARG001
        return SimpleNamespace(task_id="task-id")

    monkeypatch.setattr("app.api.routes.admin.run_tool.kiq", fake_kiq)

    pause_data = pause_queue(
        session=db,
        body=QueuePauseRequest(reason="maintenance"),
    )
    assert pause_data.queue_paused is True
    assert pause_data.queue_pause_reason == "maintenance"
    assert pause_data.pending_runs >= 0
    assert pause_data.running_runs >= 0

    resume_data = asyncio.run(resume_queue(session=db))
    assert resume_data.queue_paused is False
    assert resume_data.queue_pause_reason is None


def test_queue_pause_keeps_new_runs_pending_without_dispatch(monkeypatch, db: Session) -> None:
    user = create_random_user(db)
    tool = _create_tool(db)
    app_settings = get_or_create_app_settings(db)
    app_settings.queue_paused = True
    app_settings.queue_pause_reason = "maintenance"
    db.add(app_settings)
    db.commit()

    dispatched: list[str] = []

    async def fake_kiq(*args, **kwargs):  # noqa: ARG001
        dispatched.append("dispatched")
        return SimpleNamespace(task_id="task-id")

    async def fake_broadcast(*args, **kwargs):  # noqa: ARG001
        return None

    monkeypatch.setattr("app.api.routes.runs.run_tool.kiq", fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", fake_broadcast)
    before_count = db.exec(select(func.count()).select_from(Run)).one()

    try:
        run = asyncio.run(
            create_run(
                session=db,
                current_user=user,
                tool_id=tool.id,
                params={},
            )
        )
    finally:
        app_settings.queue_paused = False
        app_settings.queue_pause_reason = None
        app_settings.queue_paused_at = None
        db.add(app_settings)
        db.commit()

    after_count = db.exec(select(func.count()).select_from(Run)).one()
    assert run.status == "pending"
    assert run.taskiq_id is None
    assert dispatched == []
    assert after_count == before_count + 1


def test_user_visible_queue_status_returns_pause_reason(db: Session) -> None:
    app_settings = get_or_create_app_settings(db)
    app_settings.queue_paused = True
    app_settings.queue_pause_reason = "maintenance"
    db.add(app_settings)
    db.commit()

    try:
        status = read_queue_status(session=db, _current_user=create_random_user(db))
    finally:
        app_settings.queue_paused = False
        app_settings.queue_pause_reason = None
        app_settings.queue_paused_at = None
        db.add(app_settings)
        db.commit()

    assert status.queue_paused is True
    assert status.queue_pause_reason == "maintenance"


def test_queue_resume_dispatches_held_pending_runs(monkeypatch, db: Session) -> None:
    user = create_random_user(db)
    tool = _create_tool(db)
    app_settings = get_or_create_app_settings(db)
    app_settings.queue_paused = True
    app_settings.queue_pause_reason = "maintenance"
    db.add(app_settings)
    db.commit()

    run = Run(
        status="pending",
        command="echo hello",
        params={},
        tool_id=tool.id,
        owner_id=user.id,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    dispatched_run_ids = []

    async def fake_kiq(run_id, _command):  # noqa: ANN001
        dispatched_run_ids.append(run_id)
        return SimpleNamespace(task_id="task-id")

    monkeypatch.setattr("app.api.routes.admin.run_tool.kiq", fake_kiq)

    resume_data = asyncio.run(resume_queue(session=db))
    db.refresh(run)

    assert resume_data.queue_paused is False
    assert run.id in dispatched_run_ids
    assert run.taskiq_id == "task-id"


def test_paused_queue_prevents_worker_from_starting_pending_run(db: Session) -> None:
    user = create_random_user(db)
    tool = _create_tool(db)
    app_settings = get_or_create_app_settings(db)
    app_settings.queue_paused = True
    db.add(app_settings)
    db.commit()

    run = Run(
        status="pending",
        taskiq_id="queued-task",
        command="echo hello",
        params={},
        tool_id=tool.id,
        owner_id=user.id,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    try:
        result = asyncio.run(run_tool(run.id, run.command, session=db))
    finally:
        app_settings.queue_paused = False
        app_settings.queue_pause_reason = None
        app_settings.queue_paused_at = None
        db.add(app_settings)
        db.commit()

    db.refresh(run)
    assert result is False
    assert run.status == "pending"
    assert run.started_at is None
    assert run.taskiq_id is None


def test_queue_resume_allows_run_creation(monkeypatch, db: Session) -> None:
    user: User = create_random_user(db)
    tool = _create_tool(db)
    app_settings = get_or_create_app_settings(db)
    app_settings.queue_paused = False
    app_settings.queue_pause_reason = None
    app_settings.queue_paused_at = None
    db.add(app_settings)
    db.commit()

    async def fake_kiq(*args, **kwargs):  # noqa: ARG001
        return SimpleNamespace(task_id="task-id")

    async def fake_broadcast(*args, **kwargs):  # noqa: ARG001
        return None

    monkeypatch.setattr("app.api.routes.runs.run_tool.kiq", fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", fake_broadcast)

    run = asyncio.run(
        create_run(
            session=db,
            current_user=user,
            tool_id=tool.id,
            params={},
        )
    )

    assert run.status == "pending"
    assert run.taskiq_id == "task-id"
