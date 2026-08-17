import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import Session, SQLModel, and_, func, select

from app.api.deps import SessionDep, SuperUser
from app.models import File, Run, RunStatus, Tool, ToolPublic, User, UserPublic

router = APIRouter()


class CountItem(SQLModel):
    name: str
    count: int


class UserUsage(SQLModel):
    id: uuid.UUID
    email: str
    full_name: str | None = None
    count: int


class RecentRun(SQLModel):
    id: uuid.UUID
    name: str | None = None
    tool_name: str
    owner_email: str
    status: RunStatus
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None


class UserStats(SQLModel):
    total: int
    active: int
    superusers: int
    active_last_30_days: int


class FileStats(SQLModel):
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


class RunStats(SQLModel):
    total: int
    by_status: dict[str, int]
    currently_running: int
    success_rate_percent: float
    average_runtime_seconds: int
    average_runtime_minutes: float
    last_24_hours: int


class ToolStats(SQLModel):
    total: int
    enabled: int
    disabled: int
    by_status: dict[str, int]
    most_popular: list[CountItem]
    most_favourited: list[CountItem]


class SystemStats(SQLModel):
    users: UserStats
    files: FileStats
    runs: RunStats
    tools: ToolStats


class SummaryUserStats(SQLModel):
    total: int


class SummaryToolStats(SQLModel):
    total: int
    enabled: int


class SummaryRunStats(SQLModel):
    total: int
    currently_running: int


class SummaryFileStats(SQLModel):
    total: int
    total_size_gb: float


class StatsResponse(SQLModel):
    users: SummaryUserStats
    tools: SummaryToolStats
    runs: SummaryRunStats
    files: SummaryFileStats


class UserDetailStats(SQLModel):
    user: UserPublic
    runs: RunStats
    files: FileStats
    top_tools: list[CountItem]
    recent_runs: list[RecentRun]


class ToolDetailStats(SQLModel):
    tool: ToolPublic
    runs: RunStats
    top_users: list[UserUsage]
    recent_runs: list[RecentRun]


def _validate_date_range(start: datetime | None, end: datetime | None) -> None:
    if start and end and start > end:
        raise HTTPException(status_code=400, detail="start must be before end")


def _run_filters(
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    owner_id: uuid.UUID | None = None,
    tool_id: uuid.UUID | None = None,
) -> list[Any]:
    filters: list[Any] = []
    if start:
        filters.append(Run.created_at >= start)
    if end:
        filters.append(Run.created_at <= end)
    if owner_id:
        filters.append(Run.owner_id == owner_id)
    if tool_id:
        filters.append(Run.tool_id == tool_id)
    return filters


def _run_where(
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    owner_id: uuid.UUID | None = None,
    tool_id: uuid.UUID | None = None,
) -> Any | None:
    filters = _run_filters(start=start, end=end, owner_id=owner_id, tool_id=tool_id)
    return and_(*filters) if filters else None


def _get_run_stats(
    session: Session,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    owner_id: uuid.UUID | None = None,
    tool_id: uuid.UUID | None = None,
) -> RunStats:
    where_clause = _run_where(start=start, end=end, owner_id=owner_id, tool_id=tool_id)

    total_query = select(func.count()).select_from(Run)
    status_query = select(Run.status, func.count().label("count")).group_by(Run.status)
    avg_runtime_query = select(
        func.avg(
            func.extract("epoch", Run.finished_at)
            - func.extract("epoch", Run.started_at)
        )
    ).where(
        Run.status == RunStatus.completed,
        Run.started_at.is_not(None),
        Run.finished_at.is_not(None),
    )
    runs_24h_query = select(func.count()).select_from(Run).where(
        Run.created_at >= datetime.utcnow() - timedelta(hours=24)
    )

    if where_clause is not None:
        total_query = total_query.where(where_clause)
        status_query = status_query.where(where_clause)
        avg_runtime_query = avg_runtime_query.where(where_clause)
        runs_24h_query = runs_24h_query.where(where_clause)

    total_runs = session.exec(total_query).one()
    runs_by_status = {
        status.value: count for status, count in session.exec(status_query).all()
    }
    completed_runs = runs_by_status.get("completed", 0)
    failed_runs = runs_by_status.get("failed", 0)
    finished_runs = completed_runs + failed_runs
    success_rate = (completed_runs / finished_runs * 100) if finished_runs else 0
    avg_runtime_seconds = session.exec(avg_runtime_query).one() or 0
    runs_24h = session.exec(runs_24h_query).one()

    return RunStats(
        total=total_runs,
        by_status=runs_by_status,
        currently_running=runs_by_status.get("running", 0),
        success_rate_percent=round(success_rate, 2),
        average_runtime_seconds=int(avg_runtime_seconds),
        average_runtime_minutes=round(avg_runtime_seconds / 60, 2),
        last_24_hours=runs_24h,
    )


