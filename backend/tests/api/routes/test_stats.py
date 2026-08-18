from datetime import UTC, datetime, timedelta

from sqlmodel import Session

from app.api.routes.stats import (
    get_system_stats,
    get_tool_detail_stats,
    get_user_detail_stats,
)
from app.models import Run, RunStatus, Tool, ToolStatus
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def _utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


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


def _create_run(
    *,
    db: Session,
    owner_id,
    tool_id,
    status: RunStatus,
    created_at: datetime,
) -> Run:
    run = Run(
        status=status,
        created_at=created_at,
        started_at=created_at,
        finished_at=created_at + timedelta(minutes=5)
        if status == RunStatus.completed
        else None,
        params={},
        tool_id=tool_id,
        owner_id=owner_id,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def test_system_stats_date_filter_applies_to_runs(db: Session) -> None:
    user = create_random_user(db)
    tool = _create_tool(db)
    now = _utc_now() + timedelta(days=365 * 50)
    _create_run(
        db=db,
        owner_id=user.id,
        tool_id=tool.id,
        status=RunStatus.completed,
        created_at=now,
    )
    _create_run(
        db=db,
        owner_id=user.id,
        tool_id=tool.id,
        status=RunStatus.failed,
        created_at=now - timedelta(days=10),
    )

    stats = get_system_stats(
        session=db,
        _current_user=user,
        start=now - timedelta(microseconds=1),
        end=now + timedelta(microseconds=1),
    )

    assert stats.runs.total == 1
    assert stats.runs.by_status["completed"] == 1
    assert "failed" not in stats.runs.by_status
    assert stats.tools.most_popular[0].name == tool.name
    assert stats.tools.most_popular[0].count == 1


def test_user_and_tool_drilldowns_return_filtered_stats(
    db: Session,
) -> None:
    user = create_random_user(db)
    other_user = create_random_user(db)
    tool = _create_tool(db)
    other_tool = _create_tool(db)
    now = _utc_now()
    _create_run(
        db=db,
        owner_id=user.id,
        tool_id=tool.id,
        status=RunStatus.completed,
        created_at=now - timedelta(hours=1),
    )
    _create_run(
        db=db,
        owner_id=user.id,
        tool_id=other_tool.id,
        status=RunStatus.completed,
        created_at=now - timedelta(days=5),
    )
    _create_run(
        db=db,
        owner_id=other_user.id,
        tool_id=tool.id,
        status=RunStatus.completed,
        created_at=now - timedelta(hours=2),
    )

    user_data = get_user_detail_stats(
        session=db,
        _current_user=user,
        user_id=user.id,
        start=now - timedelta(days=1),
        end=now,
    )
    tool_data = get_tool_detail_stats(
        session=db,
        _current_user=user,
        tool_id=tool.id,
        start=now - timedelta(days=1),
        end=now,
    )

    assert user_data.user.id == user.id
    assert user_data.runs.total == 1
    assert user_data.top_tools[0].name == tool.name

    assert tool_data.tool.id == tool.id
    assert tool_data.runs.total == 2
    assert {item.email for item in tool_data.top_users} >= {
        user.email,
        other_user.email,
    }
