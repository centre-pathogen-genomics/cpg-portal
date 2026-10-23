"""add min_cpus to tool

Revision ID: b7d2f4c8a1e6
Revises: 9f4c1b7d2e83
Create Date: 2026-10-23 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7d2f4c8a1e6"
down_revision: str | None = "9f4c1b7d2e83"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Tools that were not given a range keep offering every thread count up to
    # their maximum.
    op.add_column(
        "tool",
        sa.Column("min_cpus", sa.Integer(), nullable=False, server_default="1"),
    )
    # Keep the default on the Python side only, like the other counters.
    op.alter_column("tool", "min_cpus", server_default=None)


def downgrade() -> None:
    op.drop_column("tool", "min_cpus")
