"""enforce a single superuser row

The API no longer carries `is_superuser` on its create/update schemas, and the
routes refuse to touch the superuser row, so superuser status can only be
granted by the environment bootstrap (app/core/db.py). This migration makes
"at most one superuser" a database invariant as well: the partial unique index
allows at most one row with is_superuser = true.

Revision ID: 5a1b2c3d4e5f
Revises: c6a3e9f14d82
Create Date: 2026-11-24 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.config import settings

# revision identifiers, used by Alembic.
revision: str = "5a1b2c3d4e5f"
down_revision: str | None = "c6a3e9f14d82"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # A pre-lockdown database can legitimately hold several superusers (the
    # API used to allow granting it). Consolidate to a single one - the
    # bootstrap FIRST_SUPERUSER when present, otherwise the oldest - before
    # locking the invariant down, so an existing deployment upgrades rather
    # than being refused.
    connection = op.get_bind()
    superusers = connection.execute(
        sa.text(
            'SELECT email FROM "user" WHERE is_superuser '
            "ORDER BY created_at"
        )
    ).all()
    if len(superusers) > 1:
        emails = {row.email for row in superusers}
        keeper = settings.FIRST_SUPERUSER
        if keeper not in emails:
            # Oldest row first, so the original account is the keeper.
            keeper = superusers[0].email
        connection.execute(
            sa.text(
                'UPDATE "user" SET is_superuser = false '
                "WHERE is_superuser AND email <> :keeper"
            ),
            {"keeper": keeper},
        )
    op.execute(
        'CREATE UNIQUE INDEX uq_user_single_superuser ON "user" ((true)) '
        "WHERE is_superuser"
    )


def downgrade() -> None:
    op.drop_index("uq_user_single_superuser", table_name="user")
