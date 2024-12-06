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
    TasksPublicMinimal,
    Tool,
)
from app.tasks import run_tool as run_tool_task

router = APIRouter()

@router.get("/", response_model=TasksPublicMinimal)
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
    query_base = select(Task).where(Task.owner_id == current_user.id)

    # Apply ordering, pagination and execute
    tasks_query = query_base.order_by(order_expression).offset(skip).limit(limit)
    tasks = session.exec(tasks_query).all()

    # Counting for pagination
    count_query = select(func.count()).select_from(Task).where(Task.owner_id == current_user.id)
    count = session.exec(count_query).one()

    return TasksPublicMinimal(data=tasks, count=count)


@router.post("/", response_model=TaskPublic)
async def create_task(
    *, session: SessionDep, current_user: CurrentUser, tool_id: uuid.UUID, params: dict
) -> Any:
    """
    Create and run a task of a specific tool, validating against predefined tool parameters.
    Accepts both files and regular parameters dynamically.
    """
    # Fetch tool and parameters
    tool: Tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if not current_user.is_superuser and not tool.enabled:
        raise HTTPException(status_code=403, detail="Tool is disabled")
    files = []
    for param in tool.params:
        if param.name not in params:
            if param.required or param.param_type == "file":
                raise HTTPException(
                    status_code=400, detail=f"Missing required parameter: {param.name}"
                )
            params[param.name] = param.default
        if param.param_type == "file":
            file_id = params[param.name]
            try:
                file_id = uuid.UUID(file_id)
            except ValueError:
                raise HTTPException(
                    status_code=400, detail=f"For parameter {param.name}, expected file id, got {file_id}"
                )
            file = session.get(File, file_id)
            if not file:
                raise HTTPException(
                    status_code=404, detail=f"File not found: {file_id}"
                )
            if file.owner_id != current_user.id and not current_user.is_superuser:
                raise HTTPException(
                    status_code=403, detail="Not enough permissions to use this file"
                )
            files.append(file)
            params[param.name] = file.name
        elif param.param_type == "bool":
            if not isinstance(params[param.name], bool):
                raise HTTPException(
                    status_code=400, detail=f"For parameter {param.name}, expected bool, got {params[param.name]}"
                )
            # default is the flag e.g. --flag
            if params[param.name]:
                params[param.name] = param.flag
            else:
                params[param.name] = ""
        elif param.param_type == "int":
            if not isinstance(params[param.name], int):
                raise HTTPException(
                    status_code=400, detail=f"For parameter {param.name}, expected int, got {params[param.name]}"
                )
        elif param.param_type == "float":
            if not isinstance(params[param.name], float):
                raise HTTPException(
                    status_code=400, detail=f"For parameter {param.name}, expected float, got {params[param.name]}"
                )
        elif param.param_type == "str":
            if not isinstance(params[param.name], str):
                raise HTTPException(
                    status_code=400, detail=f"For parameter {param.name}, expected str, got {params[param.name]}"
                )
        elif param.param_type == "enum":
            if params[param.name] not in param.options:
                raise HTTPException(
                    status_code=400, detail=f"For parameter {param.name}, expected one of {', '.join(param.options)}, got {params[param.name]}"
                )
        else:
            raise HTTPException(
                status_code=500, detail=f"Unknown parameter type: {param.param_type}"
            )
    cmd = tool.command.copy()
    # format the command with the parameters
    for part in cmd:
        for key, value in params.items():
            if f"{{{key}}}" in part:
                print(f"Replacing {key} with {value}")
                cmd[cmd.index(part)] = part.format(**{key: value})

    # create a task
    task = Task(
        tool_id=tool_id,
        owner_id=current_user.id,
        status="pending",
        params=params,
    )
    session.add(task)
    session.commit()
    session.refresh(task)

    # run the command
    taskiq_task = await run_tool_task.kiq(task.id, cmd, file_ids=[file.id for file in files])

    task.taskiq_id = taskiq_task.task_id
    session.add(task)
    session.commit()
    session.refresh(task)

    return task


@router.patch("/cancel", response_model=Message)
def cancel_tasks(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Cancel all active tasks with status pending or running.
    """
    # Select tasks based on user permissions and status
    statement = select(Task).where(Task.owner_id == current_user.id).where(Task.status.in_(["pending", "running"]))

    tasks: list[Task] = session.exec(statement).all()

    # Update task status
    for task in tasks:
        print(f"Cancelling task {task.id}")
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
    statement = select(Task).where(Task.owner_id == current_user.id).where(Task.status != "pending").where(Task.status != "running")

    tasks: list[Task] = session.exec(statement).all()

    # Cascading delete handles the removal of related Results and Files
    files_to_delete: list[File] = []
    for task in tasks:
        if task.results:
            files = [result.file for result in task.results if result.file]
            files_to_delete.extend(files)
        session.delete(task)
    session.commit()
    for file in files_to_delete:
        file_path = Path(file.location)
        if file_path.exists():
            file_path.unlink()
    return Message(message=f"Deleted {len(tasks)} tasks and {len(files_to_delete)} files")



@router.get("/active", response_model=TasksPublicMinimal)
def read_active_tasks(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve active tasks with status pending or running.
    """
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

    return TasksPublicMinimal(data=tasks, count=count)

@router.get("/{id}", response_model=TaskPublic)
def read_task(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Retrieve task metadata.
    """
    task: Task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return task

@router.patch("/{id}/cancel", response_model=TaskPublic)
def cancel_task(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Cancel task.
    """
    task = session.get(Task, id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.owner_id != current_user.id:
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
    if task.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    if task.status == "running" or task.status == "pending":
        raise HTTPException(status_code=400, detail="Task is active")
    files = []
    files_to_delete = []
    if task.results:
        files = [result.file for result in task.results if result.file]
        files_to_delete.extend(files)
    session.delete(task)
    session.commit()
    for file in files_to_delete:
        file_path = Path(file.location)
        if file_path.exists():
            file_path.unlink()
    return Message(message=f"Deleted task {id} and {len(files_to_delete)} files")
