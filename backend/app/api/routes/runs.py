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
    Run,
    RunPublic,
    RunsPublicMinimal,
    Tool,
)
from app.tasks import run_tool

router = APIRouter()

@router.get("/", response_model=RunsPublicMinimal)
def read_runs(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    order_by: str = Query("-created_at", regex=r"^-?[a-zA-Z_]+$")
) -> Any:
    """
    Retrieve runs with optional ordering.
    """

    # Parse the order_by string to determine the column and direction
    descending = order_by.startswith('-')
    column_name = order_by[1:] if descending else order_by

    # Validate and obtain the actual column object from the Run model
    if hasattr(Run, column_name):
        column = getattr(Run, column_name)
        order_expression = desc(column) if descending else column
    else:
        raise HTTPException(status_code=400, detail=f"Invalid column name: {column_name}")

    # Build the query based on user role
    query_base = select(Run).where(Run.owner_id == current_user.id)

    # Apply ordering, pagination and execute
    runs_query = query_base.order_by(order_expression).offset(skip).limit(limit)
    runs = session.exec(runs_query).all()

    # Counting for pagination
    count_query = select(func.count()).select_from(Run).where(Run.owner_id == current_user.id)
    count = session.exec(count_query).one()

    return RunsPublicMinimal(data=runs, count=count)


@router.post("/", response_model=RunPublic)
async def create_run(
    *, session: SessionDep, current_user: CurrentUser, tool_id: uuid.UUID, params: dict
) -> Any:
    """
    Create and run a run of a specific tool, validating against predefined tool parameters.
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

    # create a run
    run = Run(
        tool_id=tool_id,
        owner_id=current_user.id,
        status="pending",
        params=params,
    )
    session.add(run)
    session.commit()
    session.refresh(run)

    # run the command
    taskiq_task = await run_tool.kiq(run.id, cmd, file_ids=[file.id for file in files])

    run.taskiq_id = taskiq_task.task_id
    session.add(run)
    session.commit()
    session.refresh(run)

    return run


@router.patch("/cancel", response_model=Message)
def cancel_runs(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Cancel all active runs with status pending or running.
    """
    # Select runs based on user permissions and status
    statement = select(Run).where(Run.owner_id == current_user.id).where(Run.status.in_(["pending", "running"]))

    runs: list[Run] = session.exec(statement).all()

    # Update run status
    for run in runs:
        print(f"Cancelling run {run.id}")
        run.status = "cancelled"
        session.add(run)
    session.commit()
    return Message(message=f"Cancelled {len(runs)} runs")

@router.delete("/", response_model=Message)
def delete_runs(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Delete all inactive runs.
    """
    # Select runs based on user permissions and status
    statement = select(Run).where(Run.owner_id == current_user.id).where(Run.status != "pending").where(Run.status != "running")

    runs: list[Run] = session.exec(statement).all()

    # Cascading delete handles the removal of related Results and Files
    files_to_delete: list[File] = []
    for run in runs:
        if run.results:
            files = [result.file for result in run.results if result.file]
            files_to_delete.extend(files)
        session.delete(run)
    session.commit()
    for file in files_to_delete:
        file_path = Path(file.location)
        if file_path.exists():
            file_path.unlink()
    return Message(message=f"Deleted {len(runs)} runs and {len(files_to_delete)} files")



@router.get("/active", response_model=RunsPublicMinimal)
def read_active_runs(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve active runs with status pending or running.
    """
    count_statement = (
        select(func.count())
        .select_from(Run)
        .where(Run.owner_id == current_user.id)
        .where(Run.status.in_(["pending", "running"]))
    )
    count = session.exec(count_statement).one()
    statement = (
        select(Run)
        .where(Run.owner_id == current_user.id)
        .where(Run.status.in_(["pending", "running"]))
        .offset(skip)
        .limit(limit)
    )
    runs = session.exec(statement).all()

    return RunsPublicMinimal(data=runs, count=count)

@router.get("/{id}", response_model=RunPublic)
def read_run(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Retrieve run metadata.
    """
    run: Run = session.get(Run, id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return run

@router.patch("/{id}/cancel", response_model=RunPublic)
def cancel_run(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Cancel run.
    """
    run = session.get(Run, id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    if run.status == "completed":
        raise HTTPException(status_code=400, detail="Run already finished")
    run.status = "cancelled"
    session.add(run)
    session.commit()
    return run

@router.delete("/{id}", response_model=Message)
def delete_run(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Delete run.
    """
    run = session.get(Run, id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    if run.status == "running" or run.status == "pending":
        raise HTTPException(status_code=400, detail="Run is active")
    files = []
    files_to_delete = []
    if run.results:
        files = [result.file for result in run.results if result.file]
        files_to_delete.extend(files)
    session.delete(run)
    session.commit()
    for file in files_to_delete:
        file_path = Path(file.location)
        if file_path.exists():
            file_path.unlink()
    return Message(message=f"Deleted run {id} and {len(files_to_delete)} files")
