from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlmodel import SQLModel, func, select

from app.api.deps import SessionDep, get_current_active_superuser
from app.core.app_settings import get_or_create_app_settings
from app.models import Run, RunStatus
from app.tasks import run_tool

router = APIRouter(
    dependencies=[Depends(get_current_active_superuser)],
)


class QueueStatus(SQLModel):
    queue_paused: bool
    queue_paused_at: datetime | None = None
    queue_pause_reason: str | None = None
    pending_runs: int
    running_runs: int


class QueuePauseRequest(SQLModel):
    reason: str | None = Field(default=None, max_length=500)


def _active_run_count(session: SessionDep, status: RunStatus) -> int:
    return session.exec(
        select(func.count()).select_from(Run).where(Run.status == status)
    ).one()


def _queue_status(session: SessionDep) -> QueueStatus:
    app_settings = get_or_create_app_settings(session)
    return QueueStatus(
        queue_paused=app_settings.queue_paused,
        queue_paused_at=app_settings.queue_paused_at,
        queue_pause_reason=app_settings.queue_pause_reason,
        pending_runs=_active_run_count(session, RunStatus.pending),
        running_runs=_active_run_count(session, RunStatus.running),
    )


async def _dispatch_pending_runs(session: SessionDep) -> None:
    pending_runs = session.exec(
        select(Run)
        .where(Run.status == RunStatus.pending)
        .where(Run.taskiq_id.is_(None))
        .where(Run.command.is_not(None))
    ).all()
    for run in pending_runs:
        taskiq_task = await run_tool.kiq(run.id, run.command)
        run.taskiq_id = taskiq_task.task_id
        session.add(run)
    session.commit()


@router.get("/queue", response_model=QueueStatus)
def read_queue_status(session: SessionDep) -> QueueStatus:
    return _queue_status(session)


@router.post("/queue/pause", response_model=QueueStatus)
def pause_queue(
    session: SessionDep,
    body: QueuePauseRequest,
) -> QueueStatus:
    app_settings = get_or_create_app_settings(session)
    app_settings.queue_paused = True
    app_settings.queue_paused_at = datetime.utcnow()
    app_settings.queue_pause_reason = body.reason.strip() if body.reason else None
    session.add(app_settings)
    session.commit()
    return _queue_status(session)


@router.post("/queue/resume", response_model=QueueStatus)
async def resume_queue(session: SessionDep) -> QueueStatus:
    app_settings = get_or_create_app_settings(session)
    app_settings.queue_paused = False
    app_settings.queue_paused_at = None
    app_settings.queue_pause_reason = None
    session.add(app_settings)
    session.commit()
    await _dispatch_pending_runs(session)
    return _queue_status(session)
