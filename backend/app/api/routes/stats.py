from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, and_, func, select
from typing_extensions import TypedDict

from app.api.deps import CurrentUser, get_db
from app.models import File, Run, RunStatus, Tool, User

router = APIRouter()


# Response type definitions
class UserStats(TypedDict):
    total: int
    active: int
    superusers: int
    active_last_30_days: int


class FileStats(TypedDict):
    total: int
    saved: int
    temporary: int
    total_size_bytes: int
    saved_size_bytes: int
    temporary_size_bytes: int
    average_size_bytes: int
    total_size_gb: float
    saved_size_gb: float
    by_type: dict[str, int]


class RunStats(TypedDict):
    total: int
    by_status: dict[str, int]
    currently_running: int
    success_rate_percent: float
    average_runtime_seconds: int
    average_runtime_minutes: float
    last_24_hours: int


class ToolStats(TypedDict):
    total: int
    enabled: int
    disabled: int
    by_status: dict[str, int]
    most_popular: list[dict[str, Any]]
    most_favourited: list[dict[str, Any]]
    most_favourited: list[dict[str, Any]]


class SystemStats(TypedDict):
    users: UserStats
    files: FileStats
    runs: RunStats
    tools: ToolStats


class SummaryUserStats(TypedDict):
    total: int


class SummaryToolStats(TypedDict):
    total: int
    enabled: int


class SummaryRunStats(TypedDict):
    total: int
    currently_running: int


class SummaryFileStats(TypedDict):
    total: int
    total_size_gb: float


class StatsResponse(TypedDict):
    users: SummaryUserStats
    tools: SummaryToolStats
    runs: SummaryRunStats
    files: SummaryFileStats


@router.get("/stats")
def get_system_stats(
    session: Session = Depends(get_db),
    current_user: CurrentUser = None
) -> SystemStats:
    """
    Get comprehensive system statistics for admin panel.

    Returns statistics about users, files, runs, and tools.
    Requires superuser privileges.
    """

    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser access required")

    stats = {}
    stats.update(_get_user_stats(session))
    stats.update(_get_file_stats(session))
    stats.update(_get_run_stats(session))
    stats.update(_get_tool_stats(session))

    return stats


def _get_user_stats(session: Session) -> UserStats:
    """Get user-related statistics"""

    # Total users
    total_users = session.exec(select(func.count()).select_from(User)).one()

    # Active users
    active_users = session.exec(
        select(func.count()).select_from(User).where(User.is_active)
    ).one()

    # Superusers
    superusers = session.exec(
        select(func.count()).select_from(User).where(User.is_superuser)
    ).one()

    # Users with runs in last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    active_users_30d = session.exec(
        select(func.count(func.distinct(Run.owner_id)))
        .select_from(Run)
        .where(Run.created_at >= thirty_days_ago)
    ).one()

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "superusers": superusers,
            "active_last_30_days": active_users_30d,
        }
    }


def _get_file_stats(session: Session) -> FileStats:
    """Get file-related statistics"""

    # Total files
    total_files = session.exec(select(func.count()).select_from(File)).one()

    # Saved files only
    saved_files = session.exec(
        select(func.count()).select_from(File).where(File.saved)
    ).one()

    # Total size of all files
    total_size = session.exec(select(func.sum(File.size)).select_from(File)).one() or 0

    # Total size of saved files only
    saved_size = session.exec(
        select(func.sum(File.size)).select_from(File).where(File.saved)
    ).one() or 0

    # Average file size
    avg_size = total_size / total_files if total_files > 0 else 0

    # Files by type (top 10)
    file_types_query = (
        select(File.file_type, func.count().label('count'))
        .group_by(File.file_type)
        .order_by(func.count().desc())
        .limit(10)
    )
    file_types_result = session.exec(file_types_query).all()
    file_types = dict(file_types_result)

    return {
        "files": {
            "total": total_files,
            "saved": saved_files,
            "temporary": total_files - saved_files,
            "total_size_bytes": total_size,
            "saved_size_bytes": saved_size,
            "temporary_size_bytes": total_size - saved_size,
            "average_size_bytes": int(avg_size),
            "total_size_gb": round(total_size / (1024**3), 2),
            "saved_size_gb": round(saved_size / (1024**3), 2),
            "by_type": file_types,
        }
    }


