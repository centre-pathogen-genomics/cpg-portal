import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlmodel import Session

from app.api.routes import tools as tools_routes
from app.models import Tool, ToolCreate, ToolStatus, ToolUpdate
from tests.utils.user import create_random_user
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
def test_install_tool_rejects_install_in_progress(
    status: ToolStatus, db: Session
) -> None:
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


def test_update_tool_sets_update_queued_and_queues_the_task(
    monkeypatch, db: Session
) -> None:
    tool = _create_tool(db=db, status=ToolStatus.installed)
    tool.post_install = "echo update"
    db.add(tool)
    db.commit()
    task_ids: list[str] = []

    async def fake_kiq(*, tool_id):
        task_ids.append(str(tool_id))
        return SimpleNamespace(task_id="update-task")

    monkeypatch.setattr(tools_routes.update_tool_task, "kiq", fake_kiq)

    message = asyncio.run(
        tools_routes.update_tool_post_install(
            session=db,
            tool_id=tool.id,
            current_user=SimpleNamespace(),
        )
    )

    db.refresh(tool)
    assert tool.status == ToolStatus.update_queued
    assert tool.installation_log == "Update queued."
    assert task_ids == [str(tool.id)]
    assert message.message == "Tool update task update-task started"


def test_update_tool_rejects_an_update_in_progress(db: Session) -> None:
    tool = _create_tool(db=db, status=ToolStatus.update_queued)
    tool.post_install = "echo update"
    db.add(tool)
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            tools_routes.update_tool_post_install(
                session=db,
                tool_id=tool.id,
                current_user=SimpleNamespace(),
            )
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Tool is already being installed or updated"


def test_update_tool_rejects_a_tool_that_is_not_installed(db: Session) -> None:
    tool = _create_tool(db=db, status=ToolStatus.uninstalled)
    tool.post_install = "echo update"
    db.add(tool)
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            tools_routes.update_tool_post_install(
                session=db,
                tool_id=tool.id,
                current_user=SimpleNamespace(),
            )
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Install the tool before updating it"


def test_update_tool_rejects_a_tool_without_a_post_install(db: Session) -> None:
    tool = _create_tool(db=db, status=ToolStatus.installed)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            tools_routes.update_tool_post_install(
                session=db,
                tool_id=tool.id,
                current_user=SimpleNamespace(),
            )
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Tool has no post-install command to run"


def test_enabled_tools_stay_visible_while_they_are_installed(db: Session) -> None:
    tool = _create_tool(db=db, status=ToolStatus.installing)
    user = create_random_user(db)

    # Searching for this tool by name keeps the test independent of how many
    # other tools the shared test database has accumulated.
    listed = tools_routes.read_tools(
        session=db, current_user=user, limit=1000, search=tool.name
    )

    assert tool.id in [candidate.id for candidate in listed.data]


def test_create_tool_keeps_the_threads_range(db: Session) -> None:
    tool = tools_routes.create_tool(
        session=db,
        current_user=create_random_user(db),
        tool_in=ToolCreate(
            name=f"tool-{random_lower_string()}",
            command="echo hello",
            min_cpus=3,
            max_cpus=8,
            default_cpus=4,
        ),
    )

    assert (tool.min_cpus, tool.max_cpus, tool.default_cpus) == (3, 8, 4)


def test_create_tool_rejects_an_unusable_threads_range(db: Session) -> None:
    with pytest.raises(HTTPException) as exc_info:
        tools_routes.create_tool(
            session=db,
            current_user=create_random_user(db),
            tool_in=ToolCreate(
                name=f"tool-{random_lower_string()}",
                command="echo hello",
                max_cpus=2,
                default_cpus=8,
            ),
        )

    assert exc_info.value.status_code == 422
    assert "default_cpus <= max_cpus" in exc_info.value.detail


def test_create_tool_rejects_a_minimum_above_the_default(db: Session) -> None:
    with pytest.raises(HTTPException) as exc_info:
        tools_routes.create_tool(
            session=db,
            current_user=create_random_user(db),
            tool_in=ToolCreate(
                name=f"tool-{random_lower_string()}",
                command="echo hello",
                min_cpus=5,
                max_cpus=8,
                default_cpus=2,
            ),
        )

    assert exc_info.value.status_code == 422
    assert "min_cpus <= default_cpus" in exc_info.value.detail


def test_update_tool_rejects_a_default_above_the_maximum(db: Session) -> None:
    tool = _create_tool(db=db, status=ToolStatus.installed)

    with pytest.raises(HTTPException) as exc_info:
        tools_routes.update_tool(
            session=db,
            tool_id=tool.id,
            tool_in=ToolUpdate(max_cpus=1, default_cpus=8),
        )

    assert exc_info.value.status_code == 422
    assert "default_cpus <= max_cpus" in exc_info.value.detail
    # The rejected update leaves the tool untouched.
    db.refresh(tool)
    assert (tool.min_cpus, tool.max_cpus, tool.default_cpus) == (1, None, None)
