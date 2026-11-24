import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel import Session, select

from app.core.db import engine
from app.core.rbac import sync_rbac
from app.models import Run, RunStatus, Tool, ToolStatus
from app.run_records import record_run
from app.scheduling import (
    STALE_CLAIM_SWEEP_INTERVAL_SECONDS,
    recover_pending_claims,
    sweep_stale_claims,
)
from app.tasks import install_tool, update_tool
from app.tkq import broker
from app.wsmanager import manager


async def recover_interrupted_tasks(session: Session) -> None:
    """Recover durable task intent stored in Postgres after app startup."""
    running_runs = session.exec(
        select(Run).where(Run.status == RunStatus.running)
    ).all()
    for run in running_runs:
        print(f"Run(id={run.id}) is running. Cancelling...")
        run.status = RunStatus.cancelled
        run.stdout = "Run was cancelled due to server restart."
        session.add(run)
        record_run(session, run)

    # Runs that were dispatched to the previous worker are pending again: their
    # task is gone, so forget its id and let the scheduler hand out CPUs to
    # whatever fits now. The whole recovery+dispatch runs under the dispatch
    # lock, so two replicas starting at once cannot both re-dispatch the same
    # runs.
    await recover_pending_claims(session)

    installing_tools = session.exec(
        select(Tool).where(Tool.status == ToolStatus.installing)
    ).all()
    for tool in installing_tools:
        print(f"Tool(id={tool.id}) was installing. Marking failed...")
        tool.status = ToolStatus.failed
        tool.installation_log = (
            "Tool installation was interrupted by server restart. "
            "Please retry installation."
        )
        session.add(tool)

    # An interrupted update may have half-finished its work - a database it was
    # downloading, for instance - so the tool is not trusted until it is
    # updated again.
    updating_tools = session.exec(
        select(Tool).where(Tool.status == ToolStatus.updating)
    ).all()
    for tool in updating_tools:
        print(f"Tool(id={tool.id}) was updating. Marking failed...")
        tool.status = ToolStatus.failed
        tool.installation_log = (
            "Tool update was interrupted by server restart and may have left "
            "partial data behind. Please retry the update."
        )
        session.add(tool)

    queued_tools = session.exec(
        select(Tool).where(Tool.status == ToolStatus.install_queued)
    ).all()
    for tool in queued_tools:
        print(f"Tool(id={tool.id}) install is queued. Restarting...")
        tool.installation_log = ""
        taskiq_task = await install_tool.kiq(tool.id)
        tool.installation_log = (
            f"Tool installation task {taskiq_task.task_id} restarted after server startup."
        )
        session.add(tool)

    # An update that never started is safe to hand to the worker again.
    queued_updates = session.exec(
        select(Tool).where(Tool.status == ToolStatus.update_queued)
    ).all()
    for tool in queued_updates:
        print(f"Tool(id={tool.id}) update is queued. Restarting...")
        taskiq_task = await update_tool.kiq(tool.id)
        tool.installation_log = (
            f"Tool update task {taskiq_task.task_id} restarted after server startup."
        )
        session.add(tool)

    session.commit()


async def startup_taskiq() -> None:
    if not broker.is_worker_process:
        await broker.startup()

        with Session(engine) as session:
            await recover_interrupted_tasks(session)


async def stale_claim_sweeper() -> None:
    """Periodically re-queue pending runs whose claimed task never started.

    A task that died before run_tool could start leaves the run wedged:
    dispatch skips it (taskiq_id set) while its CPUs stay reserved. The sweep
    forgets claims older than STALE_CLAIM_MINUTES, see sweep_stale_claims.
    """
    while True:
        await asyncio.sleep(STALE_CLAIM_SWEEP_INTERVAL_SECONDS)
        try:
            with Session(engine) as session:
                await sweep_stale_claims(session)
        except Exception as e:
            print(f"Error sweeping stale run claims: {e}")


async def shutdown_taskiq() -> None:
    if not broker.is_worker_process:
        await broker.shutdown()

async def startup_broadcast() -> None:
    """
    Startup task to connect the broadcaster.
    """
    await manager.startup()
    print("Broadcaster connected.")

async def shutdown_broadcast() -> None:
    """
    Shutdown task to disconnect the broadcaster.
    """
    await manager.shutdown()
    print("Broadcaster disconnected.")

@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # The permission catalog and the default role come from the code, so they
    # are aligned before the first request can be authorised.
    with Session(engine) as session:
        sync_rbac(session)
    await startup_taskiq()
    await startup_broadcast()
    sweeper = asyncio.create_task(stale_claim_sweeper())
    try:
        yield
    finally:
        sweeper.cancel()
        try:
            await sweeper
        except asyncio.CancelledError:
            pass
        await shutdown_taskiq()
        await shutdown_broadcast()
