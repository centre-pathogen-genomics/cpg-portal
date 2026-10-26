from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlmodel import SQLModel, func, select

from app.api.deps import SessionDep, get_current_active_superuser
from app.core.app_settings import get_or_create_app_settings
from app.models import Run, RunStatus
from app.scheduling import dispatch_pending_runs, reserved_cpus, total_cpus

router = APIRouter(
    dependencies=[Depends(get_current_active_superuser)],
)


class QueueStatus(SQLModel):
    queue_paused: bool
    queue_paused_at: datetime | None = None
    queue_pause_reason: str | None = None
    pending_runs: int
    running_runs: int
    # CPUs the worker hands out, and how many of them runs hold right now.
    total_cpus: int = 0
    reserved_cpus: int = 0


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
        total_cpus=total_cpus(),
        reserved_cpus=reserved_cpus(session),
    )


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
    # Runs queued while the queue was paused, and whatever else is waiting for
    # CPUs to free up.
    await dispatch_pending_runs(session)
    return _queue_status(session)
