#! /usr/bin/env bash

# Build the Apptainer image that tool commands run inside, see app/sandbox.py.
#
# Run from the backend directory, e.g. inside the worker container:
#     docker compose exec worker bash scripts/build_sandbox_image.sh
#
# Set SANDBOX_FORCE_REBUILD=true to rebuild an existing image.

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
definition="${SANDBOX_DEFINITION:-$(dirname "$script_dir")/container/runtime.def}"
image="${SANDBOX_IMAGE:-/apptainer/runtime.sif}"

if [ -f "$image" ] && [ "${SANDBOX_FORCE_REBUILD:-false}" != "true" ]; then
    # The image is built from the definition baked into the worker image, so a
    # changed definition means the image has to be rebuilt.
    if [ "$(cat "$image.sha256" 2>/dev/null)" = "$(sha256sum "$definition" | cut -d' ' -f1)" ]; then
        echo "Sandbox image $image is up to date, skipping build."
        exit 0
    fi
    echo "Sandbox definition changed, rebuilding $image."
fi

mkdir -p "$(dirname "$image")"
apptainer build --force "$image" "$definition"
sha256sum "$definition" | cut -d' ' -f1 > "$image.sha256"
echo "Sandbox image built: $image"
