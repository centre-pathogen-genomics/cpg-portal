import json
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from jinja2 import Environment as JinjaEnvironment
from sqlalchemy import and_, desc
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.core.app_settings import get_or_create_app_settings
from app.core.file_types import FileTypeEnum
from app.models import (
    File,
    Message,
    Param,
    ParamVisibilityOperator,
    Run,
    RunPublic,
    RunsPublicMinimal,
    RunStatus,
    Tool,
)
from app.tasks import run_tool
from app.utils import escape, flatten
from app.wsmanager import manager

router = APIRouter()

RUN_SORT_COLUMNS = {
    "created_at": Run.created_at,
    "finished_at": Run.finished_at,
    "name": Run.name,
    "runtime": func.coalesce(
        func.extract(
            "epoch", func.coalesce(Run.finished_at, func.now()) - Run.started_at
        ),
        0,
    ),
    "started_at": Run.started_at,
    "status": Run.status,
}


def is_missing_param_value(value: Any) -> bool:
    return (
        value is None
        or (isinstance(value, str) and value.strip() == "")
        or (isinstance(value, list) and len(value) == 0)
    )


def _parse_visibility_condition_value(
    *,
    value: Any,
    dependency: Param,
    operator: ParamVisibilityOperator,
) -> Any:
    def parse_scalar(raw_value: Any) -> Any:
        if raw_value is None:
            return None

        if dependency.param_type == "bool":
            if isinstance(raw_value, bool):
                return raw_value
            if isinstance(raw_value, str):
                lowered = raw_value.strip().lower()
                if lowered in {"true", "1", "yes", "on"}:
                    return True
                if lowered in {"false", "0", "no", "off"}:
                    return False
            raise HTTPException(
                status_code=400,
                detail=f"Invalid visibility condition value for parameter `{dependency.name}`",
            )

        if dependency.param_type == "int":
            try:
                return int(raw_value)
            except (TypeError, ValueError) as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid visibility condition value for parameter `{dependency.name}`",
                ) from exc

        if dependency.param_type == "float":
            try:
                return float(raw_value)
            except (TypeError, ValueError) as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid visibility condition value for parameter `{dependency.name}`",
                ) from exc

        if isinstance(raw_value, list):
            return [str(item) for item in raw_value]

        return str(raw_value)

    if operator in {
        ParamVisibilityOperator.truthy,
        ParamVisibilityOperator.falsy,
        ParamVisibilityOperator.is_set,
        ParamVisibilityOperator.is_empty,
    }:
        return None

    if operator in {ParamVisibilityOperator.in_, ParamVisibilityOperator.not_in}:
        if value is None:
            return []
        if isinstance(value, list):
            return [parse_scalar(item) for item in value]
        if isinstance(value, str):
            return [
                parse_scalar(item.strip()) for item in value.split(",") if item.strip()
            ]
        return [parse_scalar(value)]

    if value is None:
        return None
    return parse_scalar(value)


def _is_visible_if_match(
    *, dependency_value: Any, operator: ParamVisibilityOperator, expected_value: Any
) -> bool:
    if operator == ParamVisibilityOperator.truthy:
        return bool(dependency_value)
    if operator == ParamVisibilityOperator.falsy:
        return not bool(dependency_value)
    if operator == ParamVisibilityOperator.is_set:
        return not is_missing_param_value(dependency_value)
    if operator == ParamVisibilityOperator.is_empty:
        return is_missing_param_value(dependency_value)

    if operator == ParamVisibilityOperator.equals:
        return dependency_value == expected_value
    if operator == ParamVisibilityOperator.not_equals:
        return dependency_value != expected_value
    if operator == ParamVisibilityOperator.in_:
        if isinstance(dependency_value, list):
            return any(item in expected_value for item in dependency_value)
        return dependency_value in expected_value
    if operator == ParamVisibilityOperator.not_in:
        if isinstance(dependency_value, list):
            return all(item not in expected_value for item in dependency_value)
        return dependency_value not in expected_value
    if operator == ParamVisibilityOperator.greater_than:
        return dependency_value > expected_value
    if operator == ParamVisibilityOperator.greater_than_or_equal:
        return dependency_value >= expected_value
    if operator == ParamVisibilityOperator.less_than:
        return dependency_value < expected_value
    if operator == ParamVisibilityOperator.less_than_or_equal:
        return dependency_value <= expected_value
    return False


