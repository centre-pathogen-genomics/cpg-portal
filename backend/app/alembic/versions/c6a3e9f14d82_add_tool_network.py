"""add tool network

Revision ID: c6a3e9f14d82
Revises: e8f4a2c91b73
Create Date: 2026-11-22 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c6a3e9f14d82"
down_revision: str | None = "e8f4a2c91b73"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Every existing tool starts offline: internet access is granted per tool.
    op.add_column(
        "tool",
        sa.Column(
            "network", sa.String(length=32), nullable=False, server_default="none"
        ),
    )
    # Keep the default on the Python side only, like the other tool columns.
    op.alter_column("tool", "network", server_default=None)


def downgrade() -> None:
    op.drop_column("tool", "network")
