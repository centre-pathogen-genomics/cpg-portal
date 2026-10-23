"""Decide which queued runs may start.

Every run reserves a number of CPUs (threads) and the worker only hands out
``TOTAL_CPUS`` of them, so a run stays ``pending`` until the CPUs it asked for
are free: with 10 CPUs and three runs asking for 5, two start and the third
waits for one of them to finish.
"""

import os

from sqlalchemy import func, text
from sqlmodel import Session, select

from app.core.app_settings import get_or_create_app_settings
from app.core.config import settings
from app.models import Run, RunStatus

# Serializes the dispatch decision across workers, see dispatch_pending_runs.
DISPATCH_LOCK_KEY = 8152531


def total_cpus() -> int:
    """CPUs the worker hands out to runs."""
    if settings.TOTAL_CPUS > 0:
        return settings.TOTAL_CPUS
    # process_cpu_count respects the CPUs this process may use, unlike
    # cpu_count which reports the whole machine.
    return os.process_cpu_count() or os.cpu_count() or 1


def _sum_cpus(session: Session, statement) -> int:
    return int(session.exec(statement).one())


def reserved_cpus(session: Session) -> int:
    """CPUs reserved by runs that are running or already on their way."""
    running = _sum_cpus(
        session,
        select(func.coalesce(func.sum(Run.cpus), 0)).where(
            Run.status == RunStatus.running
        ),
    )
    # Dispatched runs hold their CPUs before they start, otherwise a burst of
    # submissions would each be told that everything is still free.
    dispatched = _sum_cpus(
        session,
        select(func.coalesce(func.sum(Run.cpus), 0))
        .where(Run.status == RunStatus.pending)
        .where(Run.taskiq_id.is_not(None)),
    )
    return running + dispatched


async def dispatch_pending_runs(session: Session) -> list[Run]:
    """Start pending runs while there are CPUs left for them.

    Runs that do not fit are skipped, so a smaller run behind a large one still
    starts. Returns the runs that were dispatched.
    """
    # Imported here because app.tasks imports this module.
    from app.tasks import run_tool

    app_settings = get_or_create_app_settings(session)
    if app_settings.queue_paused:
        return []

    # Two workers finishing at the same time must not both conclude that the
    # same CPUs are free, so the decision runs under a single lock.
    session.execute(
        text("SELECT pg_advisory_xact_lock(:key)"), {"key": DISPATCH_LOCK_KEY}
    )

    available = total_cpus() - reserved_cpus(session)
    pending_runs = session.exec(
        select(Run)
        .where(Run.status == RunStatus.pending)
        .where(Run.taskiq_id.is_(None))
        .where(Run.command.is_not(None))
        .order_by(Run.created_at)
    ).all()

    dispatched: list[Run] = []
    for run in pending_runs:
        if run.cpus > available:
            continue
        taskiq_task = await run_tool.kiq(run.id, run.command)
        run.taskiq_id = taskiq_task.task_id
        session.add(run)
        available -= run.cpus
        dispatched.append(run)
        print(f"Dispatching Run(id={run.id}) with {run.cpus} cpus")

    session.commit()
    return dispatched
