"""add install queued tool status

Revision ID: 77b307d7c9a0
Revises: df2765efb999
Create Date: 2026-08-12 13:55:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "77b307d7c9a0"
down_revision = "df2765efb999"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE toolstatus ADD VALUE IF NOT EXISTS 'install_queued'")


def downgrade():
    op.execute("UPDATE tool SET status = 'uninstalled' WHERE status = 'install_queued'")
    op.execute("ALTER TABLE tool ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TYPE toolstatus RENAME TO toolstatus_old")
    op.execute(
        "CREATE TYPE toolstatus AS ENUM "
        "('uninstalled', 'uninstalling', 'installed', 'installing', 'failed')"
    )
    op.execute(
        "ALTER TABLE tool ALTER COLUMN status TYPE toolstatus "
        "USING status::text::toolstatus"
    )
    op.execute("ALTER TABLE tool ALTER COLUMN status SET DEFAULT 'uninstalled'")
    op.execute("DROP TYPE toolstatus_old")
