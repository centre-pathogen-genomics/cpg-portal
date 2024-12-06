"""rename tasks to runs

Revision ID: 003976545fbe
Revises: 5712bb6ca808
Create Date: 2024-12-06 20:18:25.734036

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003976545fbe'
down_revision = '5712bb6ca808'
branch_labels = None
depends_on = None


def upgrade():
    # Rename table from 'task' to 'run'
    op.rename_table('task', 'run')

    # Rename primary key index
    op.execute('ALTER INDEX task_pkey RENAME TO run_pkey')

    # Rename columns in related tables
    op.alter_column('result', 'task_id', new_column_name='run_id', existing_type=sa.Uuid())

    # Update foreign key constraints to reference the renamed table
    op.drop_constraint('result_task_id_fkey', 'result', type_='foreignkey')
    op.create_foreign_key('result_run_id_fkey', 'result', 'run', ['run_id'], ['id'])


def downgrade():
    # Rename table back from 'run' to 'task'
    op.rename_table('run', 'task')

    # Rename primary key index back
    op.execute('ALTER INDEX run_pkey RENAME TO task_pkey')

    # Rename columns in related tables back to 'task_id'
    op.alter_column('result', 'run_id', new_column_name='task_id', existing_type=sa.Uuid())

    # Update foreign key constraints to reference the original table
    op.drop_constraint('result_run_id_fkey', 'result', type_='foreignkey')
    op.create_foreign_key('result_task_id_fkey', 'result', 'task', ['task_id'], ['id'])