def _build_visible_param_lookup(
    tool_params: list[Param], params: dict[str, Any]
) -> dict[str, bool]:
    params_by_name = {param.name: param for param in tool_params}
    raw_values = dict(params)
    visibility_cache: dict[str, bool] = {}
    visiting: set[str] = set()

    def is_visible(param_name: str) -> bool:
        if param_name in visibility_cache:
            return visibility_cache[param_name]
        if param_name in visiting:
            raise HTTPException(
                status_code=400,
                detail=f"Circular visibility condition detected for parameter `{param_name}`",
            )

        param = params_by_name.get(param_name)
        if param is None:
            visibility_cache[param_name] = True
            return True

        visiting.add(param_name)
        try:
            condition_param_name = param.visible_if_param
            if not condition_param_name:
                visible = True
            else:
                dependency = params_by_name.get(condition_param_name)
                if dependency is None:
                    visible = False
                else:
                    visible = is_visible(condition_param_name)
                    if visible:
                        dependency_value = raw_values.get(
                            condition_param_name, dependency.default
                        )
                        expected_value = _parse_visibility_condition_value(
                            value=param.visible_if_value,
                            dependency=dependency,
                            operator=param.visible_if_operator,
                        )
                        visible = _is_visible_if_match(
                            dependency_value=dependency_value,
                            operator=param.visible_if_operator,
                            expected_value=expected_value,
                        )
            visibility_cache[param_name] = visible
            return visible
        finally:
            visiting.discard(param_name)

    for param in tool_params:
        is_visible(param.name)

    return visibility_cache


@router.get("/", response_model=RunsPublicMinimal)
def read_runs(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    order_by: str = Query("-created_at", pattern=r"^-?[a-zA-Z_]+$"),
    name: str | None = Query(None, min_length=1, max_length=255),
    tool_name: str | None = Query(None, min_length=1, max_length=255),
    statuses: list[RunStatus] = Query(None),
) -> Any:
    """
    Retrieve runs with optional ordering.
    """

    # Parse the order_by string to determine the column and direction
    descending = order_by.startswith("-")
    column_name = order_by[1:] if descending else order_by

    # Validate and obtain the actual column object from the Run model
    column = RUN_SORT_COLUMNS.get(column_name)
    if column is None:
        raise HTTPException(
            status_code=400, detail=f"Invalid column name: {column_name}"
        )
    order_expression = desc(column) if descending else column

    # Build the query based on user role
    base_where = Run.owner_id == current_user.id
    if name:
        base_where = and_(base_where, Run.name.icontains(name, autoescape=True))
    if tool_name:
        base_where = and_(base_where, Run.tool.has(Tool.name == tool_name))
    if statuses:
        base_where = and_(base_where, Run.status.in_(statuses))
    query_base = select(Run).where(base_where)

    # Apply ordering, pagination and execute
    runs_query = query_base.order_by(order_expression).offset(skip).limit(limit)
    runs = session.exec(runs_query).all()

    # Counting for pagination
    count_query = select(func.count()).select_from(Run).where(base_where)
    count = session.exec(count_query).one()

    return RunsPublicMinimal(data=runs, count=count)


