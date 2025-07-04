"""remove stderr

Revision ID: 1e03e902ec34
Revises: 196541e6f1ff
Create Date: 2025-02-11 15:52:21.695577

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = '1e03e902ec34'
down_revision = '196541e6f1ff'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('run', 'stderr')
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('run', sa.Column('stderr', sa.VARCHAR(), autoincrement=False, nullable=True))
    # ### end Alembic commands ###
