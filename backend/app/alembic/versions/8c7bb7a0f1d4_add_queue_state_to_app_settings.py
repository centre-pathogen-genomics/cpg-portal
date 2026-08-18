"""add queue state to app settings

Revision ID: 8c7bb7a0f1d4
Revises: 3f4c8d92b6a1
Create Date: 2026-08-17 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8c7bb7a0f1d4"
down_revision: str | None = "3f4c8d92b6a1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "appsetting",
        sa.Column("queue_paused", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("appsetting", sa.Column("queue_paused_at", sa.DateTime(), nullable=True))
    op.add_column("appsetting", sa.Column("queue_pause_reason", sa.String(length=500), nullable=True))
    op.alter_column("appsetting", "queue_paused", server_default=None)


def downgrade() -> None:
    op.drop_column("appsetting", "queue_pause_reason")
    op.drop_column("appsetting", "queue_paused_at")
    op.drop_column("appsetting", "queue_paused")
