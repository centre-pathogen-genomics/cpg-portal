import os
import subprocess
from typing import Any

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel, ValidationError, validator
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    File,
    Message,
    Param,
    ParamCreate,
    ParamUpdate,
    Task,
    TaskPublic,
    Workflow,
    WorkflowCreateWithParams,
    WorkflowPublic,
    WorkflowPublicWithParams,
    WorkflowsPublic,
    WorkflowsPublicWithParams,
    WorkflowUpdate,
)
from app.tasks import run_workflow as run_workflow_task

router = APIRouter()


@router.get("/", response_model=WorkflowsPublicWithParams)
def read_workflows(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve workflows.
    """
    query = select(Workflow).offset(skip).limit(limit)
    if not current_user.is_superuser:
        query = query.where(Workflow.owner_id == current_user.id)
    workflows = session.exec(query).all()
    count = session.exec(select(func.count()).select_from(Workflow)).one()
    return WorkflowsPublicWithParams(data=workflows, count=count)


@router.post("/", response_model=WorkflowPublicWithParams)
def create_workflow(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    workflow_in: WorkflowCreateWithParams,
) -> Any:
    """
    Create new workflow along with its params.
    """
    workflow = Workflow(
        **workflow_in.dict(exclude={"params"}), owner_id=current_user.id
    )
    session.add(workflow)
    session.commit()
    session.refresh(workflow)

    # Create params if they are provided
    params = [
        Param(**param.dict(), workflow_id=workflow.id) for param in workflow_in.params
    ]
    if params:
        session.add_all(params)
        session.commit()

    return workflow


@router.get("/{workflow_id}", response_model=WorkflowPublicWithParams)
def read_workflow(
    *, session: SessionDep, current_user: CurrentUser, workflow_id: int
) -> Any:
    """
    Retrieve workflow by ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not current_user.is_superuser and workflow.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return workflow


@router.patch("/{workflow_id}", response_model=WorkflowPublic)
def update_workflow(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    workflow_id: int,
    workflow_in: WorkflowUpdate,
) -> Any:
    """
    Update workflow by ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not current_user.is_superuser and workflow.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    workflow_data = workflow_in.dict(exclude_unset=True)
    for key, value in workflow_data.items():
        setattr(workflow, key, value)
    session.add(workflow)
    session.commit()
    session.refresh(workflow)
    return workflow


@router.get("/{workflow_id}/params", response_model=list[Param])
def read_workflow_params(
    *, session: SessionDep, current_user: CurrentUser, workflow_id: int
) -> Any:
    """
    Retrieve workflow params by workflow ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not current_user.is_superuser and workflow.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return workflow.params


@router.post("/{workflow_id}/params", response_model=Param)
def add_param_to_workflow(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    workflow_id: int,
    param: ParamCreate,
) -> Any:
    """
    Add param to workflow by workflow ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not current_user.is_superuser and workflow.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    param = Param(**param.dict(), workflow_id=workflow_id)
    if param.param_type == "enum" and not param.options:
        raise HTTPException(status_code=400, detail="Enum parameter must have options")
    if param.param_type == "bool" and param.flag is None:
        raise HTTPException(status_code=400, detail="Bool parameter must have a flag")
    if param.param_type == "file":
        param.required = True
    session.add(param)
    session.commit()
    session.refresh(param)
    return param

@router.patch("/{workflow_id}/params/{param_id}", response_model=Param)
def update_param_in_workflow(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    workflow_id: int,
    param_id: int,
    in_param: ParamUpdate,
) -> Any:
    """
    Update param in workflow by workflow ID and param ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not current_user.is_superuser and workflow.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    param = session.get(Param, param_id)
    if not param:
        raise HTTPException(status_code=404, detail="Param not found")
    if param.workflow_id != workflow_id:
        raise HTTPException(status_code=400, detail="Param does not belong to this workflow")
    param_data = in_param.dict(exclude_unset=True)
    for key, value in param_data.items():
        setattr(param, key, value)
    session.add(param)
    session.commit()
    session.refresh(param)
    return param


@router.delete("/{workflow_id}/params/{param_id}", response_model=Message)
def delete_param_from_workflow(
    *, session: SessionDep, current_user: CurrentUser, workflow_id: int, param_id: int
) -> Any:
    """
    Delete param from workflow by workflow ID and param ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not current_user.is_superuser and workflow.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    param = session.get(Param, param_id)
    if not param:
        raise HTTPException(status_code=404, detail="Param not found")
    session.delete(param)
    session.commit()
    return Message(message="Param deleted successfully")


@router.post("/{workflow_id}/run", response_model=TaskPublic)
async def run_workflow(
    *, session: SessionDep, current_user: CurrentUser, workflow_id: int, params: dict
) -> Any:
    """
    Run workflow by ID, validating against predefined workflow parameters.
    Accepts both files and regular parameters dynamically.
    """
    # Fetch workflow and parameters
    workflow: Workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    files = []
    for param in workflow.params:
        if param.name not in params:
            if param.required or param.param_type == "file":
                raise HTTPException(
                    status_code=400, detail=f"Missing required parameter: {param.name}"
                )
            params[param.name] = param.default
        if param.param_type == "file":
            file_id = params[param.name]
            if not isinstance(file_id, int):
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
            # default is the flag e.f. --flag
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
    cmd = workflow.command.copy()
    # format the command with the parameters
    for part in cmd:
        for key, value in params.items():
            if f"{{{key}}}" in part:
                print(f"Replacing {key} with {value}")
                cmd[cmd.index(part)] = part.format(**{key: value})

    # create a task
    task = Task(
        workflow_id=workflow_id,
        owner_id=current_user.id,
        status="pending",
        params=params,
    )
    session.add(task)
    session.commit()
    session.refresh(task)

    # run the command
    taskiq_task = await run_workflow_task.kiq(task.id, cmd, file_ids=[file.id for file in files])

    task.taskiq_id = taskiq_task.task_id
    session.add(task)
    session.commit()
    session.refresh(task)

    return task