def _get_user_stats(
    session: Session,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
) -> UserStats:
    total_users = session.exec(select(func.count()).select_from(User)).one()
    active_users = session.exec(
        select(func.count()).select_from(User).where(User.is_active)
    ).one()
    superusers = session.exec(
        select(func.count()).select_from(User).where(User.is_superuser)
    ).one()

    activity_start = start or (datetime.utcnow() - timedelta(days=30))
    active_users_query = (
        select(func.count(func.distinct(Run.owner_id)))
        .select_from(Run)
        .where(Run.created_at >= activity_start)
    )
    if end:
        active_users_query = active_users_query.where(Run.created_at <= end)
    active_users_in_range = session.exec(active_users_query).one()

    return UserStats(
        total=total_users,
        active=active_users,
        superusers=superusers,
        active_last_30_days=active_users_in_range,
    )


def _get_file_stats(
    session: Session,
    *,
    owner_id: uuid.UUID | None = None,
) -> FileStats:
    where_clause = and_(File.owner_id == owner_id) if owner_id else None

    total_query = select(func.count()).select_from(File)
    saved_query = select(func.count()).select_from(File).where(File.saved)
    total_size_query = select(func.sum(File.size)).select_from(File)
    saved_size_query = select(func.sum(File.size)).select_from(File).where(File.saved)
    file_types_query = (
        select(File.file_type, func.count().label("count"))
        .group_by(File.file_type)
        .order_by(func.count().desc())
        .limit(10)
    )
    if where_clause is not None:
        total_query = total_query.where(where_clause)
        saved_query = saved_query.where(where_clause)
        total_size_query = total_size_query.where(where_clause)
        saved_size_query = saved_size_query.where(where_clause)
        file_types_query = file_types_query.where(where_clause)

    total_files = session.exec(total_query).one()
    saved_files = session.exec(saved_query).one()
    total_size = session.exec(total_size_query).one() or 0
    saved_size = session.exec(saved_size_query).one() or 0
    avg_size = total_size / total_files if total_files > 0 else 0

    return FileStats(
        total=total_files,
        saved=saved_files,
        temporary=total_files - saved_files,
        total_size_bytes=total_size,
        saved_size_bytes=saved_size,
        temporary_size_bytes=total_size - saved_size,
        average_size_bytes=int(avg_size),
        total_size_gb=round(total_size / (1024**3), 2),
        saved_size_gb=round(saved_size / (1024**3), 2),
        by_type=dict(session.exec(file_types_query).all()),
    )


def _get_tool_stats(
    session: Session,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
) -> ToolStats:
    total_tools = session.exec(select(func.count()).select_from(Tool)).one()
    enabled_tools = session.exec(
        select(func.count()).select_from(Tool).where(Tool.enabled)
    ).one()
    tools_by_status = {
        status.value: count
        for status, count in session.exec(
            select(Tool.status, func.count().label("count")).group_by(Tool.status)
        ).all()
    }

    run_where = _run_where(start=start, end=end)
    popular_tools_query = (
        select(Tool.name, func.count(Run.id).label("count"))
        .join(Run, Run.tool_id == Tool.id)
        .group_by(Tool.id, Tool.name)
        .order_by(func.count(Run.id).desc())
        .limit(10)
    )
    if run_where is not None:
        popular_tools_query = popular_tools_query.where(run_where)

    return ToolStats(
        total=total_tools,
        enabled=enabled_tools,
        disabled=total_tools - enabled_tools,
        by_status=tools_by_status,
        most_popular=[
            CountItem(name=name, count=count)
            for name, count in session.exec(popular_tools_query).all()
        ],
        most_favourited=[
            CountItem(name=name, count=count)
            for name, count in session.exec(
                select(Tool.name, Tool.favourited_count)
                .order_by(Tool.favourited_count.desc())
                .limit(10)
            ).all()
        ],
    )


