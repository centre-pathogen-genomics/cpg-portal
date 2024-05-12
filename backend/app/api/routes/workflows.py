from typing import Any, Dict, Optional, Union

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel, ValidationError, validator
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Param,
    ParamCreate,
    Workflow,
    WorkflowCreate,
    WorkflowCreateWithParams,
    WorkflowPublic,
    WorkflowPublicWithParams,
    WorkflowsPublic,
    WorkflowsPublicWithParams,
)

router = APIRouter()

@router.get("/", response_model=WorkflowsPublicWithParams)
def read_workflows(session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100) -> Any:
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
def create_workflow(*, session: SessionDep, current_user: CurrentUser, workflow_in: WorkflowCreateWithParams) -> Any:
    """
    Create new workflow along with its params.
    """
    workflow = Workflow(**workflow_in.dict(exclude={"params"}), owner_id=current_user.id)
    session.add(workflow)
    session.commit()
    session.refresh(workflow)

    # Create params if they are provided
    params = [Param(**param.dict(), workflow_id=workflow.id) for param in workflow_in.params]
    session.add_all(params)
    session.commit()

    return workflow

@router.get("/{workflow_id}", response_model=WorkflowPublic)
def read_workflow(*, session: SessionDep, current_user: CurrentUser, workflow_id: int) -> Any:
    """
    Retrieve workflow by ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not current_user.is_superuser and workflow.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return workflow

@router.get("/{workflow_id}/params", response_model=list[Param])
def read_workflow_params(*, session: SessionDep, current_user: CurrentUser, workflow_id: int) -> Any:
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
def add_param_to_workflow(*, session: SessionDep, current_user: CurrentUser, workflow_id: int, param: ParamCreate) -> Any:
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

@router.post("/{workflow_id}/run", response_model=int)
async def run_workflow(*, session: SessionDep, current_user: CurrentUser, workflow_id: int, params: Dict[str, Union[UploadFile, str, int, float]]) -> Any:
    """
    Run workflow by ID, validating against predefined workflow parameters.
    Accepts both files and regular parameters dynamically.
    """
    # Fetch workflow and parameters
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    db_params = workflow.params
    expected_params = {param.name: param for param in db_params}

    # Validate incoming parameters
    for param in db_params:
        provided_value = params.get(param.name)
        if param.required and provided_value is None:
            raise HTTPException(status_code=400, detail=f"Missing required parameter: {param.name}")
        if provided_value is not None:
            if param.type == 'file':
                if not isinstance(provided_value, UploadFile):
                    raise HTTPException(status_code=400, detail=f"Expected a file for parameter {param.name}")
            else:
                # Check for parameter type consistency
                if param.type == 'int' and not isinstance(provided_value, int):
                    raise HTTPException(status_code=400, detail=f"Incorrect type for parameter {param.name}: expected int")
                if param.type == 'float' and not isinstance(provided_value, float):
                    raise HTTPException(status_code=400, detail=f"Incorrect type for parameter {param.name}: expected float")
                if param.type == 'str' and not isinstance(provided_value, str):
                    raise HTTPException(status_code=400, detail=f"Incorrect type for parameter {param.name}: expected string")

    # Handle file uploads specifically
    for param_name, upload_file in params.items():
        if isinstance(upload_file, UploadFile):
            # Process the file based on your workflow needs
            file_contents = await upload_file.read()
            # Depending on what you do with the file, process it here
            await upload_file.close()

    # Simulate running the workflow
    print(f"Running workflow: {workflow.name} with params: {params}")
    run_id = 1  # Placeholder for actual running logic
    return run_id
