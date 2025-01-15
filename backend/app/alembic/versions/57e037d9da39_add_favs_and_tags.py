"""add favs and tags

Revision ID: 57e037d9da39
Revises: 003976545fbe
Create Date: 2025-01-15 21:02:44.669803

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '57e037d9da39'
down_revision = '003976545fbe'
branch_labels = None
depends_on = None


def upgrade():
    # Create the 'runstatus' enum type
    op.execute("CREATE TYPE runstatus AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled')")

    # Alter the 'status' column with explicit casting using the 'USING' clause
    op.execute("""
        ALTER TABLE run
        ALTER COLUMN status TYPE runstatus
        USING status::text::runstatus
    """)

    # Create the 'userfavouritetoolslink' table
    op.create_table('userfavouritetoolslink',
                    sa.Column('user_id', sa.Uuid(), nullable=False),
                    sa.Column('tool_id', sa.Uuid(), nullable=False),
                    sa.ForeignKeyConstraint(['tool_id'], ['tool.id']),
                    sa.ForeignKeyConstraint(['user_id'], ['user.id']),
                    sa.PrimaryKeyConstraint('user_id', 'tool_id'))

    # Add new columns to 'tool' table with default values
    op.add_column('tool', sa.Column('favourited_count', sa.Integer(), nullable=False, server_default="0"))
    op.add_column('tool', sa.Column('run_count', sa.Integer(), nullable=False, server_default="0"))
    op.add_column('tool', sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # Remove the server default after setting initial values (optional)
    op.alter_column('tool', 'favourited_count', server_default=None)
    op.alter_column('tool', 'run_count', server_default=None)





def downgrade():
    # Drop new columns from the 'tool' table
    op.drop_column('tool', 'tags')
    op.drop_column('tool', 'run_count')
    op.drop_column('tool', 'favourited_count')

    # Change 'status' column back to the old enum type using explicit casting
    op.execute("""
        ALTER TABLE run
        ALTER COLUMN status TYPE taskstatus
        USING status::text::taskstatus
    """)

    # Drop the 'userfavouritetoolslink' table
    op.drop_table('userfavouritetoolslink')

    # Drop the 'runstatus' enum type
    op.execute("DROP TYPE runstatus")


