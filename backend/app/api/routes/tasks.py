from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import Task, TaskPublic, TaskPublicWithResult, TasksPublic

router = APIRouter()

@router.get("/", response_model=TasksPublic)
def read_tasks(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve tasks.
    """

    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Task)
        count = session.exec(count_statement).one()
        statement = select(Task).offset(skip).limit(limit)
        tasks = session.exec(statement).all()
    else:
        count_statement = (
            select(func.count())
            .select_from(Task)
            .where(Task.owner_id == current_user.id)
        )
        count = session.exec(count_statement).one()
        statement = (
            select(Task)
            .where(Task.owner_id == current_user.id)
            .offset(skip)
            .limit(limit)
        )
        tasks = session.exec(statement).all()

    return TasksPublic(data=tasks, count=count)

@router.get("/active", response_model=TasksPublic)
def read_active_tasks(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve active tasks with status pending or running.
    """
    if current_user.is_superuser:
        count_statement = (
            select(func.count())
            .select_from(Task)
            .where(Task.status.in_(["pending", "running"]))
        )
        count = session.exec(count_statement).one()
        statement = (
            select(Task)
            .where(Task.status.in_(["pending", "running"]))
            .offset(skip)
            .limit(limit)
        )
        tasks = session.exec(statement).all()
    else:
        count_statement = (
            select(func.count())
            .select_from(Task)
            .where(Task.owner_id == current_user.id)
            .where(Task.status.in_(["pending", "running"]))
        )
        count = session.exec(count_statement).one()
        statement = (
            select(Task)
            .where(Task.owner_id == current_user.id)
            .where(Task.status.in_(["pending", "running"]))
            .offset(skip)
            .limit(limit)
        )
        tasks = session.exec(statement).all()

    return TasksPublic(data=tasks, count=count)

@router.get("/{id}", response_model=TaskPublicWithResult)
def read_task(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Retrieve task metadata.
    """
    task: Task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not current_user.is_superuser and (task.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    print(task.result)
    return task

@router.patch("/{id}/cancel", response_model=TaskPublic)
def cancel_task(session: SessionDep, current_user: CurrentUser, id: int) -> Any:
    """
    Cancel task.
    """
    task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not current_user.is_superuser and (task.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    if task.status == "finished":
        raise HTTPException(status_code=400, detail="Task already finished")
    task.status = "cancelled"
    session.add(task)
    session.commit()
    return task

