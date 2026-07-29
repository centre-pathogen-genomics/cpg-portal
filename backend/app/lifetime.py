from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel import Session, select

from app.core.db import engine
from app.models import Run
from app.tasks import run_tool
from app.tkq import broker
from app.wsmanager import manager


async def startup_taskiq() -> None:
    if not broker.is_worker_process:
        await broker.startup()

        # Clean up dangling runs and restart pending runs
        with Session(engine) as session:
            # Cancel all runs that are dangling (running)
            runs = session.exec(select(Run).where(Run.status == "running")).all()
            for run in runs:
                print(f"Run(id={run.id}) is running. Cancelling...")
                run.status = "cancelled"
                run.stdout = "Run was cancelled due to server restart."
                session.add(run)
            # restart all runs that are pending
            runs = session.exec(select(Run).where(Run.status == "pending")).all()
            for run in runs:
                print(f"Run(id={run.id}) is pending. Restarting...")
                taskiq_task = await run_tool.kiq(run.id, run.command)
                run.taskiq_id = taskiq_task.task_id
                session.add(run)
            session.commit()


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
    await startup_taskiq()
    await startup_broadcast()
    try:
        yield
    finally:
        await shutdown_taskiq()
        await shutdown_broadcast()
