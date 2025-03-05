"""replace files with multiple

Revision ID: 944b45f5467a
Revises: 960daeadc260
Create Date: 2025-03-05 20:49:55.122660

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '944b45f5467a'
down_revision = '960daeadc260'
branch_labels = None
depends_on = None


def upgrade():
    # Obtain the connection from Alembic's context.
    connection = op.get_bind()

    # Define a lightweight table representation for the "tool" table.
    tool_table = sa.table(
        'tool',
        sa.column('id', sa.String),
        sa.column('params', sa.JSON)
    )

    # Use positional arguments for select instead of a list.
    results = connection.execute(
        sa.select(tool_table.c.id, tool_table.c.params)
    ).fetchall()

    # Iterate through each row by unpacking tuple values.
    for tool_id, params in results:
        updated = False

        # Check if params exists and is a list.
        if params is not None and isinstance(params, list):
            for param in params:
                # If the parameter type is "files", update it.
                if param.get("param_type") == "files":
                    param["param_type"] = "file"
                    param["multiple"] = True
                    updated = True

        # If an update occurred, write the changes back to the database.
        if updated:
            stmt = sa.update(tool_table).where(
                tool_table.c.id == tool_id
            ).values(params=params)
            connection.execute(stmt)


def downgrade():
    # Obtain the connection from Alembic's context.
    connection = op.get_bind()

    # Define a lightweight table representation for the "tool" table.
    tool_table = sa.table(
        'tool',
        sa.column('id', sa.String),
        sa.column('params', sa.JSON)
    )

    # Use positional arguments for select.
    results = connection.execute(
        sa.select(tool_table.c.id, tool_table.c.params)
    ).fetchall()

    # Iterate through each row by unpacking tuple values.
    for tool_id, params in results:
        updated = False

        # Check if params exists and is a list.
        if params is not None and isinstance(params, list):
            for param in params:
                # Revert parameters updated in the upgrade.
                if param.get("param_type") == "file" and param.get("multiple") is True:
                    param["param_type"] = "files"
                    # Remove the 'multiple' key.
                    del param["multiple"]
                    updated = True

        # If an update occurred, write the reverted JSON back to the database.
        if updated:
            stmt = sa.update(tool_table).where(
                tool_table.c.id == tool_id
            ).values(params=params)
            connection.execute(stmt)
