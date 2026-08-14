"""add app settings llm model

Revision ID: 3f4c8d92b6a1
Revises: 77b307d7c9a0
Create Date: 2026-08-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


# revision identifiers, used by Alembic.
revision = "3f4c8d92b6a1"
down_revision = "77b307d7c9a0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "appsetting",
        sa.Column("llm_model", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        "INSERT INTO appsetting (id, llm_model) VALUES (1, 'gemini-2.5-flash')"
    )


def downgrade():
    op.drop_table("appsetting")
