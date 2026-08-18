"""add created at to users

Revision ID: a2d4f6c8e9b1
Revises: 8c7bb7a0f1d4
Create Date: 2026-08-17 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a2d4f6c8e9b1"
down_revision: str | None = "8c7bb7a0f1d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.alter_column("user", "created_at", server_default=None)


def downgrade() -> None:
    op.drop_column("user", "created_at")
