"""tool timeline

Revision ID: e8f4a2c91b73
Revises: d5f6a7b8c9e0
Create Date: 2026-11-20 15:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e8f4a2c91b73"
down_revision = "d5f6a7b8c9e0"
branch_labels = None
depends_on = None


def upgrade():
    # Ordered name/pattern steps a run page matches against the run's logs.
    # Tools without a timeline simply have no rows to show.
    op.add_column("tool", sa.Column("timeline", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("tool", "timeline")
