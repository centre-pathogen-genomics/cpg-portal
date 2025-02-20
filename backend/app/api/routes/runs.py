import uuid
from pathlib import Path
from shlex import quote
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from jinja2 import Environment as JinjaEnvironment
from sqlalchemy import desc
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import File, Message, Param, Run, RunPublic, RunsPublicMinimal, Tool
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
    *, session: SessionDep, current_user: CurrentUser, tool_id: uuid.UUID, params: dict, tags: list[str] = None
) -> Any:
    """
    Create and run a run of a specific tool, validating against predefined tool parameters.
    Accepts both files and regular parameters dynamically.
    """
    print(f"Creating run for tool {tool_id} with params {params}")
    # Fetch tool and parameters
    if tags is None:
        tags = []
    tool: Tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if not current_user.is_superuser and not tool.enabled:
        raise HTTPException(status_code=403, detail="Tool is disabled")
    files = []
    if tool.params is None:
        tool.params = []
    for param in tool.params:
        param = Param(**param)
        if param.name not in params or params[param.name] is None:
            if param.required:
                raise HTTPException(
                    status_code=400, detail=f"Missing required parameter: {param.name}"
                )
            params[param.name] = param.default
            continue
        if param.param_type == "files" or param.param_type == "file":
            file_ids = params[param.name]
            if not isinstance(file_ids, list):
                raise HTTPException(
                    status_code=400, detail=f"For parameter {param.name}, expected list of file ids, got {file_ids}"
                )
            if param.param_type == "file":
                if len(file_ids) != 1:
                    raise HTTPException(
                        status_code=400, detail=f"For parameter {param.name}, expected single file, got {len(file_ids)}"
                    )
            file_names = []
            for file_id in file_ids:
                try:
                    file_id = uuid.UUID(file_id)
                except ValueError:
                    raise HTTPException(
                        status_code=400, detail=f"For parameter {param.name}, expected list of file ids, got {file_ids}"
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
                file_names.append(Path(file.location).name)
                files.append(file)
            if param.param_type == "file":
                params[param.name] = file_names[0]
            else:
                params[param.name] = file_names
        elif param.param_type == "bool":
            if not isinstance(params[param.name], bool):
                raise HTTPException(
                    status_code=400, detail=f"For parameter {param.name}, expected bool, got {params[param.name]}"
                )
        elif param.param_type == "int":
            try:
                params[param.name] = int(params[param.name])
            except ValueError:
                raise HTTPException(
                    status_code=400, detail=f"For parameter {param.name}, expected int, got {params[param.name]}"
                )
        elif param.param_type == "float":
            try:
                params[param.name] = float(params[param.name])
            except ValueError:
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

    # escape parameters
    escaped_params = {}
    for k, v in params.items():
        if isinstance(v, list):
            escaped_params[k] = [quote(str(i)) for i in v]
        elif isinstance(v, str):
            escaped_params[k] = quote(v)
        else:
            # no need to escape other types
            escaped_params[k] = v

    # create command
    env = JinjaEnvironment()
    command_template = env.from_string(tool.command)
    cmd = command_template.render(**escaped_params)

    # create a run
    run = Run(
        tool_id=tool_id,
        owner_id=current_user.id,
        status="pending",
        params=params,
        input_file_ids=[str(file.id) for file in files],
        command=cmd,
        tags=tags,
    )
    session.add(run)
    session.commit()
    session.refresh(run)

    # run the command
    taskiq_task = await run_tool.kiq(run.id, cmd)

    run.taskiq_id = taskiq_task.task_id
    session.add(run)
    session.commit()
    session.refresh(run)

    tool.run_count += 1
    session.add(tool)
    session.commit()

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
    statement = (
        select(Run)
        .where(Run.owner_id == current_user.id)
        .where(Run.status.notin_(["pending", "running"]))
    )
    runs: list[Run] = session.exec(statement).all()

    if not runs:
        return Message(message="No inactive runs to delete.", status_code=204)

    # Collect IDs of runs to delete
    run_ids = [run.id for run in runs]

    # Query associated files
    files_to_preserve = session.query(File).filter(File.run_id.in_(run_ids), File.saved).all()
    files_to_delete = session.query(File).filter(File.run_id.in_(run_ids), ~File.saved).all()

    # Detach preserved files
    for file in files_to_preserve:
        file.run_id = None

    # Delete unsaved files
    for file in files_to_delete:
        session.delete(file)

    # Delete the runs
    session.query(Run).filter(Run.id.in_(run_ids)).delete(synchronize_session="fetch")

    session.commit()

    # Remove files from the filesystem
    deleted_files_count = 0
    for file in files_to_delete:
        file_path = Path(file.location)
        if file_path.exists():
            file_path.unlink()
            deleted_files_count += 1

    return Message(message=f"Deleted {len(runs)} runs and {deleted_files_count} files.")




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
    Delete a specific run by ID.
    """
    # Fetch the run
    run = session.get(Run, id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Check permissions
    if run.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Check if the run is active
    if run.status in ["running", "pending"]:
        raise HTTPException(status_code=400, detail="Run is active and cannot be deleted")
    # Separate files into those to preserve and those to delete

    files_to_preserve = []
    files_to_delete = []

    if run.files:
        for file in run.files:
            if file.saved:
                files_to_preserve.append(file)
                file.run_id = None  # Detach preserved files
            else:
                files_to_delete.append(file)

    # Delete the run and unsaved files
    session.delete(run)
    for file in files_to_delete:
        session.delete(file)

    session.commit()

    # Delete unsaved files from the filesystem
    deleted_files_count = 0
    for file in files_to_delete:
        file_path = Path(file.location)
        if file_path.exists():
            file_path.unlink()
            deleted_files_count += 1

    return Message(message=f"Deleted run {id} and {deleted_files_count} files")

