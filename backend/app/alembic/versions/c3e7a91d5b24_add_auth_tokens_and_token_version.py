"""add auth_token table and user.token_version

Revision ID: c3e7a91d5b24
Revises: a2d4f6c8e9b1
Create Date: 2026-10-20 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3e7a91d5b24"
down_revision: str | None = "a2d4f6c8e9b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Per-user session version, embedded in access tokens. Backfill with random
    # values (not 0) so a forged access token cannot guess it. Existing access
    # tokens carry no version and stop working: everyone logs in again.
    op.add_column(
        "user",
        sa.Column(
            "token_version", sa.Integer(), nullable=False, server_default="0"
        ),
    )
    op.execute(
        'UPDATE "user" SET token_version = floor(random() * 2147483647)::int'
    )
    op.alter_column("user", "token_version", server_default=None)

    op.create_table(
        "auth_token",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("purpose", sqlmodel.sql.sqltypes.AutoString(length=32), nullable=False),
        sa.Column(
            "token_hash", sqlmodel.sql.sqltypes.AutoString(length=64), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_auth_token_token_hash"), "auth_token", ["token_hash"], unique=True
    )
    op.create_index(op.f("ix_auth_token_user_id"), "auth_token", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_auth_token_user_id"), table_name="auth_token")
    op.drop_index(op.f("ix_auth_token_token_hash"), table_name="auth_token")
    op.drop_table("auth_token")
    op.drop_column("user", "token_version")
