import asyncio

from sqlmodel import Session

from app.conda import CondaEnvManger
from app.core.config import settings
from app.models import Run, RunStatus, Tool, ToolStatus
from app.tasks import run_tool, update_tool
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def _create_tool(db: Session, status: ToolStatus) -> Tool:
    tool = Tool(
        name=f"tool-{random_lower_string()}",
        command="echo hello",
        post_install="echo update",
        enabled=True,
        status=status,
        conda_env={
            "channels": ["conda-forge"],
            "dependencies": ["python=3.11"],
        },
    )
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return tool


def test_update_tool_task_reruns_only_the_post_install(
    db: Session, monkeypatch
) -> None:
    tool = _create_tool(db, ToolStatus.update_queued)
    calls = {"updated": False, "removed": False, "dispatched": False, "running": False}

    async def fake_update(self) -> str:  # noqa: ARG001
        calls["updated"] = True
        # The queued status becomes the running one before the work starts.
        db.refresh(tool)
        calls["running"] = tool.status == ToolStatus.updating
        return "post-install ran"

    async def fake_remove(self) -> None:  # noqa: ARG001
        calls["removed"] = True

    async def fake_dispatch(session) -> list:  # noqa: ARG001
        calls["dispatched"] = True
        return []

    monkeypatch.setattr(CondaEnvManger, "update", fake_update)
    monkeypatch.setattr(CondaEnvManger, "remove", fake_remove)
    monkeypatch.setattr("app.tasks.dispatch_pending_runs", fake_dispatch)

    assert asyncio.run(update_tool(tool_id=tool.id, session=db)) is True

    db.refresh(tool)
    assert tool.status == ToolStatus.installed
    assert tool.installation_log == "post-install ran"
    # The environment is reused rather than rebuilt, and the runs that waited
    # for it are woken.
    assert calls == {
        "updated": True,
        "removed": False,
        "dispatched": True,
        "running": True,
    }


def test_update_tool_task_skips_a_tool_that_is_not_updating(
    db: Session, monkeypatch
) -> None:
    tool = _create_tool(db, ToolStatus.installed)
    calls: list[str] = []

    async def fake_update(self) -> str:  # noqa: ARG001
        calls.append("update")
        return "ran"

    monkeypatch.setattr(CondaEnvManger, "update", fake_update)

    assert asyncio.run(update_tool(tool_id=tool.id, session=db)) is False
    assert calls == []


def test_run_tool_duplicate_delivery_is_a_no_op(
    db: Session, monkeypatch, tmp_path
) -> None:
    """Two deliveries of the same run: one executes, the other never runs."""
    marker = tmp_path / "marker.txt"
    # A real but cheap run: no sandbox, no conda env, no metrics sampling.
    monkeypatch.setattr(settings, "SANDBOX_ENABLED", False)
    monkeypatch.setattr(settings, "TMP_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "RUN_METRICS_INTERVAL", 0)

    async def fake_broadcast(*args, **kwargs):  # noqa: ANN002, ANN003, ARG001
        return None

    async def fake_dispatch(session) -> list:  # noqa: ARG001
        return []

    monkeypatch.setattr("app.wsmanager.manager.broadcast", fake_broadcast)
    monkeypatch.setattr("app.tasks.dispatch_pending_runs", fake_dispatch)

    owner = create_random_user(db)
    # No conda env: the run must not depend on a conda environment existing.
    tool = Tool(
        name=f"tool-{random_lower_string()}",
        command="echo hello",
        enabled=True,
        status=ToolStatus.installed,
    )
    db.add(tool)
    db.commit()
    run = Run(
        status=RunStatus.pending,
        command=f"echo ran >> {marker}",
        params={},
        tool_id=tool.id,
        owner_id=owner.id,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # First delivery: the run executes and completes.
    assert asyncio.run(run_tool(run.id, run.command, session=db)) is True
    db.refresh(run)
    assert run.status == RunStatus.completed
    assert marker.read_text().splitlines() == ["ran"]

    # The duplicate delivery is a clean no-op: the command is not executed
    # again and the completed run is never flipped to failed.
    assert asyncio.run(run_tool(run.id, run.command, session=db)) is False
    db.refresh(run)
    assert run.status == RunStatus.completed
    assert marker.read_text().splitlines() == ["ran"]
