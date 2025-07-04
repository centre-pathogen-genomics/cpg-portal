"""add conda env pinned to run

Revision ID: 4cb61e2ffee2
Revises: 65229c70a98c
Create Date: 2025-02-06 14:57:35.855199

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '4cb61e2ffee2'
down_revision = '65229c70a98c'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('run', sa.Column('conda_env_pinned', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('run', 'conda_env_pinned')
    # ### end Alembic commands ###
