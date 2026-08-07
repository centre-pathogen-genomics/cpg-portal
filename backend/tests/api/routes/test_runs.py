from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlmodel import Session

from app.api.routes.runs import read_run_tool_names, read_runs
from app.models import Run, RunStatus, Tool, ToolStatus, User
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def _utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _create_tool(*, db: Session, owner: User) -> Tool:
    tool = Tool(
        name=f"tool-{random_lower_string()}",
        command="echo hello",
        enabled=True,
        status=ToolStatus.installed,
        owner_id=owner.id,
    )
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return tool


def _create_run(
    *,
    db: Session,
    owner: User,
    tool: Tool,
    name: str,
    status: RunStatus,
    created_at: datetime,
    finished_at: datetime | None = None,
) -> Run:
    run = Run(
        name=name,
        status=status,
        created_at=created_at,
        started_at=created_at,
        finished_at=finished_at,
        params={},
        tool_id=tool.id,
        owner_id=owner.id,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def test_read_runs_filters_by_name_and_sorts(db: Session) -> None:
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    prefix = random_lower_string()

    older = _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"{prefix}-beta",
        status=RunStatus.completed,
        created_at=_utc_now() - timedelta(days=1),
    )
    newer = _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"{prefix}-alpha",
        status=RunStatus.failed,
        created_at=_utc_now(),
    )
    _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"{prefix}-unmatched",
        status=RunStatus.pending,
        created_at=_utc_now(),
    )

    result = read_runs(
        session=db,
        current_user=owner,
        name=prefix.upper(),
        order_by="name",
        tool_name=None,
    )

    assert result.count == 3
    assert [item.id for item in result.data[:2]] == [newer.id, older.id]


def test_read_runs_rejects_unknown_sort_column(db: Session) -> None:
    owner = create_random_user(db)

    with pytest.raises(HTTPException) as exc_info:
        read_runs(
            session=db,
            current_user=owner,
            order_by="owner_id",
            name=None,
            tool_name=None,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid column name: owner_id"


def test_read_runs_sorts_by_runtime(db: Session) -> None:
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    started_at = _utc_now() - timedelta(hours=2)
    shorter = _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"short-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=started_at,
        finished_at=started_at + timedelta(minutes=5),
    )
    longer = _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"long-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=started_at,
        finished_at=started_at + timedelta(minutes=30),
    )

    result = read_runs(
        session=db,
        current_user=owner,
        order_by="-runtime",
        name=None,
        tool_name=None,
    )

    assert [item.id for item in result.data[:2]] == [longer.id, shorter.id]


def test_read_runs_filters_by_tool_name(db: Session) -> None:
    owner = create_random_user(db)
    selected_tool = _create_tool(db=db, owner=owner)
    other_tool = _create_tool(db=db, owner=owner)

    matching = _create_run(
        db=db,
        owner=owner,
        tool=selected_tool,
        name=f"matching-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )
    _create_run(
        db=db,
        owner=owner,
        tool=other_tool,
        name=f"other-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )

    result = read_runs(
        session=db,
        current_user=owner,
        order_by="-created_at",
        name=None,
        tool_name=selected_tool.name,
    )

    assert result.count == 1
    assert result.data[0].id == matching.id


def test_read_run_tool_names_includes_only_current_users_run_tools(db: Session) -> None:
    owner = create_random_user(db)
    other_user = create_random_user(db)
    used_tool = _create_tool(db=db, owner=owner)
    unused_tool = _create_tool(db=db, owner=owner)
    other_users_tool = _create_tool(db=db, owner=other_user)

    _create_run(
        db=db,
        owner=owner,
        tool=used_tool,
        name=f"used-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )
    _create_run(
        db=db,
        owner=other_user,
        tool=other_users_tool,
        name=f"other-user-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )

    tool_names = read_run_tool_names(session=db, current_user=owner)

    assert used_tool.name in tool_names
    assert unused_tool.name not in tool_names
    assert other_users_tool.name not in tool_names
