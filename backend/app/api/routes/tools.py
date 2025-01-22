import uuid
from enum import Enum
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
    Tool,
    ToolCreate,
    ToolPublic,
    ToolsPublic,
    ToolUpdate,
    UserFavouriteToolsLink,
)

router = APIRouter()


class ToolsOrderBy(str, Enum):
    created_at = "created_at"
    run_count = "run_count"

@router.get("/", response_model=ToolsPublic)
def read_tools(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100, order_by: ToolsOrderBy = ToolsOrderBy.run_count, show_favourites: bool = False
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
        query = query.where(Tool.enabled)

    if show_favourites:
        query = query.where(UserFavouriteToolsLink.user_id == current_user.id)

    # Execute the query
    result = session.exec(query).all()

    # Process results
    tools_with_favourite_status = [
        ToolPublic(
            **tool.dict(),  # Include all fields from the Tool model
            favourited=favourited_tool_id is not None  # Check if the tool is favorited
        )
        for tool, favourited_tool_id in result
    ]

    # Count total tools
    count_query = select(func.count()).select_from(Tool)
    if not current_user.is_superuser:
        count_query = count_query.where(Tool.enabled)
    count = session.exec(count_query).one()

    return ToolsPublic(data=tools_with_favourite_status, count=count)


@router.get("/{tool_id}", response_model=ToolPublic)
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


@router.get("/name/{tool_name}", response_model=ToolPublic)
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

