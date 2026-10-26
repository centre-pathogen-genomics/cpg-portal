import asyncio

from sqlmodel import Session

from app.conda import CondaEnvManger
from app.models import Tool, ToolStatus
from app.tasks import update_tool
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
