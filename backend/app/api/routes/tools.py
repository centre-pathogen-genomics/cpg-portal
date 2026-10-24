import uuid
from enum import StrEnum
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, update
from sqlmodel import Session, col, func, select

from app.api.deps import (
    CurrentUser,
    CurrentUserOrAnonymous,
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
    ToolStatus,
    ToolUpdate,
    UserFavouriteToolsLink,
)
from app.tasks import install_tool as install_tool_task
from app.tasks import uninstall_tool as uninstall_tool_task
from app.tasks import update_tool as update_tool_task

router = APIRouter()

# Enabled tools stay visible while their environment is being installed or
# updated: runs for them queue up and start once the tool is ready.
VISIBLE_TOOL_STATUSES = (
    ToolStatus.installed,
    ToolStatus.install_queued,
    ToolStatus.installing,
    ToolStatus.update_queued,
    ToolStatus.updating,
    ToolStatus.uninstalled,
    ToolStatus.failed,
)


class ToolsOrderBy(StrEnum):
    created_at = "created_at"
    run_count = "run_count"


@router.get("/", response_model=ToolsPublic)
def read_tools(
    session: SessionDep,
    current_user: CurrentUserOrAnonymous,
    skip: int = 0,
    limit: int = 100,
    order_by: ToolsOrderBy = ToolsOrderBy.run_count,
    show_favourites: bool = False,
    search: str = None,
) -> Any:
    """
    Retrieve tools with a favourited status for the current user.

    One row per tool name, so a stack of versions lists once: the version the
    plain name path serves (the default), or else the earliest one this user
    can see.
    """
    filters: list[Any] = []
    # Apply enabled filter for non-superusers
    if current_user is None or not current_user.is_superuser:
        filters.extend([Tool.enabled, Tool.status.in_(VISIBLE_TOOL_STATUSES)])

    if show_favourites and current_user is not None:
        filters.append(
            Tool.id.in_(
                select(UserFavouriteToolsLink.tool_id).where(
                    UserFavouriteToolsLink.user_id == current_user.id
                )
            )
        )

    if search:
        search_lower = search.strip().lower()

        # Build your overall query.
        filters.append(
            or_(
                func.lower(Tool.name).contains(search_lower),
                func.lower(Tool.description).contains(search_lower),
                Tool.tags.contains([search]),  # tags must be exact match
            )
        )

    # The row that stands for a name: its default version when that one is
    # visible, else the version created first.
    one_per_name = (
        select(Tool.id)
        .where(*filters)
        .distinct(func.lower(Tool.name))
        .order_by(
            func.lower(Tool.name),
            Tool.is_default.desc(),
            Tool.created_at.asc(),
        )
        .subquery()
    )
    count = session.exec(select(func.count()).select_from(one_per_name)).one()

    result: list[tuple[Tool, uuid.UUID | None]]
    if current_user is None:
        # If the user is anonymous, we don't need to join with UserFavouriteToolsLink
        result = [
            (tool, None)
            for tool in session.exec(
                select(Tool)
                .where(Tool.id.in_(select(one_per_name.c.id)))
                .order_by(getattr(Tool, order_by).desc())
                .offset(skip)
                .limit(limit)
            ).all()
        ]
    else:
        rows = session.exec(
            select(Tool, UserFavouriteToolsLink.tool_id.label("favourited_tool_id"))
            .join(
                UserFavouriteToolsLink,
                (UserFavouriteToolsLink.tool_id == Tool.id)
                & (UserFavouriteToolsLink.user_id == current_user.id),
                isouter=True,  # LEFT JOIN to include all tools
            )
            .where(Tool.id.in_(select(one_per_name.c.id)))
            .order_by(getattr(Tool, order_by).desc())
            .offset(skip)
            .limit(limit)
        ).all()
        result = [(tool, favourited_tool_id) for tool, favourited_tool_id in rows]

    # Process results
    tools_with_favourite_status = []
    for tool, favourited_tool_id in result:
        tool_public = ToolPublic.from_orm(tool)
        tool_public.favourited = favourited_tool_id is not None
        tools_with_favourite_status.append(tool_public)

    return ToolsPublic(data=tools_with_favourite_status, count=count)


