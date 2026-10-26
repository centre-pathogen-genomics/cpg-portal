"""run record

Revision ID: b3e7c9f14a25
Revises: a6f1c2d84b07
Create Date: 2026-10-25 02:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b3e7c9f14a25"
down_revision: str | None = "a6f1c2d84b07"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # A copy of every run that finished, so the admin stats outlive the runs: a
    # user may delete their runs, and the numbers used to drop with them. There
    # is no foreign key to `run`: the row has to stay behind. The owner is kept
    # as its id alone, with no foreign key either, so the row outlives the user
    # and the stats can still label a deleted owner by that id.
    op.create_table(
        "run_record",
        sa.Column("id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("owner_id", sa.UUID(), autoincrement=False, nullable=False),
        sa.Column("tool_id", sa.UUID(), autoincrement=False, nullable=True),
        sa.Column("tool_name", sa.String(), autoincrement=False, nullable=False),
        sa.Column(
            "tool_version", sa.String(), autoincrement=False, nullable=False
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending",
                "running",
                "completed",
                "failed",
                "cancelled",
                name="runstatus",
                create_type=False,
            ),
            autoincrement=False,
            nullable=False,
        ),
        sa.Column("cpus", sa.Integer(), autoincrement=False, nullable=True),
        sa.Column("created_at", sa.DateTime(), autoincrement=False, nullable=False),
        sa.Column("started_at", sa.DateTime(), autoincrement=False, nullable=True),
        sa.Column("finished_at", sa.DateTime(), autoincrement=False, nullable=True),
        sa.Column("params", sa.JSON(), autoincrement=False, nullable=True),
        sa.ForeignKeyConstraint(
            ["tool_id"],
            ["tool.id"],
            name="run_record_tool_id_fkey",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="run_record_pkey"),
    )
    op.create_index("ix_run_record_tool_name", "run_record", ["tool_name"])
    op.create_index("ix_run_record_created_at", "run_record", ["created_at"])

    # Runs from before this table are copied too, so the stats read the same
    # numbers right after the deploy as they did right before it.
    op.execute(
        """
        INSERT INTO run_record (
            id, owner_id, tool_id, tool_name, tool_version, status, cpus,
            created_at, started_at, finished_at, params
        )
        SELECT
            run.id, run.owner_id, run.tool_id, tool.name, run.tool_version,
            run.status, run.cpus, run.created_at, run.started_at,
            run.finished_at, run.params
        FROM run
        JOIN tool ON tool.id = run.tool_id
        """
    )


def downgrade() -> None:
    op.drop_index("ix_run_record_created_at", table_name="run_record")
    op.drop_index("ix_run_record_tool_name", table_name="run_record")
    op.drop_table("run_record")
