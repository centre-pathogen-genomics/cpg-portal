import uuid
from enum import Enum
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlmodel import func, select

from app.api.deps import (
    CurrentUser,
    SessionDep,
    SuperUser,
    get_current_active_superuser,
)
from app.models import (
    Message,
    Tool,
    ToolCreate,
    ToolPublic,
    ToolsPublic,
    ToolUpdate,
    UserFavouriteToolsLink,
)
from app.tasks import install_tool as install_tool_task
from app.tasks import uninstall_tool as uninstall_tool_task

router = APIRouter()


class ToolsOrderBy(str, Enum):
    created_at = "created_at"
    run_count = "run_count"

@router.get("/", response_model=ToolsPublic)
def read_tools(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    order_by: ToolsOrderBy = ToolsOrderBy.run_count,
    show_favourites: bool = False,
    search: str = None,
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
        .order_by(getattr(Tool, order_by).desc())
        .offset(skip)
        .limit(limit)
    )

    # Apply enabled filter for non-superusers
    if not current_user.is_superuser:
        query = query.where((Tool.enabled) & (Tool.status == "installed"))

    if show_favourites:
        query = query.where(UserFavouriteToolsLink.user_id == current_user.id)

    if search:
        search_lower = search.strip().lower()

        # Build your overall query.
        query = query.where(
            or_(
                func.lower(Tool.name).contains(search_lower),
                func.lower(Tool.description).contains(search_lower),
                Tool.tags.contains([search]), # tags must be exact match
            )
        )
    # Execute the query
    result = session.exec(query).all()

    # Process results
    tools_with_favourite_status = []
    for tool, favourited_tool_id in result:
        tool_public = ToolPublic.from_orm(tool)
        tool_public.favourited = favourited_tool_id is not None
        tools_with_favourite_status.append(tool_public)


    # Count total tools
    count_query = select(func.count()).select_from(Tool)
    if not current_user.is_superuser:
        count_query = count_query.where(Tool.enabled)
    count = session.exec(count_query).one()

    return ToolsPublic(data=tools_with_favourite_status, count=count)

def read_tool_with_favourite(
    session: SessionDep, current_user: CurrentUser, *, tool_id: uuid.UUID | None = None, name: str | None = None
) -> select:

    """
    Build the tool query based on the current user and show_favourites flag.
    """
    if (tool_id and name) or (not tool_id and not name):
        raise ValueError("Either tool_id or name must be provided")
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
    )
    if tool_id:
        query = query.where(Tool.id == tool_id)
    elif name:
        query = query.where(func.lower(Tool.name) == name.lower())

    # Apply enabled filter for non-superusers
    if not current_user.is_superuser:
        query = query.where((Tool.enabled) & (Tool.status == "installed"))
    result = session.exec(query).first()
    if not result:
        raise HTTPException(status_code=404, detail="Tool not found")
    tool, favourited_tool_id = result
    if not current_user.is_superuser and (not tool.enabled or tool.status != "installed"):
        raise HTTPException(status_code=403, detail="Tool is disabled")
    tool_public = ToolPublic.from_orm(tool)
    tool_public.favourited = favourited_tool_id is not None
    return tool_public

@router.get("/name/{tool_name}", response_model=ToolPublic)
def read_tool_by_name(
    *, session: SessionDep, current_user: CurrentUser, tool_name: str
) -> Any:
    """
    Retrieve tool by name.
    """
    # Query the tool by name
    tool_public = read_tool_with_favourite(session, current_user, name=tool_name)
    return tool_public

@router.get("/{tool_id}", response_model=ToolPublic)
def read_tool(
    *, session: SessionDep, current_user: CurrentUser, tool_id: uuid.UUID
) -> Any:
    """
    Retrieve tool by ID with favourited status.
    """
    # Query to retrieve the tool along with the favourited status
    tool_public = read_tool_with_favourite(session, current_user, tool_id=tool_id)
    return tool_public


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
    tool.favourited_count += 1
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
    tool.favourited_count -= 1
    session.add(tool)
    session.commit()
    return Message(message="Tool removed from favourites successfully")