@router.get("/tools", response_model=list[str])
def read_run_tool_names(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Retrieve distinct tool names used by the current user's runs.
    """
    statement = (
        select(Tool.name)
        .join(Run, Run.tool_id == Tool.id)
        .where(Run.owner_id == current_user.id)
        .distinct()
        .order_by(Tool.name)
    )
    return session.exec(statement).all()


@router.post("/", response_model=RunPublic)
async def create_run(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    tool_id: uuid.UUID,
    params: dict,
    tags: list[str] = None,
    email_on_completion: bool = False,
    name: str = None,
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

    # check the user que limit
    count_statement = (
        select(func.count())
        .select_from(Run)
        .where(Run.owner_id == current_user.id)
        .where(Run.status.in_(["pending", "running"]))
    )
    count = session.exec(count_statement).one()
    print(f"User {current_user.id} has {count} active runs")
    if count >= current_user.max_runs:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You have reached the maximum number of active Runs. Please wait for some to finish!",
        )

    files = []
    tool_params = [Param(**param) for param in (tool.params or [])]
    visible_params = _build_visible_param_lookup(tool_params, params)
    normalized_params = dict(params)
    for param in tool_params:
        if not visible_params.get(param.name, True):
            normalized_params.pop(param.name, None)
            continue

        if param.name not in normalized_params or is_missing_param_value(
            normalized_params[param.name]
        ):
            if param.required:
                raise HTTPException(
                    status_code=400, detail=f"Missing required parameter: {param.name}"
                )
            normalized_params[param.name] = param.default
            continue
        if param.param_type == "file":
            file_ids = normalized_params[param.name]
            if not isinstance(file_ids, list):
                raise HTTPException(
                    status_code=400,
                    detail=f"For parameter `{param.name}`, expected list of file ids, got {file_ids}",
                )
            if not param.multiple and len(file_ids) != 1:
                raise HTTPException(
                    status_code=400,
                    detail=f"For parameter `{param.name}`, expected list with a single file, got {len(file_ids)}",
                )
            file_names = []
            for file_id in file_ids:
                try:
                    file_id = uuid.UUID(file_id)
                except ValueError:
                    raise HTTPException(
                        status_code=400, detail=f"Invalid file ID: {file_id}"
                    )
                file = session.get(File, file_id)
                if not file:
                    raise HTTPException(
                        status_code=404, detail=f"File not found: {file_id}"
                    )
                if file.owner_id != current_user.id and not current_user.is_superuser:
                    raise HTTPException(
                        status_code=403,
                        detail="Not enough permissions to use this file",
                    )
                if (
                    param.allowed_file_types
                    and file.file_type not in param.allowed_file_types
                ):
                    raise HTTPException(
                        status_code=400,
                        detail=f"File type not allowed: {file.file_type}",
                    )
                if not param.multiple and file.is_group:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Parameter `{param.name}` does not allow multiple files, but a group was provided",
                    )
                if file.children:
                    # if the file has children, add them all (don't add the parent)
                    child_names = []
                    for child in file.children:
                        files.append(child)
                        child_names.append(Path(child.location).name)

                    if (
                        file.file_type == FileTypeEnum.PAIR.value
                        and param.allowed_file_types
                        and FileTypeEnum.PAIR.value in param.allowed_file_types
                    ):
                        # if the parameter allows pairs, add the pair as [pair1, pair2]
                        file_names.append(child_names)
                    else:
                        # otherwise, add the children as separate files
                        file_names.extend(child_names)
                else:
                    file_names.append(Path(file.location).name)
                    files.append(file)
            if param.multiple:
                normalized_params[param.name] = file_names
            else:
                normalized_params[param.name] = file_names[0]
        elif param.param_type == "bool":
            if not isinstance(normalized_params[param.name], bool):
                raise HTTPException(
                    status_code=400,
                    detail=f"For parameter `{param.name}`, expected bool, got {normalized_params[param.name]}",
                )
        elif param.param_type == "int":
            try:
                normalized_params[param.name] = int(normalized_params[param.name])
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"For parameter `{param.name}`, expected int, got {normalized_params[param.name]}",
                )
        elif param.param_type == "float":
            try:
                normalized_params[param.name] = float(normalized_params[param.name])
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"For parameter `{param.name}`, expected float, got {normalized_params[param.name]}",
                )
        elif param.param_type == "str":
            if not isinstance(normalized_params[param.name], str):
                raise HTTPException(
                    status_code=400,
                    detail=f"For parameter `{param.name}`, expected str, got {normalized_params[param.name]}",
                )
        elif param.param_type == "enum":
            if normalized_params[param.name] not in param.options:
                raise HTTPException(
                    status_code=400,
                    detail=f"For parameter `{param.name}`, expected one of {', '.join(param.options)}, got {normalized_params[param.name]}",
                )
        else:
            raise HTTPException(
                status_code=500, detail=f"Unknown parameter type: {param.param_type}"
            )

    # escape parameters
    escaped_params = {}
    for k, v in normalized_params.items():
        try:
            escaped_params[k] = escape(v)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid parameter value: {v}")

    # create command
    env = JinjaEnvironment()
    # add custom filters
    env.filters["flatten"] = flatten
    command_template = env.from_string(tool.command)
    cmd = command_template.render(**escaped_params)

    # create a run
    run = Run(
        tool_id=tool_id,
        name=name,
        owner_id=current_user.id,
        status="pending",
        params=normalized_params,
        input_file_ids=[str(file.id) for file in files],
        command=cmd,
        tags=tags,
    )
    session.add(run)
    session.commit()
    session.refresh(run)

    app_settings = get_or_create_app_settings(session)
    if not app_settings.queue_paused:
        taskiq_task = await run_tool.kiq(run.id, cmd)
        run.taskiq_id = taskiq_task.task_id
    run.email_on_completion = email_on_completion
    session.add(run)
    session.commit()
    session.refresh(run)

    tool.run_count += 1
    session.add(tool)
    session.commit()

    await manager.broadcast(
        json.dumps({"toolname": tool.name, "param_count": len(params)}), "stream"
    )

    return run


@router.patch("/cancel", response_model=Message)
def cancel_runs(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Cancel all active runs with status pending or running.
    """
    # Select runs based on user permissions and status
    statement = (
        select(Run)
        .where(Run.owner_id == current_user.id)
        .where(Run.status.in_(["pending", "running"]))
    )

    runs: list[Run] = session.exec(statement).all()

    # Update run status
    for run in runs:
        print(f"Cancelling run {run.id}")
        run.status = "cancelled"
        session.add(run)
    session.commit()
    return Message(message=f"Cancelled {len(runs)} runs")


@router.delete("/", response_model=Message)
def delete_runs(
    session: SessionDep,
    current_user: CurrentUser,
    name: str | None = Query(None, min_length=1, max_length=255),
    tool_name: str | None = Query(None, min_length=1, max_length=255),
    ids: list[uuid.UUID] | None = Query(None),
) -> Any:
    """
    Delete inactive runs, optionally filtered by name, tool, and run IDs.
    """
    # Select runs based on user permissions and status
    base_where = Run.owner_id == current_user.id
    base_where = and_(base_where, Run.status.notin_(["pending", "running"]))
    if ids:
        base_where = and_(base_where, Run.id.in_(ids))
    if name:
        base_where = and_(base_where, Run.name.icontains(name, autoescape=True))
    if tool_name:
        base_where = and_(base_where, Run.tool.has(Tool.name == tool_name))

    statement = select(Run).where(base_where)
    runs: list[Run] = session.exec(statement).all()

    if not runs:
        return Message(message="No inactive runs to delete.", status_code=204)

    # Collect IDs of runs to delete
    run_ids = [run.id for run in runs]

    # Query associated files
    files_to_preserve = (
        session.query(File).filter(File.run_id.in_(run_ids), File.saved).all()
    )
    files_to_delete = (
        session.query(File).filter(File.run_id.in_(run_ids), ~File.saved).all()
    )

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
    if run.owner_id != current_user.id and not run.shared:
        raise HTTPException(status_code=400, detail="Not enough permissions")

    # Convert to RunPublic and add owner name if shared
    run_data = RunPublic.model_validate(run)
    if run.shared and run.owner_id != current_user.id:
        run_data.owner_name = run.owner.full_name

    return run_data


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


@router.patch("/{id}/rename", response_model=RunPublic)
def rename_run(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID, name: str
) -> Any:
    """
    Rename a specific run by ID.
    """
    # Fetch the run
    run = session.get(Run, id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Check permissions
    if run.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Update the name
    run.name = name
    session.add(run)
    session.commit()
    session.refresh(run)

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
        raise HTTPException(
            status_code=400, detail="Run is active and cannot be deleted"
        )
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


@router.patch("/{id}/share", response_model=RunPublic)
def toggle_run_sharing(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID, shared: bool
) -> Any:
    """
    Toggle sharing status of a specific run by ID.
    """
    # Fetch the run
    run = session.get(Run, id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Check permissions
    if run.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Update the sharing status
    run.shared = shared
    session.add(run)
    session.commit()
    session.refresh(run)

    return run
