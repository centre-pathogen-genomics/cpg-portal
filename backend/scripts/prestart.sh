#! /usr/bin/env bash

set -e
set -x

# Let the DB start
python app/backend_pre_start.py

# Run migrations
alembic upgrade head

# Create initial data in DB
python app/initial_data.py

# Build the image tool commands run inside, if it is missing
if [ "${SANDBOX_ENABLED:-true}" = "true" ]; then
    bash scripts/build_sandbox_image.sh
fi
