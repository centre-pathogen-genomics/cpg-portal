"""add updated at to file

Revision ID: c7f2a91d4e35
Revises: b3e7d15c9a42
Create Date: 2026-10-23 11:05:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c7f2a91d4e35"
down_revision = "b3e7d15c9a42"
branch_labels = None
depends_on = None


def upgrade():
    # Added nullable so the existing rows can be filled from their creation
    # time before the column is made required.
    op.add_column("file", sa.Column("updated_at", sa.DateTime(), nullable=True))
    op.execute("UPDATE file SET updated_at = created_at WHERE updated_at IS NULL")
    op.alter_column("file", "updated_at", nullable=False)


def downgrade():
    op.drop_column("file", "updated_at")
