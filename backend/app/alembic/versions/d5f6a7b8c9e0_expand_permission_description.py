"""expand permission description

Revision ID: d5f6a7b8c9e0
Revises: c9d0e1f2a3b4
Create Date: 2026-11-10 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op
from sqlmodel.sql.sqltypes import AutoString

# revision identifiers, used by Alembic.
revision: str = "d5f6a7b8c9e0"
down_revision: str | None = "c9d0e1f2a3b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The description now names every endpoint that enforces the permission,
    # e.g. "read_files: Retrieve files. · read_file: ...".
    op.alter_column(
        "rbac_permission",
        "description",
        existing_type=AutoString(length=255),
        type_=AutoString(length=1000),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "rbac_permission",
        "description",
        existing_type=AutoString(length=1000),
        type_=AutoString(length=255),
        existing_nullable=False,
    )
