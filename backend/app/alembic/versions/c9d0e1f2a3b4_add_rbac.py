"""rbac

Revision ID: c9d0e1f2a3b4
Revises: b3e7c9f14a25
Create Date: 2026-11-02 12:00:00.000000

"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op
from sqlmodel.sql.sqltypes import AutoString

# revision identifiers, used by Alembic.
revision: str = "c9d0e1f2a3b4"
down_revision: str | None = "b3e7c9f14a25"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Roles, the permission catalog (owned by the code and synced on startup)
    # and the two link levels: role -> permission and user -> role/permission.
    op.create_table(
        "rbac_role",
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("name", AutoString(length=100), autoincrement=False, nullable=False),
        sa.Column(
            "description", AutoString(length=255), autoincrement=False, nullable=True
        ),
        sa.Column(
            "is_default",
            sa.Boolean(),
            server_default=sa.false(),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), autoincrement=False, nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_rbac_role_name"), "rbac_role", ["name"], unique=True)

    op.create_table(
        "rbac_permission",
        sa.Column("name", AutoString(length=100), autoincrement=False, nullable=False),
        sa.Column(
            "description", AutoString(length=255), autoincrement=False, nullable=False
        ),
        sa.PrimaryKeyConstraint("name"),
    )

    op.create_table(
        "rbac_user_role",
        sa.Column("user_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("role_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["rbac_role.id"],
            name="rbac_user_role_role_id_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
            name="rbac_user_role_user_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "role_id"),
    )
    op.create_index(
        op.f("ix_rbac_user_role_user_id"), "rbac_user_role", ["user_id"]
    )
    op.create_index(
        op.f("ix_rbac_user_role_role_id"), "rbac_user_role", ["role_id"]
    )

    op.create_table(
        "rbac_role_permission",
        sa.Column("role_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "permission_name", AutoString(length=100), autoincrement=False, nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["permission_name"],
            ["rbac_permission.name"],
            name="rbac_role_permission_permission_name_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["rbac_role.id"],
            name="rbac_role_permission_role_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("role_id", "permission_name"),
    )
    op.create_index(
        op.f("ix_rbac_role_permission_role_id"),
        "rbac_role_permission",
        ["role_id"],
    )
    op.create_index(
        op.f("ix_rbac_role_permission_permission_name"),
        "rbac_role_permission",
        ["permission_name"],
    )

    op.create_table(
        "rbac_user_permission",
        sa.Column("user_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column(
            "permission_name", AutoString(length=100), autoincrement=False, nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["permission_name"],
            ["rbac_permission.name"],
            name="rbac_user_permission_permission_name_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
            name="rbac_user_permission_user_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id", "permission_name"),
    )
    op.create_index(
        op.f("ix_rbac_user_permission_user_id"),
        "rbac_user_permission",
        ["user_id"],
    )
    op.create_index(
        op.f("ix_rbac_user_permission_permission_name"),
        "rbac_user_permission",
        ["permission_name"],
    )

    # The default role exists from the first start, and every account that was
    # created before RBAC gets it. Its permissions are inserted by the startup
    # sync, which owns the catalog; only the role and the assignments belong to
    # this migration.
    default_role_id = uuid.uuid4()
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "INSERT INTO rbac_role (id, name, description, is_default, created_at) "
            "VALUES (:id, :name, :description, true, :created_at)"
        ),
        {
            "id": default_role_id,
            "name": "researcher",
            "description": "Default role for all users",
            "created_at": datetime.now(UTC).replace(tzinfo=None),
        },
    )
    bind.execute(
        sa.text(
            'INSERT INTO rbac_user_role (user_id, role_id) '
            'SELECT id, :role_id FROM "user"'
        ),
        {"role_id": default_role_id},
    )

    # At most one default role, enforced by the database.
    op.create_index(
        "uq_rbac_role_default",
        "rbac_role",
        ["is_default"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )


def downgrade() -> None:
    op.drop_index("uq_rbac_role_default", table_name="rbac_role")
    op.drop_table("rbac_user_permission")
    op.drop_table("rbac_role_permission")
    op.drop_table("rbac_user_role")
    op.drop_table("rbac_permission")
    op.drop_table("rbac_role")
