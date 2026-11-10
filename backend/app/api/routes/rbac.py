"""Role-based access control: roles, the permission catalog and assignments."""

import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, desc, func
from sqlmodel import col, select

from app.api.deps import SessionDep
from app.api.permission_router import PermissionAPIRouter
from app.core.rbac import effective_permission_names
from app.models import (
    Message,
    Permission,
    PermissionPublic,
    RbacUserPublic,
    RbacUsersPublic,
    Role,
    RoleCreate,
    RolePermission,
    RolePublic,
    RolesPublic,
    RoleUpdate,
    User,
    UserAccessPublic,
    UserAccessUpdate,
    UserPermission,
    UserRole,
)

router = PermissionAPIRouter(resource="rbac")


def _role_permissions(session: SessionDep, role_id: uuid.UUID) -> list[str]:
    names = session.exec(
        select(RolePermission.permission_name).where(
            col(RolePermission.role_id) == role_id
        )
    ).all()
    return sorted(names)


def _role_public(session: SessionDep, role: Role) -> RolePublic:
    return RolePublic(
        id=role.id,
        name=role.name,
        description=role.description,
        is_default=role.is_default,
        permissions=_role_permissions(session, role.id),
    )


def _validated_permission_names(session: SessionDep, names: list[str]) -> list[str]:
    """Deduplicated permission names, rejecting any the catalog does not know."""
    unique_names = sorted(set(names))
    if not unique_names:
        return []
    known = set(
        session.exec(
            select(Permission.name).where(col(Permission.name).in_(unique_names))
        ).all()
    )
    unknown = [name for name in unique_names if name not in known]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown permission: {unknown[0]}")
    return unique_names


def _user_access(session: SessionDep, user: User) -> UserAccessPublic:
    role_ids = [
        role_id
        for role_id in session.exec(
            select(UserRole.role_id).where(col(UserRole.user_id) == user.id)
        ).all()
        if role_id is not None
    ]
    direct = [
        name
        for name in session.exec(
            select(UserPermission.permission_name).where(
                col(UserPermission.user_id) == user.id
            )
        ).all()
        if name is not None
    ]
    return UserAccessPublic(
        user_id=user.id,
        role_ids=sorted(role_ids),
        permissions=sorted(direct),
        effective_permissions=sorted(effective_permission_names(session, user)),
    )


@router.get("/permissions", response_model=list[PermissionPublic])
def read_permissions(session: SessionDep) -> Any:
    """
    List every permission the code enforces.
    """
    return session.exec(select(Permission).order_by(col(Permission.name))).all()


@router.get("/roles", response_model=RolesPublic)
def read_roles(session: SessionDep) -> Any:
    """
    List roles, the default one first.
    """
    roles = session.exec(
        select(Role).order_by(desc(col(Role.is_default)), col(Role.name))
    ).all()
    return RolesPublic(
        data=[_role_public(session, role) for role in roles], count=len(roles)
    )


@router.post("/roles", response_model=RolePublic)
def create_role(*, session: SessionDep, role_in: RoleCreate) -> Any:
    """
    Create a role that grants the given permissions.
    """
    name = role_in.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Role name cannot be empty")
    if session.exec(select(Role).where(col(Role.name) == name)).first():
        raise HTTPException(status_code=409, detail="A role with that name exists")

    permission_names = _validated_permission_names(session, role_in.permissions)
    role = Role(name=name, description=role_in.description, is_default=False)
    session.add(role)
    session.flush()
    for permission_name in permission_names:
        session.add(
            instance=RolePermission(role_id=role.id, permission_name=permission_name)
        )
    session.commit()
    session.refresh(role)
    return _role_public(session, role)


@router.patch("/roles/{role_id}", response_model=RolePublic)
def update_role(*, session: SessionDep, role_id: uuid.UUID, role_in: RoleUpdate) -> Any:
    """
    Rename a role, change its description, or replace its permissions.
    """
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_default:
        raise HTTPException(
            status_code=400, detail="The default role is managed by the server"
        )

    if role_in.name is not None:
        name = role_in.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Role name cannot be empty")
        collision = session.exec(
            select(Role).where(col(Role.name) == name, col(Role.id) != role.id)
        ).first()
        if collision:
            raise HTTPException(status_code=409, detail="A role with that name exists")
        role.name = name
    if role_in.description is not None:
        role.description = role_in.description

    if role_in.permissions is not None:
        permission_names = _validated_permission_names(session, role_in.permissions)
        session.exec(
            delete(RolePermission).where(col(RolePermission.role_id) == role.id)
        )
        for permission_name in permission_names:
            session.add(
                RolePermission(role_id=role.id, permission_name=permission_name)
            )

    session.add(role)
    session.commit()
    session.refresh(role)
    return _role_public(session, role)


@router.delete("/roles/{role_id}", response_model=Message)
def delete_role(*, session: SessionDep, role_id: uuid.UUID) -> Any:
    """
    Delete a role. Assignments to it go with it.
    """
    role = session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_default:
        raise HTTPException(
            status_code=400, detail="The default role is managed by the server"
        )
    session.delete(role)
    session.commit()
    return Message(message="Role deleted successfully")


@router.get("/users", response_model=RbacUsersPublic)
def read_rbac_users(session: SessionDep, skip: int = 0, limit: int = 1000) -> Any:
    """
    List the users whose access can be assigned.
    """
    count = session.exec(select(func.count()).select_from(User)).one()
    users = session.exec(
        select(User).order_by(col(User.email)).offset(skip).limit(limit)
    ).all()
    return RbacUsersPublic(
        data=[
            RbacUserPublic(id=user.id, email=user.email, full_name=user.full_name)
            for user in users
        ],
        count=count,
    )


@router.get("/users/{user_id}/access", response_model=UserAccessPublic)
def read_user_access(session: SessionDep, user_id: uuid.UUID) -> Any:
    """
    Read a user's roles, direct permissions and the effective union.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_access(session, user)


@router.put("/users/{user_id}/access", response_model=UserAccessPublic)
def update_user_access(
    *, session: SessionDep, user_id: uuid.UUID, access_in: UserAccessUpdate
) -> Any:
    """
    Replace a user's roles and direct permissions.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role_ids = sorted(set(access_in.role_ids))
    if role_ids:
        known_roles = set(
            session.exec(select(Role.id).where(col(Role.id).in_(role_ids))).all()
        )
        unknown_role = next(
            (role_id for role_id in role_ids if role_id not in known_roles), None
        )
        if unknown_role is not None:
            raise HTTPException(status_code=400, detail=f"Unknown role: {unknown_role}")

    permission_names = _validated_permission_names(session, access_in.permissions)

    session.exec(delete(UserRole).where(col(UserRole.user_id) == user.id))
    session.exec(delete(UserPermission).where(col(UserPermission.user_id) == user.id))
    for role_id in role_ids:
        session.add(UserRole(user_id=user.id, role_id=role_id))
    for permission_name in permission_names:
        session.add(UserPermission(user_id=user.id, permission_name=permission_name))
    session.commit()
    session.refresh(user)
    return _user_access(session, user)
