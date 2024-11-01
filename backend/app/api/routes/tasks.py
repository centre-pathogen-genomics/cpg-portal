import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import desc
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    File,
    Message,
    Task,
    TaskPublic,
    TaskPublicWithResult,
    TasksPublic,
)

router = APIRouter()

@router.get("/", response_model=TasksPublic)
def read_tasks(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    order_by: str = Query("-created_at", regex=r"^-?[a-zA-Z_]+$")
) -> Any:
    """
    Retrieve tasks with optional ordering.
    """

    # Parse the order_by string to determine the column and direction
    descending = order_by.startswith('-')
    column_name = order_by[1:] if descending else order_by

    # Validate and obtain the actual column object from the Task model
    if hasattr(Task, column_name):
        column = getattr(Task, column_name)
        order_expression = desc(column) if descending else column
    else:
        raise HTTPException(status_code=400, detail=f"Invalid column name: {column_name}")

    # Build the query based on user role
    query_base = select(Task).where(Task.owner_id == current_user.id) if not current_user.is_superuser else select(Task)

    # Apply ordering, pagination and execute
    tasks_query = query_base.order_by(order_expression).offset(skip).limit(limit)
    tasks = session.exec(tasks_query).all()

    # Counting for pagination
    count_query = select(func.count()).select_from(Task).where(Task.owner_id == current_user.id) if not current_user.is_superuser else select(func.count()).select_from(Task)
    count = session.exec(count_query).one()

    return TasksPublic(data=tasks, count=count)

@router.patch("/cancel", response_model=Message)
def cancel_tasks(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Cancel all active tasks with status pending or running.
    """
    # Select tasks based on user permissions and status
    if current_user.is_superuser:
        statement = select(Task).where(Task.status.in_(["pending", "running"]))
    else:
        statement = select(Task).where(Task.owner_id == current_user.id).where(Task.status.in_(["pending", "running"]))

    tasks: list[Task] = session.exec(statement).all()

    # Update task status
    for task in tasks:
        task.status = "cancelled"
        session.add(task)
    session.commit()
    return Message(message=f"Cancelled {len(tasks)} tasks")

@router.delete("/", response_model=Message)
def delete_tasks(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Delete all inactive tasks.
    """
    # Select tasks based on user permissions and status
    if current_user.is_superuser:
        statement = select(Task).where(Task.status != "pending").where(Task.status != "running")
    else:
        statement = select(Task).where(Task.owner_id == current_user.id).where(Task.status != "pending").where(Task.status != "running")

    tasks: list[Task] = session.exec(statement).all()

    # Cascading delete handles the removal of related Results and Files
    files: list[File] = []
    for task in tasks:
        if task.result:
            files.extend(getattr(task.result, "files", []))
        session.delete(task)
    session.commit()
    for file in files:
        file_path = Path(file.location)
        if file_path.exists():
            file_path.unlink()
    return Message(message=f"Deleted {len(tasks)} tasks and {len(files)} files")



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
def read_task(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
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
def cancel_task(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Cancel task.
    """
    task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not current_user.is_superuser and (task.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    if task.status == "completed":
        raise HTTPException(status_code=400, detail="Task already finished")
    task.status = "cancelled"
    session.add(task)
    session.commit()
    return task

@router.delete("/{id}", response_model=Message)
def delete_task(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Delete task.
    """
    task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not current_user.is_superuser and (task.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    if task.status == "running" or task.status == "pending":
        raise HTTPException(status_code=400, detail="Task is active")
    files = []
    if task.result:
        files.extend(getattr(task.result, "files", []))
    session.delete(task)
    session.commit()
    for file in files:
        file_path = Path(file.location)
        if file_path.exists():
            file_path.unlink()
    return Message(message=f"Deleted task {id} and {len(files)} files")
