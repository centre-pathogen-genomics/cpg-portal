"""rename workflows to tools

Revision ID: 5712bb6ca808
Revises: b21c9f62a313
Create Date: 2024-12-06 19:22:11.061659

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '5712bb6ca808'
down_revision = 'b21c9f62a313'
branch_labels = None
depends_on = None


def upgrade():
    # Rename table from 'workflow' to 'tool'
    op.rename_table('workflow', 'tool')

    # Rename index on 'name' column
    op.execute('ALTER INDEX ix_workflow_name RENAME TO ix_tool_name')

    # Rename columns in related tables
    op.alter_column('param', 'workflow_id', new_column_name='tool_id', existing_type=sa.Uuid())
    op.alter_column('target', 'workflow_id', new_column_name='tool_id', existing_type=sa.Uuid())
    op.alter_column('task', 'workflow_id', new_column_name='tool_id', existing_type=sa.Uuid())

    # Update foreign key constraints to point to the renamed table
    op.drop_constraint('param_workflow_id_fkey', 'param', type_='foreignkey')
    op.create_foreign_key('param_tool_id_fkey', 'param', 'tool', ['tool_id'], ['id'])

    op.drop_constraint('target_workflow_id_fkey', 'target', type_='foreignkey')
    op.create_foreign_key('target_tool_id_fkey', 'target', 'tool', ['tool_id'], ['id'])

    op.drop_constraint('task_workflow_id_fkey', 'task', type_='foreignkey')
    op.create_foreign_key('task_tool_id_fkey', 'task', 'tool', ['tool_id'], ['id'])


def downgrade():
    # Rename table back from 'tool' to 'workflow'
    op.rename_table('tool', 'workflow')

    # Rename index on 'name' column back
    op.execute('ALTER INDEX ix_tool_name RENAME TO ix_workflow_name')

    # Rename columns in related tables back to 'workflow_id'
    op.alter_column('param', 'tool_id', new_column_name='workflow_id', existing_type=sa.Uuid())
    op.alter_column('target', 'tool_id', new_column_name='workflow_id', existing_type=sa.Uuid())
    op.alter_column('task', 'tool_id', new_column_name='workflow_id', existing_type=sa.Uuid())

    # Update foreign key constraints to point back to the original table
    op.drop_constraint('param_tool_id_fkey', 'param', type_='foreignkey')
    op.create_foreign_key('param_workflow_id_fkey', 'param', 'workflow', ['workflow_id'], ['id'])

    op.drop_constraint('target_tool_id_fkey', 'target', type_='foreignkey')
    op.create_foreign_key('target_workflow_id_fkey', 'target', 'workflow', ['workflow_id'], ['id'])

    op.drop_constraint('task_tool_id_fkey', 'task', type_='foreignkey')
    op.create_foreign_key('task_workflow_id_fkey', 'task', 'workflow', ['workflow_id'], ['id'])
