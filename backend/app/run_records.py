"""Keeping a copy of finished runs, so the statistics outlive them.

The admin stats are generated from the runs, and the runs belong to their
owners - a user may delete them. Without a copy the numbers would drop with the
rows, so every run that reaches a terminal status is recorded here and the stats
are read from the records instead.
"""

from sqlmodel import Session

from app.models import Run, RunRecord, RunStatus

TERMINAL_STATUSES = frozenset(
    {RunStatus.completed, RunStatus.failed, RunStatus.cancelled}
)


def is_terminal(status: RunStatus | str) -> bool:
    """Whether a run in this status is finished, rather than still going."""
    if isinstance(status, RunStatus):
        return status in TERMINAL_STATUSES
    return status in {status.value for status in TERMINAL_STATUSES}


def record_run(session: Session, run: Run) -> RunRecord:
    """
    Copy, or refresh, the stats record of a finished run.

    Called wherever a run reaches a terminal status. Keyed by the run's id, so
    calling it twice is harmless, and it does not commit: the caller's commit
    writes the record with the run itself.
    """
    record = session.get(RunRecord, run.id)
    if record is None:
        record = RunRecord(id=run.id, status=run.status)
    record.owner_id = run.owner_id
    record.tool_id = run.tool_id
    record.tool_name = run.tool.name if run.tool else ""
    record.tool_version = run.tool_version
    record.status = run.status
    record.cpus = run.cpus
    record.params = dict(run.params or {})
    record.created_at = run.created_at
    record.started_at = run.started_at
    record.finished_at = run.finished_at
    session.add(record)
    return record
