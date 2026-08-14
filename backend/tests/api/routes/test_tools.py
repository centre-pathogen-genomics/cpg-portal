import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlmodel import Session

from app.api.routes import tools as tools_routes
from app.models import Tool, ToolStatus
from tests.utils.utils import random_lower_string


def _create_tool(*, db: Session, status: ToolStatus) -> Tool:
    tool = Tool(
        name=f"tool-{random_lower_string()}",
        command="echo hello",
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


def test_install_tool_sets_install_queued(monkeypatch, db: Session) -> None:
    tool = _create_tool(db=db, status=ToolStatus.uninstalled)
    task_ids: list[str] = []

    async def fake_kiq(*, tool_id):
        task_ids.append(str(tool_id))
        return SimpleNamespace(task_id="install-task")

    monkeypatch.setattr(tools_routes.install_tool_task, "kiq", fake_kiq)

    message = asyncio.run(
        tools_routes.install_tool(
            session=db,
            tool_id=tool.id,
            current_user=SimpleNamespace(),
        )
    )

    db.refresh(tool)
    assert tool.status == ToolStatus.install_queued
    assert tool.installation_log == ""
    assert task_ids == [str(tool.id)]
    assert message.message == "Tool installation task install-task started"


@pytest.mark.parametrize(
    "status",
    [ToolStatus.install_queued, ToolStatus.installing],
)
def test_install_tool_rejects_install_in_progress(status: ToolStatus, db: Session) -> None:
    tool = _create_tool(db=db, status=status)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            tools_routes.install_tool(
                session=db,
                tool_id=tool.id,
                current_user=SimpleNamespace(),
            )
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Tool is already being installed"
