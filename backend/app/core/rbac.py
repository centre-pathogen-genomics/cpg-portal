"""Role-based access control: permission catalog and effective permissions.

A permission is named ``<resource>:<action>``. The API routers register theirs
when they are imported (a few have no HTTP route and are registered
statically), and ``sync_rbac`` makes the database catalog match the code on
every startup.

A permission usually covers several routes, so its description accumulates one
``function_name: docstring summary`` entry per enforcing endpoint. That text is
what the access-control UI shows next to a permission.
"""

import inspect
from collections.abc import Callable
from typing import Any

from sqlalchemy import delete, text
from sqlmodel import Session, col, select

from app.models import (
    Permission,
    Role,
    RolePermission,
    User,
    UserPermission,
    UserRole,
)

# Matches ``Permission.description`` and the migration that sizes the column.
MAX_PERMISSION_DESCRIPTION = 1000

# Permissions that are not derived from an HTTP route.
STATIC_PERMISSIONS: dict[str, str] = {
    "trakka:send": "Send Newick trees to Trakka",
}


def describe_endpoint(endpoint: Callable[..., Any] | None) -> str:
    """Return ``function_name: docstring summary`` for a route handler."""
    if endpoint is None:
        return ""
    name = getattr(endpoint, "__name__", "endpoint")
    docstring = inspect.getdoc(endpoint)
    paragraph = docstring.split("\n\n", 1)[0] if docstring else ""
    summary = " ".join(paragraph.split())
    return f"{name}: {summary}" if summary else name


class PermissionRegistry:
    """Permissions enforced by the code, with their descriptions."""

    def __init__(self) -> None:
        self._descriptions: dict[str, list[str]] = {
            name: [description] for name, description in STATIC_PERMISSIONS.items()
        }

    def register(self, name: str, description: str) -> None:
        """Register a permission that has no HTTP route."""
        existing = self._descriptions.get(name)
        if existing is None:
            self._descriptions[name] = [description]
            return
        if description not in existing:
            raise ValueError(
                f"Permission {name} already registered with a different description"
            )

    def register_route(self, name: str, endpoint: Callable[..., Any] | None) -> None:
        """Record an endpoint that enforces ``name``."""
        descriptions = self._descriptions.setdefault(name, [])
        detail = describe_endpoint(endpoint) or name
        if detail not in descriptions:
            descriptions.append(detail)

    def names(self) -> set[str]:
        return set(self._descriptions)

    def items(self) -> list[tuple[str, str]]:
        items: list[tuple[str, str]] = []
        for name, descriptions in self._descriptions.items():
            description = " · ".join(descriptions)
            if len(description) > MAX_PERMISSION_DESCRIPTION:
                description = description[: MAX_PERMISSION_DESCRIPTION - 1] + "…"
            items.append((name, description))
        return sorted(items)


permission_registry = PermissionRegistry()

DEFAULT_ROLE_NAME = "researcher"
DEFAULT_ROLE_DESCRIPTION = "Default role for all users"

# What an ordinary account can do without an explicit grant. This set replaces
# the role's rows on every startup, so it may only name registered
# permissions.
DEFAULT_ROLE_PERMISSIONS: frozenset[str] = frozenset(
    {
        "users:update_self",
        "users:delete_self",
        "users:read",
        "files:read",
        "files:create",
        "files:update",
        "files:delete",
        "runs:read",
        "runs:create",
        "runs:update",
        "runs:delete",
        "runs:cancel",
        "runs:share",
        "tools:favourite",
        "settings:read_queue",
        "llm:summarize",
    }
)

# Any signed 64-bit key works; this one only has to be unique in the database.
_ADVISORY_LOCK_KEY = 0x52424143


def effective_permission_names(session: Session, user: User) -> set[str]:
    """Every permission the user holds, directly or through a role.

    Superusers bypass the checks entirely and hold the whole catalog.
    """
    if user.is_superuser:
        return permission_registry.names()

    role_permissions = session.exec(
        select(RolePermission.permission_name)
        .join(UserRole, col(UserRole.role_id) == col(RolePermission.role_id))
        .where(col(UserRole.user_id) == user.id)
    ).all()
    direct_permissions = session.exec(
        select(UserPermission.permission_name).where(
            col(UserPermission.user_id) == user.id
        )
    ).all()
    return set(role_permissions) | set(direct_permissions)


def has_permission(session: Session, user: User, permission: str) -> bool:
    return user.is_superuser or permission in effective_permission_names(session, user)


def sync_rbac(session: Session) -> None:
    """Align the permission catalog and the default role with the code.

    Runs under a transaction-scoped advisory lock so two starting processes do
    not race each other. Missing tables (or a default permission that no route
    registered) abort startup instead of leaving the portal half-authorised.
    """
    connection = session.connection()
    connection.execute(
        text("SELECT pg_advisory_xact_lock(:key)"), {"key": _ADVISORY_LOCK_KEY}
    )

    for name, description in permission_registry.items():
        connection.execute(
            text(
                "INSERT INTO rbac_permission (name, description) "
                "VALUES (:name, :description) "
                "ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description"
            ),
            {"name": name, "description": description},
        )

    # A permission no route enforces is inert; drop it, which cascades to the
    # role and user assignments that still name it.
    session.exec(
        delete(Permission).where(
            col(Permission.name).notin_(sorted(permission_registry.names()))
        )
    )

    default_role = session.exec(
        select(Role).where(col(Role.is_default).is_(True))
    ).first()
    if default_role is None:
        default_role = Role(
            name=DEFAULT_ROLE_NAME,
            description=DEFAULT_ROLE_DESCRIPTION,
            is_default=True,
        )
        session.add(default_role)
        session.flush()

    missing = DEFAULT_ROLE_PERMISSIONS - permission_registry.names()
    if missing:
        raise RuntimeError(
            f"Default role permissions are not registered: {sorted(missing)}"
        )

    session.exec(
        delete(RolePermission).where(col(RolePermission.role_id) == default_role.id)
    )
    for name in sorted(DEFAULT_ROLE_PERMISSIONS):
        session.add(RolePermission(role_id=default_role.id, permission_name=name))

    session.commit()
