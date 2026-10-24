"""tool versions

Revision ID: f2c9b17e5a38
Revises: e4b1c7a93d26
Create Date: 2026-10-24 11:40:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f2c9b17e5a38"
down_revision = "e4b1c7a93d26"
branch_labels = None
depends_on = None


def upgrade():
    # Versions of one tool share a name now, so the name alone cannot be unique
    # and the pair (name, version) is what has to be. An empty version is one
    # value, which keeps tools without versions working as they did.
    op.drop_index("ix_tool_name", table_name="tool")
    op.execute("UPDATE tool SET version = '' WHERE version IS NULL")
    op.alter_column("tool", "version", nullable=False, server_default="")
    op.add_column("tool", sa.Column("version_sort", sa.Integer(), nullable=True))
    op.add_column(
        "tool",
        sa.Column(
            "is_default", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    # Every tool that exists is the default of its own name for now.
    op.execute("UPDATE tool SET is_default = true")
    op.create_index("ix_tool_version", "tool", ["version"])
    op.create_unique_constraint("uq_tool_name_version", "tool", ["name", "version"])


def downgrade():
    # A name with several versions cannot go back to a unique name: that one
    # row wins and the rest of the stack has to be removed by hand.
    op.drop_constraint("uq_tool_name_version", "tool", type_="unique")
    op.drop_index("ix_tool_version", table_name="tool")
    op.execute("DELETE FROM tool WHERE id NOT IN (SELECT min(id) FROM tool GROUP BY name)")
    op.drop_column("tool", "is_default")
    op.drop_column("tool", "version_sort")
    op.alter_column("tool", "version", nullable=True, server_default=None)
    op.create_index("ix_tool_name", "tool", ["name"], unique=True)
