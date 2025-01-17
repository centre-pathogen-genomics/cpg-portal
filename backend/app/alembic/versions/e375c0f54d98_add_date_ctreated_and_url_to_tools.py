"""add date created and url to tools

Revision ID: e375c0f54d98
Revises: 0522ff140b4e
Create Date: 2025-01-17 11:26:54.806133

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e375c0f54d98'
down_revision = '0522ff140b4e'
branch_labels = None
depends_on = None


def upgrade():
    # Add 'url' column
    op.add_column('tool', sa.Column('url', sa.String(), nullable=True))
    # Add 'created_at' column with a default value for new rows
    op.add_column('tool', sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()))
    # Set the default value for existing rows
    op.execute("UPDATE tool SET created_at = now()")


def downgrade():
    # Drop 'created_at' column
    op.drop_column('tool', 'created_at')
    # Drop 'url' column
    op.drop_column('tool', 'url')