def _get_run_stats(session: Session) -> RunStats:
    """Get run/job-related statistics"""

    # Total runs
    total_runs = session.exec(select(func.count()).select_from(Run)).one()

    # Runs by status
    runs_by_status_query = (
        select(Run.status, func.count().label('count'))
        .group_by(Run.status)
    )
    runs_by_status_result = session.exec(runs_by_status_query).all()
    runs_by_status = {status.value: count for status, count in runs_by_status_result}

    # Currently running
    running_runs = runs_by_status.get('running', 0)

    # Success rate
    completed_runs = runs_by_status.get('completed', 0)
    failed_runs = runs_by_status.get('failed', 0)
    finished_runs = completed_runs + failed_runs
    success_rate = (completed_runs / finished_runs * 100) if finished_runs > 0 else 0

    # Average runtime for completed runs
    avg_runtime_query = (
        select(func.avg(
            func.extract('epoch', Run.finished_at) - func.extract('epoch', Run.started_at)
        ))
        .where(and_(
            Run.status == RunStatus.completed,
            Run.started_at.is_not(None),
            Run.finished_at.is_not(None)
        ))
    )
    avg_runtime_seconds = session.exec(avg_runtime_query).one() or 0

    # Runs in last 24 hours
    twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)
    runs_24h = session.exec(
        select(func.count()).select_from(Run).where(Run.created_at >= twenty_four_hours_ago)
    ).one()

    return {
        "runs": {
            "total": total_runs,
            "by_status": runs_by_status,
            "currently_running": running_runs,
            "success_rate_percent": round(success_rate, 2),
            "average_runtime_seconds": int(avg_runtime_seconds),
            "average_runtime_minutes": round(avg_runtime_seconds / 60, 2),
            "last_24_hours": runs_24h,
        }
    }


def _get_tool_stats(session: Session) -> ToolStats:
    """Get tool-related statistics"""

    # Total tools
    total_tools = session.exec(select(func.count()).select_from(Tool)).one()

    # Tools by status
    tools_by_status_query = (
        select(Tool.status, func.count().label('count'))
        .group_by(Tool.status)
    )
    tools_by_status_result = session.exec(tools_by_status_query).all()
    tools_by_status = {status.value: count for status, count in tools_by_status_result}

    # Enabled tools
    enabled_tools = session.exec(
        select(func.count()).select_from(Tool).where(Tool.enabled)
    ).one()

    # Most popular tools (by run count)
    popular_tools_query = (
        select(Tool.name, Tool.run_count)
        .order_by(Tool.run_count.desc())
        .limit(10)
    )
    popular_tools_result = session.exec(popular_tools_query).all()
    popular_tools = [{"name": name, "count": count} for name, count in popular_tools_result]

    # Most favourited tools
    favourited_tools_query = (
        select(Tool.name, Tool.favourited_count)
        .order_by(Tool.favourited_count.desc())
        .limit(10)
    )
    favourited_tools_result = session.exec(favourited_tools_query).all()
    favourited_tools = [{"name": name, "count": count} for name, count in favourited_tools_result]

    return {
        "tools": {
            "total": total_tools,
            "enabled": enabled_tools,
            "disabled": total_tools - enabled_tools,
            "by_status": tools_by_status,
            "most_popular": popular_tools,
            "most_favourited": favourited_tools,
        }
    }


@router.get("/stats/summary")
def get_stats_summary(
    session: Session = Depends(get_db),
    current_user: CurrentUser = None,
) -> StatsResponse:
    """
    Get a summary of key system statistics for admin panel.

    Returns a condensed view of the most important metrics.
    Requires superuser privileges.
    """

    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser access required")

    # System summary stats for admin panel
    total_users = session.exec(select(func.count()).select_from(User)).one()
    total_tools = session.exec(select(func.count()).select_from(Tool)).one()
    enabled_tools = session.exec(
        select(func.count()).select_from(Tool).where(Tool.enabled)
    ).one()
    total_runs = session.exec(select(func.count()).select_from(Run)).one()
    running_runs = session.exec(
        select(func.count()).select_from(Run).where(Run.status == RunStatus.running)
    ).one()
    total_files = session.exec(select(func.count()).select_from(File)).one()
    total_size = session.exec(select(func.sum(File.size)).select_from(File)).one() or 0

    return {
        "users": {"total": total_users},
        "tools": {
            "total": total_tools,
            "enabled": enabled_tools,
        },
        "runs": {
            "total": total_runs,
            "currently_running": running_runs,
        },
        "files": {
            "total": total_files,
            "total_size_gb": round(total_size / (1024**3), 2),
        },
    }
