import asyncio
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from sqlmodel import Session, select, update

from app.core.config import settings
from app.models import Run, RunStatus, Tool, ToolStatus, User
from app.scheduling import dispatch_pending_runs, reserved_cpus, total_cpus
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


@pytest.fixture(autouse=True)
def clean_queue(db: Session) -> None:
    """The suite shares one database: leave only this test's runs queued."""
    db.exec(
        update(Run)
        .where(Run.status == RunStatus.pending)
        .values(status=RunStatus.cancelled)
    )
    db.exec(
        update(Run)
        .where(Run.status == RunStatus.running)
        .values(status=RunStatus.completed)
    )
    db.commit()


@pytest.fixture
def fake_kiq(monkeypatch) -> list[uuid.UUID]:
    dispatched: list[uuid.UUID] = []

    async def _kiq(run_id: uuid.UUID, _command: str | None):
        dispatched.append(run_id)
        return SimpleNamespace(task_id=f"task-{run_id}")

    monkeypatch.setattr("app.tasks.run_tool.kiq", _kiq)
    return dispatched


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


def _create_pending_run(db: Session, owner: User, tool: Tool, cpus: int) -> Run:
    run = Run(
        status=RunStatus.pending,
        created_at=datetime.now(UTC).replace(tzinfo=None),
        command="echo hello",
        params={},
        cpus=cpus,
        tool_id=tool.id,
        owner_id=owner.id,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def test_total_cpus_comes_from_the_setting(monkeypatch) -> None:
    monkeypatch.setattr(settings, "TOTAL_CPUS", 3)
    assert total_cpus() == 3

    # 0 means "whatever this worker may use".
    monkeypatch.setattr(settings, "TOTAL_CPUS", 0)
    assert total_cpus() >= 1


def test_three_five_cpu_runs_on_ten_cpus(db: Session, fake_kiq, monkeypatch) -> None:
    monkeypatch.setattr(settings, "TOTAL_CPUS", 10)
    owner = create_random_user(db)
    tool = _create_tool(db)
    runs = [_create_pending_run(db, owner, tool, cpus=5) for _ in range(3)]

    dispatched = asyncio.run(dispatch_pending_runs(db))

    assert {run.id for run in dispatched} == {runs[0].id, runs[1].id}
    assert fake_kiq == [runs[0].id, runs[1].id]
    assert reserved_cpus(db) == 10

    db.refresh(runs[2])
    assert runs[2].status == RunStatus.pending
    assert runs[2].taskiq_id is None


def test_waiting_run_starts_when_cpus_free_up(db: Session, fake_kiq, monkeypatch) -> None:
    monkeypatch.setattr(settings, "TOTAL_CPUS", 10)
    owner = create_random_user(db)
    tool = _create_tool(db)
    runs = [_create_pending_run(db, owner, tool, cpus=5) for _ in range(3)]
    asyncio.run(dispatch_pending_runs(db))

    # One of the running runs finishes, freeing its CPUs.
    runs[0].status = RunStatus.running
    db.add(runs[0])
    db.commit()
    runs[0].status = RunStatus.completed
    runs[0].finished_at = datetime.now(UTC).replace(tzinfo=None)
    db.add(runs[0])
    db.commit()

    dispatched = asyncio.run(dispatch_pending_runs(db))

    assert [run.id for run in dispatched] == [runs[2].id]
    assert fake_kiq[-1] == runs[2].id
    db.refresh(runs[2])
    assert runs[2].taskiq_id is not None


def test_smaller_run_behind_a_large_one_still_starts(
    db: Session, fake_kiq, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "TOTAL_CPUS", 4)
    owner = create_random_user(db)
    tool = _create_tool(db)
    large = _create_pending_run(db, owner, tool, cpus=8)
    small = _create_pending_run(db, owner, tool, cpus=2)

    dispatched = asyncio.run(dispatch_pending_runs(db))

    assert [run.id for run in dispatched] == [small.id]
    assert fake_kiq == [small.id]
    db.refresh(large)
    assert large.taskiq_id is None


def test_nothing_starts_while_the_queue_is_paused(
    db: Session, fake_kiq, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "TOTAL_CPUS", 10)
    from app.core.app_settings import get_or_create_app_settings

    app_settings = get_or_create_app_settings(db)
    app_settings.queue_paused = True
    db.add(app_settings)
    db.commit()

    owner = create_random_user(db)
    tool = _create_tool(db)
    run = _create_pending_run(db, owner, tool, cpus=1)

    try:
        assert asyncio.run(dispatch_pending_runs(db)) == []
        assert fake_kiq == []
    finally:
        app_settings.queue_paused = False
        db.add(app_settings)
        db.commit()

    db.refresh(run)
    assert run.taskiq_id is None


def test_dispatched_runs_hold_their_cpus(db: Session, monkeypatch) -> None:
    monkeypatch.setattr(settings, "TOTAL_CPUS", 4)
    owner = create_random_user(db)
    tool = _create_tool(db)
    _create_pending_run(db, owner, tool, cpus=4)

    # A run that is on its way to a worker has not started yet, but its CPUs
    # must not be handed out twice.
    waiting = db.exec(select(Run).where(Run.status == RunStatus.pending)).one()
    waiting.taskiq_id = "dispatched"
    db.add(waiting)
    db.commit()

    assert reserved_cpus(db) == 4
    assert asyncio.run(dispatch_pending_runs(db)) == []


def test_dispatch_holds_runs_until_the_tool_is_installed(
    db: Session, fake_kiq: list[uuid.UUID], monkeypatch
) -> None:
    monkeypatch.setattr(settings, "TOTAL_CPUS", 4)
    owner = create_random_user(db)
    tool = _create_tool(db)
    tool.status = ToolStatus.updating
    db.add(tool)
    db.commit()
    run = _create_pending_run(db, owner, tool, cpus=1)

    # The tool is being updated, so the run waits in the queue without holding
    # on to any CPUs.
    assert asyncio.run(dispatch_pending_runs(db)) == []
    db.refresh(run)
    assert run.taskiq_id is None
    assert reserved_cpus(db) == 0

    # Once the tool is ready the run goes to a worker.
    tool.status = ToolStatus.installed
    db.add(tool)
    db.commit()
    assert [dispatched.id for dispatched in asyncio.run(dispatch_pending_runs(db))] == [
        run.id
    ]
    assert fake_kiq == [run.id]
