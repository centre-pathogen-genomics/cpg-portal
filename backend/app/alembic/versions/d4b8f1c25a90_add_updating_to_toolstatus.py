"""add updating to toolstatus

Revision ID: d4b8f1c25a90
Revises: c2a5e91f7b38
Create Date: 2026-10-23 00:00:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4b8f1c25a90"
down_revision: str | None = "c2a5e91f7b38"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # A tool that re-runs its post-install command keeps its environment, so it
    # needs a status of its own.
    op.execute("ALTER TYPE toolstatus ADD VALUE IF NOT EXISTS 'updating'")


def downgrade() -> None:
    # Postgres cannot drop a value from an enum; tools left in this state go
    # back to installed.
    op.execute("UPDATE tool SET status = 'installed' WHERE status = 'updating'")
