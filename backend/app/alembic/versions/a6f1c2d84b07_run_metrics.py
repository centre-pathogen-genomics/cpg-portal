"""run metrics

Revision ID: a6f1c2d84b07
Revises: b7d2f0a1c4e9
Create Date: 2026-10-25 02:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a6f1c2d84b07"
down_revision = "b7d2f0a1c4e9"
branch_labels = None
depends_on = None


def upgrade():
    # Profiler readings the worker takes while a run works, one JSON object per
    # sample. Runs that finished before this column simply have none.
    op.add_column("run", sa.Column("metrics", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("run", "metrics")
