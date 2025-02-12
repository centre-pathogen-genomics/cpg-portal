from fastapi import FastAPI
from sqlmodel import Session, select

from app.core.db import engine
from app.models import Run
from app.tasks import run_tool
from app.tkq import broker


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


def startup(app: FastAPI):
    async def _startup():
        await startup_taskiq()

    return _startup


def shutdown(app: FastAPI):
    async def _shutdown():
        await shutdown_taskiq()

    return _shutdown
