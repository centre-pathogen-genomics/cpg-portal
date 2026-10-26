"""add update queued tool status

Revision ID: b3e7d15c9a42
Revises: d4b8f1c25a90
Create Date: 2026-10-23 10:20:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b3e7d15c9a42"
down_revision = "d4b8f1c25a90"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE toolstatus ADD VALUE IF NOT EXISTS 'update_queued'")


def downgrade():
    op.execute("UPDATE tool SET status = 'installed' WHERE status = 'update_queued'")
    op.execute("ALTER TABLE tool ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TYPE toolstatus RENAME TO toolstatus_old")
    op.execute(
        "CREATE TYPE toolstatus AS ENUM "
        "('uninstalled', 'uninstalling', 'installed', 'install_queued', "
        "'installing', 'updating', 'failed')"
    )
    op.execute(
        "ALTER TABLE tool ALTER COLUMN status TYPE toolstatus "
        "USING status::text::toolstatus"
    )
    op.execute("ALTER TABLE tool ALTER COLUMN status SET DEFAULT 'uninstalled'")
    op.execute("DROP TYPE toolstatus_old")