def read_tool_with_favourite(
    session: SessionDep,
    current_user: CurrentUserOrAnonymous,
    *,
    tool_id: uuid.UUID | None = None,
    name: str | None = None,
    version: str | None = None,
) -> select:
    """
    Build the tool query based on the current user and show_favourites flag.

    Looking a tool up by name picks one of its versions: the one asked for, or
    the default of the stack when none is named.
    """
    if (tool_id and name) or (not tool_id and not name):
        raise ValueError("Either tool_id or name must be provided")
    if current_user is None:
        # If the user is anonymous, we don't need to join with UserFavouriteToolsLink
        query = select(Tool).where(Tool.enabled, Tool.status.in_(VISIBLE_TOOL_STATUSES))
        if tool_id:
            query = query.where(Tool.id == tool_id)
        elif name:
            query = query.where(func.lower(Tool.name) == name.lower())
            query = query.where(
                Tool.version == version if version is not None else Tool.is_default
            )
        return session.exec(query).first()
    query = select(
        Tool, UserFavouriteToolsLink.tool_id.label("favourited_tool_id")
    ).join(
        UserFavouriteToolsLink,
        (UserFavouriteToolsLink.tool_id == Tool.id)
        & (UserFavouriteToolsLink.user_id == current_user.id),
        isouter=True,  # LEFT JOIN to include all tools
    )
    if tool_id:
        query = query.where(Tool.id == tool_id)
    elif name:
        query = query.where(func.lower(Tool.name) == name.lower())
        query = query.where(
            Tool.version == version if version is not None else Tool.is_default
        )
    if not current_user.is_superuser:
        query = query.where(Tool.enabled, Tool.status.in_(VISIBLE_TOOL_STATUSES))
    result = session.exec(query).first()
    if not result:
        raise HTTPException(status_code=404, detail="Tool not found")
    tool, favourited_tool_id = result
    if not current_user.is_superuser and (
        not tool.enabled or tool.status not in VISIBLE_TOOL_STATUSES
    ):
        raise HTTPException(status_code=403, detail="Tool is disabled")
    tool_public = ToolPublic.from_orm(tool)
    tool_public.favourited = favourited_tool_id is not None
    return tool_public


@router.get("/name/{tool_name}", response_model=ToolPublic)
def read_tool_by_name(
    *,
    session: SessionDep,
    current_user: CurrentUserOrAnonymous,
    tool_name: str,
    version: str | None = Query(
        None, description="Version to load, defaulting to the stack's default"
    ),
) -> Any:
    """
    Retrieve a tool by name, one of its versions.

    Without a version the default of that name is returned, so `/tools/<name>`
    keeps working.
    """
    # Query the tool by name
    tool_public = read_tool_with_favourite(
        session, current_user, name=tool_name, version=version
    )
    return tool_public


@router.get("/name/{tool_name}/versions", response_model=list[ToolPublic])
def read_tool_versions(
    *,
    session: SessionDep,
    current_user: CurrentUserOrAnonymous,
    tool_name: str,
) -> Any:
    """
    List every version of a tool name, in the stack's order.

    Follows the same visibility rule as the single-tool reads: superusers see
    the whole stack, everyone else only the enabled versions.
    """
    query = select(Tool).where(func.lower(Tool.name) == tool_name.lower())
    if current_user is None or not current_user.is_superuser:
        query = query.where(Tool.enabled, Tool.status.in_(VISIBLE_TOOL_STATUSES))
    # A manual order first, then whatever was created earlier, which suits
    # versions that are git commit hashes.
    query = query.order_by(
        Tool.version_sort.asc().nulls_last(), Tool.created_at.asc()
    )
    tools = session.exec(query).all()
    if not tools:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tools


@router.get("/{tool_id}", response_model=ToolPublic)
def read_tool(
    *, session: SessionDep, current_user: CurrentUserOrAnonymous, tool_id: uuid.UUID
) -> Any:
    """
    Retrieve tool by ID with favourited status.
    """
    # Query to retrieve the tool along with the favourited status
    tool_public = read_tool_with_favourite(session, current_user, tool_id=tool_id)
    return tool_public


