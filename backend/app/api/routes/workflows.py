import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import func, select

from app.api.deps import (
    CurrentUser,
    SessionDep,
    SuperUser,
    get_current_active_superuser,
)
from app.models import (
    Message,
    Param,
    ParamCreate,
    ParamUpdate,
    Target,
    TargetCreate,
    TargetUpdate,
    Workflow,
    WorkflowCreateWithParamsAndTargets,
    WorkflowPublic,
    WorkflowPublicWithParamsAndTargets,
    WorkflowsPublicWithParamsAndTargets,
    WorkflowUpdate,
)

router = APIRouter()


@router.get("/", response_model=WorkflowsPublicWithParamsAndTargets)
def read_workflows(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve workflows.
    """
    query = select(Workflow).offset(skip).limit(limit)
    if not current_user.is_superuser:
        query = query.where(Workflow.enabled)
    workflows = session.exec(query).all()
    count = session.exec(select(func.count()).select_from(Workflow)).one()
    return WorkflowsPublicWithParamsAndTargets(data=workflows, count=count)


@router.get("/{workflow_id}", response_model=WorkflowPublicWithParamsAndTargets)
def read_workflow(
    *, session: SessionDep, current_user: CurrentUser, workflow_id: uuid.UUID
) -> Any:
    """
    Retrieve workflow by ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not current_user.is_superuser and not workflow.enabled:
        raise HTTPException(status_code=403, detail="Workflow is disabled")
    return workflow


@router.get("/name/{workflow_name}", response_model=WorkflowPublicWithParamsAndTargets)
def read_workflow_by_name(
    *, session: SessionDep, current_user: CurrentUser, workflow_name: str
) -> Any:
    """
    Retrieve workflow by name.
    """
    # Query the workflow by name
    workflow = session.query(Workflow).filter(func.lower(Workflow.name) == workflow_name.lower()).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not current_user.is_superuser and not workflow.enabled:
        raise HTTPException(status_code=403, detail="Workflow is disabled")
    return workflow


@router.post("/", response_model=WorkflowPublicWithParamsAndTargets)
def create_workflow(
    *,
    session: SessionDep,
    current_user: SuperUser,
    workflow_in: WorkflowCreateWithParamsAndTargets,
) -> Any:
    """
    Create new workflow along with its params.
    """
    workflow = Workflow(
        **workflow_in.dict(exclude={"params", "targets"}), owner_id=current_user.id
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

    # Create targets if they are provided
    targets = [
        Target(**target.dict(), workflow_id=workflow.id) for target in workflow_in.targets
    ]
    if targets:
        session.add_all(targets)
        session.commit()

    return workflow


@router.patch("/{workflow_id}", dependencies=[Depends(get_current_active_superuser)], response_model=WorkflowPublic)
def update_workflow(
    *,
    session: SessionDep,
    workflow_id: uuid.UUID,
    workflow_in: WorkflowUpdate,
) -> Any:
    """
    Update workflow by ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    workflow_data = workflow_in.dict(exclude_unset=True)
    for key, value in workflow_data.items():
        setattr(workflow, key, value)
    session.add(workflow)
    session.commit()
    session.refresh(workflow)
    return workflow

@router.delete("/{workflow_id}", dependencies=[Depends(get_current_active_superuser)], response_model=Message)
def delete_workflow(
    *, session: SessionDep, workflow_id: uuid.UUID
) -> Any:
    """
    Delete workflow by ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    # TODO: Delete all params, targets and tasks associated with this workflow
    # add cascade delete to the relationships
    print(f"Deleting workflow {workflow_id}")
    session.delete(workflow)
    session.commit()
    return Message(message="Workflow deleted successfully")

@router.get("/{workflow_id}/params", response_model=list[Param])
def read_workflow_params(
    *, session: SessionDep, current_user: CurrentUser, workflow_id: uuid.UUID
) -> Any:
    """
    Retrieve workflow params by workflow ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not current_user.is_superuser and not workflow.enabled:
        raise HTTPException(status_code=403, detail="Workflow is disabled")
    return workflow.params


@router.post("/{workflow_id}/params", dependencies=[Depends(get_current_active_superuser)], response_model=Param)
def add_param_to_workflow(
    *,
    session: SessionDep,
    workflow_id: uuid.UUID,
    param: ParamCreate,
) -> Any:
    """
    Add param to workflow by workflow ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
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

@router.patch("/{workflow_id}/params/{param_id}", dependencies=[Depends(get_current_active_superuser)], response_model=Param)
def update_param_in_workflow(
    *,
    session: SessionDep,
    workflow_id: uuid.UUID,
    param_id: uuid.UUID,
    in_param: ParamUpdate,
) -> Any:
    """
    Update param in workflow by workflow ID and param ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
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


@router.delete("/{workflow_id}/params/{param_id}", dependencies=[Depends(get_current_active_superuser)], response_model=Message)
def delete_param_from_workflow(
    *, session: SessionDep, workflow_id: uuid.UUID, param_id: uuid.UUID
) -> Any:
    """
    Delete param from workflow by workflow ID and param ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    param = session.get(Param, param_id)
    if not param:
        raise HTTPException(status_code=404, detail="Param not found")
    session.delete(param)
    session.commit()
    return Message(message="Param deleted successfully")

@router.get("/{workflow_id}/targets", response_model=list[Target])
def read_workflow_targets(
    *, session: SessionDep, current_user: CurrentUser, workflow_id: uuid.UUID
) -> Any:
    """
    Retrieve workflow targets by workflow ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not current_user.is_superuser and not workflow.enabled:
        raise HTTPException(status_code=403, detail="Workflow is disabled")
    return workflow.targets


@router.post("/{workflow_id}/targets", dependencies=[Depends(get_current_active_superuser)], response_model=Target)
def add_target_to_workflow(
    *,
    session: SessionDep,
    workflow_id: uuid.UUID,
    target: TargetCreate,
) -> Any:
    """
    Add target to workflow by workflow ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    target = Target(**target.dict(), workflow_id=workflow_id)
    session.add(target)
    session.commit()
    session.refresh(target)
    return target

@router.patch("/{workflow_id}/targets/{target_id}", dependencies=[Depends(get_current_active_superuser)], response_model=Target)
def update_target_in_workflow(
    *,
    session: SessionDep,
    workflow_id: uuid.UUID,
    target_id: uuid.UUID,
    in_target: TargetUpdate,
) -> Any:
    """
    Update target in workflow by workflow ID and target ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    if target.workflow_id != workflow_id:
        raise HTTPException(status_code=400, detail="Target does not belong to this workflow")
    target_data = in_target.dict(exclude_unset=True)
    for key, value in target_data.items():
        setattr(target, key, value)
    session.add(target)
    session.commit()
    session.refresh(target)
    return target


@router.delete("/{workflow_id}/targets/{target_id}", dependencies=[Depends(get_current_active_superuser)], response_model=Message)
def delete_target_from_workflow(
    *, session: SessionDep, workflow_id: uuid.UUID, target_id: uuid.UUID
) -> Any:
    """
    Delete target from workflow by workflow ID and target ID.
    """
    workflow = session.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    session.delete(target)
    session.commit()
    return Message(message="Target deleted successfully")

