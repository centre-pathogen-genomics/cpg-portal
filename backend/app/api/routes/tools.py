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
    Tool,
    ToolCreateWithParamsAndTargets,
    ToolPublic,
    ToolPublicWithParamsAndTargets,
    ToolsPublicWithParamsAndTargets,
    ToolUpdate,
    UserFavouriteToolsLink,
)

router = APIRouter()


@router.get("/", response_model=ToolsPublicWithParamsAndTargets)
def read_tools(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve tools with a favourited status for the current user.
    """
    # Build the query
    query = (
        select(
            Tool,
            UserFavouriteToolsLink.tool_id.label("favourited_tool_id")
        )
        .join(
            UserFavouriteToolsLink,
            (UserFavouriteToolsLink.tool_id == Tool.id)
            & (UserFavouriteToolsLink.user_id == current_user.id),
            isouter=True,  # LEFT JOIN to include all tools
        )
        .order_by(Tool.run_count.desc())
        .offset(skip)
        .limit(limit)
    )

    # Apply enabled filter for non-superusers
    if not current_user.is_superuser:
        query = query.where(Tool.enabled)

    # Execute the query
    result = session.exec(query).all()

    # Process results
    tools_with_favourite_status = [
        ToolPublicWithParamsAndTargets(
            **tool.dict(),  # Include all fields from the Tool model
            params=tool.params,  # Related params
            targets=tool.targets,  # Related targets
            favourited=favourited_tool_id is not None  # Check if the tool is favorited
        )
        for tool, favourited_tool_id in result
    ]

    # Count total tools
    count_query = select(func.count()).select_from(Tool)
    if not current_user.is_superuser:
        count_query = count_query.where(Tool.enabled)
    count = session.exec(count_query).one()

    return ToolsPublicWithParamsAndTargets(data=tools_with_favourite_status, count=count)


@router.get("/{tool_id}", response_model=ToolPublicWithParamsAndTargets)
def read_tool(
    *, session: SessionDep, current_user: CurrentUser, tool_id: uuid.UUID
) -> Any:
    """
    Retrieve tool by ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if not current_user.is_superuser and not tool.enabled:
        raise HTTPException(status_code=403, detail="Tool is disabled")
    return tool


@router.post("/{tool_id}/favourite", response_model=Message)
def favourite_tool(tool_id: uuid.UUID, session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Add a tool to the current user's favourites.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    # Check if already favorited
    exists = session.exec(
        select(UserFavouriteToolsLink.tool_id)
        .where(UserFavouriteToolsLink.user_id == current_user.id)
        .where(UserFavouriteToolsLink.tool_id == tool_id)
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Tool already favorited")
    # Add to favourites
    tool.favourited_by.append(current_user)
    session.add(tool)
    session.commit()
    return Message(message="Tool favourited successfully")


@router.delete("/{tool_id}/favourite", response_model=Message)
def unfavourite_tool(tool_id: uuid.UUID, session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Remove a tool from the current user's favourites.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    # Check if already favorited
    exists = session.exec(
        select(UserFavouriteToolsLink.tool_id)
        .where(UserFavouriteToolsLink.user_id == current_user.id)
        .where(UserFavouriteToolsLink.tool_id == tool_id)
    ).first()
    if not exists:
        raise HTTPException(status_code=400, detail="Tool not favorited")
    # Remove from favourites
    tool.favourited_by.remove(current_user)
    session.add(tool)
    session.commit()
    return Message(message="Tool removed from favourites successfully")


@router.get("/name/{tool_name}", response_model=ToolPublicWithParamsAndTargets)
def read_tool_by_name(
    *, session: SessionDep, current_user: CurrentUser, tool_name: str
) -> Any:
    """
    Retrieve tool by name.
    """
    # Query the tool by name
    tool = session.query(Tool).filter(func.lower(Tool.name) == tool_name.lower()).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if not current_user.is_superuser and not tool.enabled:
        raise HTTPException(status_code=403, detail="Tool is disabled")
    return tool


@router.post("/", response_model=ToolPublicWithParamsAndTargets)
def create_tool(
    *,
    session: SessionDep,
    current_user: SuperUser,
    tool_in: ToolCreateWithParamsAndTargets,
) -> Any:
    """
    Create new tool along with its params.
    """
    tool = Tool(
        **tool_in.dict(exclude={"params", "targets"}), owner_id=current_user.id
    )
    session.add(tool)
    session.commit()
    session.refresh(tool)

    # Create params if they are provided
    params = [
        Param(**param.dict(), tool_id=tool.id) for param in tool_in.params
    ]
    if params:
        session.add_all(params)
        session.commit()

    # Create targets if they are provided
    targets = [
        Target(**target.dict(), tool_id=tool.id) for target in tool_in.targets
    ]
    if targets:
        session.add_all(targets)
        session.commit()

    return tool


@router.patch("/{tool_id}", dependencies=[Depends(get_current_active_superuser)], response_model=ToolPublic)
def update_tool(
    *,
    session: SessionDep,
    tool_id: uuid.UUID,
    tool_in: ToolUpdate,
) -> Any:
    """
    Update tool by ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    tool_data = tool_in.dict(exclude_unset=True)
    for key, value in tool_data.items():
        setattr(tool, key, value)
    session.add(tool)
    session.commit()
    session.refresh(tool)
    return tool

@router.delete("/{tool_id}", dependencies=[Depends(get_current_active_superuser)], response_model=Message)
def delete_tool(
    *, session: SessionDep, tool_id: uuid.UUID
) -> Any:
    """
    Delete tool by ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    # TODO: Delete all params, targets and runs associated with this tool
    # add cascade delete to the relationships
    print(f"Deleting tool {tool_id}")
    session.delete(tool)
    session.commit()
    return Message(message="Tool deleted successfully")

@router.get("/{tool_id}/params", response_model=list[Param])
def read_tool_params(
    *, session: SessionDep, current_user: CurrentUser, tool_id: uuid.UUID
) -> Any:
    """
    Retrieve tool params by tool ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if not current_user.is_superuser and not tool.enabled:
        raise HTTPException(status_code=403, detail="Tool is disabled")
    return tool.params


@router.post("/{tool_id}/params", dependencies=[Depends(get_current_active_superuser)], response_model=Param)
def add_param_to_tool(
    *,
    session: SessionDep,
    tool_id: uuid.UUID,
    param: ParamCreate,
) -> Any:
    """
    Add param to tool by tool ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    param = Param(**param.dict(), tool_id=tool_id)
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

@router.patch("/{tool_id}/params/{param_id}", dependencies=[Depends(get_current_active_superuser)], response_model=Param)
def update_param_in_tool(
    *,
    session: SessionDep,
    tool_id: uuid.UUID,
    param_id: uuid.UUID,
    in_param: ParamUpdate,
) -> Any:
    """
    Update param in tool by tool ID and param ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    param = session.get(Param, param_id)
    if not param:
        raise HTTPException(status_code=404, detail="Param not found")
    if param.tool_id != tool_id:
        raise HTTPException(status_code=400, detail="Param does not belong to this tool")
    param_data = in_param.dict(exclude_unset=True)
    for key, value in param_data.items():
        setattr(param, key, value)
    session.add(param)
    session.commit()
    session.refresh(param)
    return param


@router.delete("/{tool_id}/params/{param_id}", dependencies=[Depends(get_current_active_superuser)], response_model=Message)
def delete_param_from_tool(
    *, session: SessionDep, tool_id: uuid.UUID, param_id: uuid.UUID
) -> Any:
    """
    Delete param from tool by tool ID and param ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    param = session.get(Param, param_id)
    if not param:
        raise HTTPException(status_code=404, detail="Param not found")
    session.delete(param)
    session.commit()
    return Message(message="Param deleted successfully")

@router.get("/{tool_id}/targets", response_model=list[Target])
def read_tool_targets(
    *, session: SessionDep, current_user: CurrentUser, tool_id: uuid.UUID
) -> Any:
    """
    Retrieve tool targets by tool ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if not current_user.is_superuser and not tool.enabled:
        raise HTTPException(status_code=403, detail="Tool is disabled")
    return tool.targets


@router.post("/{tool_id}/targets", dependencies=[Depends(get_current_active_superuser)], response_model=Target)
def add_target_to_tool(
    *,
    session: SessionDep,
    tool_id: uuid.UUID,
    target: TargetCreate,
) -> Any:
    """
    Add target to tool by tool ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    target = Target(**target.dict(), tool_id=tool_id)
    session.add(target)
    session.commit()
    session.refresh(target)
    return target

@router.patch("/{tool_id}/targets/{target_id}", dependencies=[Depends(get_current_active_superuser)], response_model=Target)
def update_target_in_tool(
    *,
    session: SessionDep,
    tool_id: uuid.UUID,
    target_id: uuid.UUID,
    in_target: TargetUpdate,
) -> Any:
    """
    Update target in tool by tool ID and target ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    if target.tool_id != tool_id:
        raise HTTPException(status_code=400, detail="Target does not belong to this tool")
    target_data = in_target.dict(exclude_unset=True)
    for key, value in target_data.items():
        setattr(target, key, value)
    session.add(target)
    session.commit()
    session.refresh(target)
    return target


@router.delete("/{tool_id}/targets/{target_id}", dependencies=[Depends(get_current_active_superuser)], response_model=Message)
def delete_target_from_tool(
    *, session: SessionDep, tool_id: uuid.UUID, target_id: uuid.UUID
) -> Any:
    """
    Delete target from tool by tool ID and target ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    target = session.get(Target, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    session.delete(target)
    session.commit()
    return Message(message="Target deleted successfully")

