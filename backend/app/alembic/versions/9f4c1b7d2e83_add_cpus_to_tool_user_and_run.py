"""add cpus to tool, user and run

Revision ID: 9f4c1b7d2e83
Revises: c3e7a91d5b24
Create Date: 2026-10-22 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9f4c1b7d2e83"
down_revision: str | None = "c3e7a91d5b24"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Existing tools and runs keep using a single CPU until their owners raise the
# limit, which is the conservative choice for a shared worker.
COLUMNS = (
    ("tool", "max_cpus", "1"),
    ("tool", "default_cpus", "1"),
    ("user", "max_cpus", "4"),
    ("run", "cpus", "1"),
)


def upgrade() -> None:
    for table, column, default in COLUMNS:
        op.add_column(
            table,
            sa.Column(column, sa.Integer(), nullable=False, server_default=default),
        )
        # Keep the default on the Python side only, like the other counters.
        op.alter_column(table, column, server_default=None)


def downgrade() -> None:
    for table, column, _ in reversed(COLUMNS):
        op.drop_column(table, column)
