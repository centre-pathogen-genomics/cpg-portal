import os
import subprocess
from typing import Any

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel, ValidationError, validator
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Param,
    ParamCreate,
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


@router.post("/", response_model=WorkflowPublic)
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


@router.get("/{workflow_id}", response_model=WorkflowPublic)
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


@router.put("/{workflow_id}", response_model=WorkflowPublic)
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


@router.post("/{workflow_id}/params", response_model=WorkflowPublicWithParams)
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
    session.add(param)
    session.commit()
    session.refresh(param)
    return workflow


class DynamicParams(BaseModel):
    params: dict[str, Any]


# create a separate endpoint to upload files
# this will be used to upload files and pass them as parameters to the workflow
# when you upload a file you'll get a file id back, which you can then pass as a parameter to the workflow
# this would also for for s3 uploads, etc


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

    for param in workflow.params:
        if param.name not in params:
            if param.required:
                raise HTTPException(
                    status_code=400, detail=f"Missing required parameter: {param.name}"
                )
            params[param.name] = param.default

    cmd = workflow.command.copy()
    # format the command with the parameters
    for part in cmd:
        for key, value in params.items():
            if f"{{{key}}}" in part:
                cmd[cmd.index(part)] = part.format(**{key: value})

    print(cmd)
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
    taskiq_task = await run_workflow_task.kiq(task.id, cmd)
    
    task.taskiq_id = taskiq_task.task_id
    session.add(task)
    session.commit()
    session.refresh(task)

    return task
