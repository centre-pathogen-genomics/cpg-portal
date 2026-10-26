"""make tool max_cpus and default_cpus nullable

Revision ID: c2a5e91f7b38
Revises: b7d2f4c8a1e6
Create Date: 2026-10-23 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c2a5e91f7b38"
down_revision: str | None = "b7d2f4c8a1e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # A tool without a maximum lets a run reserve whatever the user's own limit
    # allows, and a tool without a default starts at its minimum. Tools that
    # named a value keep it.
    op.alter_column("tool", "max_cpus", existing_type=sa.Integer(), nullable=True)
    op.alter_column("tool", "default_cpus", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.execute("UPDATE tool SET max_cpus = 1 WHERE max_cpus IS NULL")
    op.execute("UPDATE tool SET default_cpus = 1 WHERE default_cpus IS NULL")
    op.alter_column("tool", "max_cpus", existing_type=sa.Integer(), nullable=False)
    op.alter_column(
        "tool", "default_cpus", existing_type=sa.Integer(), nullable=False
    )