def _recent_runs(
    session: Session,
    *,
    owner_id: uuid.UUID | None = None,
    tool_id: uuid.UUID | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[RecentRun]:
    where_clause = _run_where(start=start, end=end, owner_id=owner_id, tool_id=tool_id)
    query = (
        select(Run, Tool.name, User.email)
        .join(Tool, Run.tool_id == Tool.id)
        .join(User, Run.owner_id == User.id)
        .order_by(Run.created_at.desc())
        .limit(10)
    )
    if where_clause is not None:
        query = query.where(where_clause)

    return [
        RecentRun(
            id=run.id,
            name=run.name,
            tool_name=tool_name,
            owner_email=owner_email,
            status=run.status,
            created_at=run.created_at,
            started_at=run.started_at,
            finished_at=run.finished_at,
        )
        for run, tool_name, owner_email in session.exec(query).all()
    ]


@router.get("/stats", response_model=SystemStats)
def get_system_stats(
    session: SessionDep,
    _current_user: SuperUser,
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
) -> SystemStats:
    _validate_date_range(start, end)
    return SystemStats(
        users=_get_user_stats(session, start=start, end=end),
        files=_get_file_stats(session),
        runs=_get_run_stats(session, start=start, end=end),
        tools=_get_tool_stats(session, start=start, end=end),
    )


@router.get("/stats/summary", response_model=StatsResponse)
def get_stats_summary(
    session: SessionDep,
    _current_user: SuperUser,
) -> StatsResponse:
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

    return StatsResponse(
        users=SummaryUserStats(total=total_users),
        tools=SummaryToolStats(total=total_tools, enabled=enabled_tools),
        runs=SummaryRunStats(total=total_runs, currently_running=running_runs),
        files=SummaryFileStats(
            total=total_files,
            total_size_gb=round(total_size / (1024**3), 2),
        ),
    )


@router.get("/users/{user_id}", response_model=UserDetailStats)
def get_user_detail_stats(
    session: SessionDep,
    _current_user: SuperUser,
    user_id: uuid.UUID,
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
) -> UserDetailStats:
    _validate_date_range(start, end)
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    top_tools_query = (
        select(Tool.name, func.count(Run.id).label("count"))
        .join(Run, Run.tool_id == Tool.id)
        .where(Run.owner_id == user_id)
        .group_by(Tool.id, Tool.name)
        .order_by(func.count(Run.id).desc())
        .limit(10)
    )
    run_where = _run_where(start=start, end=end, owner_id=user_id)
    if run_where is not None:
        top_tools_query = top_tools_query.where(run_where)

    return UserDetailStats(
        user=UserPublic.model_validate(user),
        runs=_get_run_stats(session, start=start, end=end, owner_id=user_id),
        files=_get_file_stats(session, owner_id=user_id),
        top_tools=[
            CountItem(name=name, count=count)
            for name, count in session.exec(top_tools_query).all()
        ],
        recent_runs=_recent_runs(session, owner_id=user_id, start=start, end=end),
    )


@router.get("/tools/{tool_id}", response_model=ToolDetailStats)
def get_tool_detail_stats(
    session: SessionDep,
    _current_user: SuperUser,
    tool_id: uuid.UUID,
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
) -> ToolDetailStats:
    _validate_date_range(start, end)
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    top_users_query = (
        select(User.id, User.email, User.full_name, func.count(Run.id).label("count"))
        .join(Run, Run.owner_id == User.id)
        .where(Run.tool_id == tool_id)
        .group_by(User.id, User.email, User.full_name)
        .order_by(func.count(Run.id).desc())
        .limit(10)
    )
    run_where = _run_where(start=start, end=end, tool_id=tool_id)
    if run_where is not None:
        top_users_query = top_users_query.where(run_where)

    return ToolDetailStats(
        tool=ToolPublic.model_validate(tool),
        runs=_get_run_stats(session, start=start, end=end, tool_id=tool_id),
        top_users=[
            UserUsage(id=user_id, email=email, full_name=full_name, count=count)
            for user_id, email, full_name, count in session.exec(top_users_query).all()
        ],
        recent_runs=_recent_runs(session, tool_id=tool_id, start=start, end=end),
    )
