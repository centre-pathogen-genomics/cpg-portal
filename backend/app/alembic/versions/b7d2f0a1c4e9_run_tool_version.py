"""run records the tool version it ran

Revision ID: b7d2f0a1c4e9
Revises: f2c9b17e5a38
Create Date: 2026-10-24 13:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b7d2f0a1c4e9"
down_revision = "f2c9b17e5a38"
branch_labels = None
depends_on = None


def upgrade():
    # A run records the version it ran, like it already records the command and
    # the pinned environment. Editing the tool row afterwards must not rewrite
    # what ran.
    op.add_column(
        "run",
        sa.Column("tool_version", sa.String(), nullable=False, server_default=""),
    )
    # Runs from before this column ran whatever version their tool row holds,
    # which is the best guess there is.
    op.execute(
        """
        UPDATE run
        SET tool_version = tool.version
        FROM tool
        WHERE tool.id = run.tool_id
        """
    )
    # Keep the default on the Python side only, like the other snapshots.
    op.alter_column("run", "tool_version", server_default=None)


def downgrade():
    op.drop_column("run", "tool_version")
