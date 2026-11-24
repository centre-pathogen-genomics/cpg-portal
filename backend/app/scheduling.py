"""Decide which queued runs may start.

Every run reserves a number of CPUs and the worker only hands out
``TOTAL_CPUS`` of them, so a run stays ``pending`` until the CPUs it asked for
are free: with 10 CPUs and three runs asking for 5, two start and the third
waits for one of them to finish.
"""

import os
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, text, update
from sqlmodel import Session, select

from app.core.app_settings import get_or_create_app_settings
from app.core.config import settings
from app.models import Run, RunStatus, ToolStatus

# Serializes the dispatch decision across workers, see dispatch_pending_runs.
DISPATCH_LOCK_KEY = 8152531

# A pending run whose claimed task has not started within this long is
# considered dead: the sweep forgets its taskiq_id so a later dispatch hands
# the run out again instead of leaving it wedged with reserved CPUs.
STALE_CLAIM_MINUTES = 30
# How often the lifespan sweeper looks for stale claims. Capped at 35 minutes
# of wedge time even if a sweep is due right after a claim goes stale.
STALE_CLAIM_SWEEP_INTERVAL_SECONDS = 5 * 60


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


def _take_dispatch_lock(session: Session) -> None:
    """Serialize the dispatch decision across processes.

    Holds until the caller's transaction commits or rolls back
    (pg_advisory_xact_lock), so the whole claim+dispatch is one decision.
    """
    session.execute(
        text("SELECT pg_advisory_xact_lock(:key)"), {"key": DISPATCH_LOCK_KEY}
    )


async def _dispatch_pending_runs(session: Session) -> list[Run]:
    """Start pending runs while there are CPUs left for them.

    The caller holds the dispatch lock, has decided the queue is not paused,
    and owns the commit. Returns the runs that were dispatched.
    """
    # Imported here because app.tasks imports this module.
    from app.tasks import run_tool

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
        # A run whose tool is still being installed or updated waits in the
        # queue: the environment it needs is not there yet.
        if run.tool.status != ToolStatus.installed:
            continue
        if run.cpus > available:
            continue
        taskiq_task = await run_tool.kiq(run.id, run.command)
        # Claim the run atomically: the task is already in the broker, so the
        # row must not be picked up again if the process dies before the next
        # commit. If zero rows were claimed, the run changed while kiq was in
        # flight (started elsewhere, cancelled, ...): the delivery will no-op
        # in run_tool, and its CPUs must not be counted twice here either.
        claimed = session.execute(
            text(
                "UPDATE run SET taskiq_id = :tid"
                " WHERE id = :id AND status = 'pending'"
            ),
            {"tid": taskiq_task.task_id, "id": run.id},
        )
        if claimed.rowcount == 0:
            continue
        available -= run.cpus
        # Drop the stale in-memory taskiq_id so callers of the returned list
        # see the claimed value without an explicit refresh.
        session.expire(run)
        dispatched.append(run)
        print(f"Dispatching Run(id={run.id}) with {run.cpus} cpus")

    return dispatched


async def dispatch_pending_runs(session: Session) -> list[Run]:
    """Start pending runs while there are CPUs left for them.

    Runs that do not fit are skipped, so a smaller run behind a large one still
    starts. Returns the runs that were dispatched.
    """
    app_settings = get_or_create_app_settings(session)
    if app_settings.queue_paused:
        return []

    # Two workers finishing at the same time must not both conclude that the
    # same CPUs are free, so the decision runs under a single lock.
    _take_dispatch_lock(session)
    dispatched = await _dispatch_pending_runs(session)
    session.commit()
    return dispatched


def _forget_pending_claims(session: Session, older_than: timedelta | None) -> int:
    """Forget the taskiq ids of pending runs, making them re-dispatchable.

    ``older_than`` limits the sweep to claims that have been outstanding for
    a while; None forgets every claim (used at startup, when the worker that
    held them is gone). Returns how many claims were cleared.
    """
    statement = (
        update(Run)
        .where(Run.status == RunStatus.pending)
        .where(Run.taskiq_id.is_not(None))
    )
    if older_than is not None:
        cutoff = datetime.now(UTC).replace(tzinfo=None) - older_than
        statement = statement.where(Run.created_at < cutoff)
    result = session.execute(statement.values(taskiq_id=None))
    return result.rowcount or 0


async def sweep_stale_claims(session: Session) -> int:
    """Re-queue pending runs whose claimed task never started.

    A run is wedged when its task died before run_tool could flip it to
    running: its taskiq_id stays set, dispatch skips it and its CPUs stay
    reserved. This forgets claims older than STALE_CLAIM_MINUTES and hands the
    runs out again. Runs under the dispatch lock, like dispatch_pending_runs,
    so two replicas cannot race the clear against a re-dispatch. Returns the
    number of claims that were cleared.
    """
    app_settings = get_or_create_app_settings(session)
    _take_dispatch_lock(session)
    cleared = _forget_pending_claims(
        session, older_than=timedelta(minutes=STALE_CLAIM_MINUTES)
    )
    if cleared:
        print(f"Cleared {cleared} stale run claim(s)")
    if not app_settings.queue_paused:
        await _dispatch_pending_runs(session)
    session.commit()
    return cleared


async def recover_pending_claims(session: Session) -> None:
    """Forget every pending run's claim and hand the runs out again.

    Called at startup: the worker that held the claims is gone, so its
    deliveries never start. The clear and the re-dispatch run under the
    dispatch lock, so two replicas starting at once cannot both re-dispatch
    the same run.
    """
    app_settings = get_or_create_app_settings(session)
    _take_dispatch_lock(session)
    _forget_pending_claims(session, older_than=None)
    if not app_settings.queue_paused:
        await _dispatch_pending_runs(session)
    session.commit()