@router.post("/{tool_id}/favourite", response_model=Message)
def favourite_tool(
    tool_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> Any:
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
def unfavourite_tool(
    tool_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> Any:
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


def _validate_cpus(
    min_cpus: int, max_cpus: int | None, default_cpus: int | None
) -> None:
    """Runs pick min_cpus..max_cpus threads: a missing maximum means the user's
    own limit, a missing default means the tool's minimum."""
    if min_cpus < 1:
        raise HTTPException(
            status_code=422,
            detail="Threads must satisfy 1 <= min_cpus",
        )
    if max_cpus is not None and max_cpus < min_cpus:
        raise HTTPException(
            status_code=422,
            detail="Threads must satisfy min_cpus <= max_cpus",
        )
    if default_cpus is not None and default_cpus < min_cpus:
        raise HTTPException(
            status_code=422,
            detail="Threads must satisfy min_cpus <= default_cpus",
        )
    if max_cpus is not None and default_cpus is not None and default_cpus > max_cpus:
        raise HTTPException(
            status_code=422,
            detail="Threads must satisfy default_cpus <= max_cpus",
        )


def _tool_name_taken(
    session: Session, name: str, version: str, exclude_id: uuid.UUID | None = None
) -> bool:
    """Whether another tool already has this name and version."""
    query = select(Tool).where(Tool.name == name, Tool.version == version)
    if exclude_id is not None:
        query = query.where(Tool.id != exclude_id)
    return session.exec(query).first() is not None


def _set_tool_default(session: Session, tool: Tool, is_default: bool) -> None:
    """
    Keep exactly one default version per name.

    Asking for the default clears it on the others; asking to clear it leaves
    whatever the stack has, and the first version of a fresh name becomes the
    default so `/tools/<name>` always finds one.
    """
    if is_default:
        session.exec(
            update(Tool)
            .where(Tool.name == tool.name, col(Tool.id) != tool.id)
            .values(is_default=False)
        )
        tool.is_default = True
        return
    others = session.exec(
        select(Tool).where(Tool.name == tool.name, col(Tool.id) != tool.id)
    ).first()
    if others is None:
        # The only version of this name stays the default, or `/tools/<name>`
        # would find nothing.
        tool.is_default = True


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
    _validate_cpus(tool_in.min_cpus, tool_in.max_cpus, tool_in.default_cpus)
    if _tool_name_taken(session, tool_in.name, tool_in.version or ""):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Tool `{tool_in.name}` already has a version "
                f"`{tool_in.version or ''}`"
            ),
        )
    # The JSON columns keep plain dicts, so the validated models are dumped
    # instead of passed on: a `Param` model is not JSON serialisable for the
    # database.
    tool_data = tool_in.model_dump()
    tool_data["version"] = tool_in.version or ""
    tool = Tool(**tool_data)
    session.add(tool)
    _set_tool_default(session, tool, tool_in.is_default or False)
    session.commit()
    session.refresh(tool)

    return tool