@router.post("/", response_model=ToolPublic)
def create_tool(
    *,
    session: SessionDep,
    current_user: SuperUser,  # noqa: ARG001
    tool_in: ToolCreate,
) -> Any:
    """
    Create new tool along with its params.
    """
    tool = Tool(
        **tool_in.dict()
    )
    session.add(tool)
    session.commit()
    session.refresh(tool)

    return tool

@router.post("/{tool_id}/enable", response_model=Message)
def enable_tool(
    *,
    session: SessionDep,
    tool_id: uuid.UUID,
    current_user: SuperUser,  # noqa: ARG001
) -> Any:
    """
    Enable a tool by ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    tool.enabled = True
    session.add(tool)
    session.commit()
    return Message(message="Tool enabled successfully")

@router.post("/{tool_id}/disable", response_model=Message)
def disable_tool(
    *,
    session: SessionDep,
    tool_id: uuid.UUID,
    current_user: SuperUser,  # noqa: ARG001
) -> Any:
    """
    Disable a tool by ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    tool.enabled = False
    session.add(tool)
    session.commit()
    return Message(message="Tool disabled successfully")

@router.post("/{tool_id}/enable_llm_summary", response_model=Message, dependencies=[Depends(get_current_active_superuser)])
def enable_llm_summary(
    *,
    session: SessionDep,
    tool_id: uuid.UUID,
) -> Any:
    """
    Enable a tool by ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    tool.llm_summary_enabled = True
    session.add(tool)
    session.commit()
    return Message(message="LLM summary enabled successfully")

@router.post("/{tool_id}/disable_llm_summary", response_model=Message, dependencies=[Depends(get_current_active_superuser)])
def disable_llm_summary(
    *,
    session: SessionDep,
    tool_id: uuid.UUID,
) -> Any:
    """
    Disable a tool by ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    tool.llm_summary_enabled = False
    session.add(tool)
    session.commit()
    return Message(message="LLM summary disabled successfully")




@router.post("/{tool_id}/install", response_model=Message)
async def install_tool(
    *,
    session: SessionDep,
    tool_id: uuid.UUID,
    current_user: SuperUser,  # noqa: ARG001
) -> Any:
    """
    Install a tool by ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if tool.status == "installing":
        raise HTTPException(status_code=400, detail="Tool is already being installed")

    if tool.conda_env is None:
        tool.status = "installed"
        session.add(tool)
        session.commit()
        return Message(message="Tool installed successfully")

    tool.status = "installing"
    tool.installation_log = ""
    session.add(tool)
    session.commit()

    taskiq_task = await install_tool_task.kiq(tool_id=tool.id)

    return Message(message=f"Tool installation task {taskiq_task.task_id} started")

@router.delete("/{tool_id}/uninstall", response_model=Message)
async def uninstall_tool(
    *,
    session: SessionDep,
    tool_id: uuid.UUID,
    current_user: SuperUser,  # noqa: ARG001
) -> Any:
    """
    Uninstall a tool by ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if tool.status == "installing":
        raise HTTPException(status_code=400, detail="Tool is being installed")

    taskiq_task = await uninstall_tool_task.kiq(tool_id=tool.id)

    return Message(message=f"Tool uninstallation task {taskiq_task.task_id} started")


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
    if tool.status == "installing":
        raise HTTPException(status_code=400, detail="Tool is being installed")
    if tool.status == "uninstalling":
        raise HTTPException(status_code=400, detail="Tool is being uninstalled")
    if tool.status == "installed":
        raise HTTPException(status_code=400, detail="Tool is installed")
    print(f"Deleting tool {tool_id}")
    session.delete(tool)
    session.commit()
    return Message(message="Tool deleted successfully")

