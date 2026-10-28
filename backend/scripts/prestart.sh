#! /usr/bin/env bash

set -e
set -x

# Let the DB start
python app/backend_pre_start.py

# Run migrations
alembic upgrade head

# Create initial data in DB
python app/initial_data.py

# The sandbox image tool commands run inside is not built here: the sandbox-image
# service builds it into the app-sandbox-data volume, and the worker waits for
# that, see compose.yml and deployment.md.