@router.post(
    "/{tool_id}/versions",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=ToolPublic,
)
def create_tool_version(
    *,
    session: SessionDep,
    tool_id: uuid.UUID,
    version: str = Query(..., description="Version to add to the stack"),
) -> Any:
    """
    Add a version of a tool.

    A copy of the tool under the same name with the new version, disabled and
    not installed, ready to be edited.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    new_version = version.strip()
    if not new_version:
        raise HTTPException(status_code=400, detail="A version is required")
    if _tool_name_taken(session, tool.name, new_version):
        raise HTTPException(
            status_code=400,
            detail=f"Tool `{tool.name}` already has a version `{new_version}`",
        )
    # Everything that describes the tool is copied; what belongs to this
    # particular row (ids, counts, install state, the default flag) is not.
    copy_data = tool.model_dump(
        exclude={
            "id",
            "created_at",
            "status",
            "installation_log",
            "conda_env_pinned",
            "is_default",
            "version",
            "version_sort",
            "enabled",
            "favourited_count",
            "run_count",
        }
    )
    new_tool = Tool(
        **copy_data,
        version=new_version,
        version_sort=None,
        is_default=False,
        enabled=False,
        status=ToolStatus.uninstalled,
    )
    session.add(new_tool)
    session.commit()
    session.refresh(new_tool)
    return new_tool


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


@router.post(
    "/{tool_id}/enable_llm_summary",
    response_model=Message,
    dependencies=[Depends(get_current_active_superuser)],
)
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


@router.post(
    "/{tool_id}/disable_llm_summary",
    response_model=Message,
    dependencies=[Depends(get_current_active_superuser)],
)
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


@router.post("/{tool_id}/update", response_model=Message)
async def update_tool_post_install(
    *,
    session: SessionDep,
    tool_id: uuid.UUID,
    current_user: SuperUser,  # noqa: ARG001
) -> Any:
    """
    Update a tool by ID: its post-install command runs again against the
    environment it already has, which is how a tool refresh the data it
    downloaded without a reinstall.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if tool.status in {
        ToolStatus.install_queued,
        ToolStatus.installing,
        ToolStatus.update_queued,
        ToolStatus.updating,
    }:
        raise HTTPException(
            status_code=400, detail="Tool is already being installed or updated"
        )
    if tool.status != ToolStatus.installed:
        raise HTTPException(
            status_code=400, detail="Install the tool before updating it"
        )
    if not tool.post_install:
        raise HTTPException(
            status_code=400, detail="Tool has no post-install command to run"
        )

    tool.status = ToolStatus.update_queued
    tool.installation_log = "Update queued."
    session.add(tool)
    session.commit()

    taskiq_task = await update_tool_task.kiq(tool_id=tool.id)

    return Message(message=f"Tool update task {taskiq_task.task_id} started")


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
    if tool.status in {ToolStatus.install_queued, ToolStatus.installing}:
        raise HTTPException(status_code=400, detail="Tool is already being installed")

    if tool.conda_env is None:
        tool.status = ToolStatus.installed
        session.add(tool)
        session.commit()
        return Message(message="Tool installed successfully")

    tool.status = ToolStatus.install_queued
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
    if tool.status in {ToolStatus.install_queued, ToolStatus.installing}:
        raise HTTPException(status_code=400, detail="Tool is being installed")

    if tool.conda_env is None:
        tool.status = ToolStatus.uninstalled
        tool.conda_env_pinned = None
        tool.installation_log = "No Conda environment configured; tool uninstalled."
        session.add(tool)
        session.commit()
        return Message(message="Tool uninstalled successfully")

    taskiq_task = await uninstall_tool_task.kiq(tool_id=tool.id)

    return Message(message=f"Tool uninstallation task {taskiq_task.task_id} started")


@router.patch(
    "/{tool_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=ToolPublic,
)
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
    _validate_cpus(
        tool_data.get("min_cpus", tool.min_cpus),
        tool_data.get("max_cpus", tool.max_cpus),
        tool_data.get("default_cpus", tool.default_cpus),
    )
    new_name = tool_data.get("name", tool.name)
    new_version = tool_data.get("version") or ""
    if _tool_name_taken(session, new_name, new_version, exclude_id=tool.id):
        raise HTTPException(
            status_code=400,
            detail=f"Tool `{new_name}` already has a version `{new_version}`",
        )
    requested_default = tool_data.pop("is_default", None)
    for key, value in tool_data.items():
        setattr(tool, key, value)
    if "version" in tool_data or "name" in tool_data:
        tool.version = new_version
    session.add(tool)
    if requested_default is not None:
        _set_tool_default(session, tool, bool(requested_default))
    session.commit()
    session.refresh(tool)
    return tool


@router.delete(
    "/{tool_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=Message,
)
def delete_tool(*, session: SessionDep, tool_id: uuid.UUID) -> Any:
    """
    Delete tool by ID.
    """
    tool = session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    # TODO: Delete all params, targets and runs associated with this tool
    # add cascade delete to the relationships
    if tool.status in {ToolStatus.install_queued, ToolStatus.installing}:
        raise HTTPException(status_code=400, detail="Tool is being installed")
    if tool.status == ToolStatus.uninstalling:
        raise HTTPException(status_code=400, detail="Tool is being uninstalled")
    if tool.status == ToolStatus.installed:
        raise HTTPException(status_code=400, detail="Tool is installed")
    print(f"Deleting tool {tool_id}")
    session.delete(tool)
    session.commit()
    return Message(message="Tool deleted successfully")
