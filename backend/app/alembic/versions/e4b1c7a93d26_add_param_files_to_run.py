"""add param files to run

Revision ID: e4b1c7a93d26
Revises: c7f2a91d4e35
Create Date: 2026-10-24 09:30:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "e4b1c7a93d26"
down_revision = "c7f2a91d4e35"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "run",
        sa.Column(
            "param_files",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("run", "param_files")
