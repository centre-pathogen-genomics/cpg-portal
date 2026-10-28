#! /usr/bin/env bash

# Build the Apptainer image that tool commands run inside, see app/sandbox.py.
#
# The `sandbox-image` service runs this on every deployment: it is privileged for
# the build, hands the image over in the app-sandbox-data volume and exits, and
# the worker waits for it. Building needs SYS_ADMIN and the host's loop devices,
# so the same script is what you run on a machine that may build. It skips the
# build as soon as the image in the volume matches the definition, and refuses to
# build in place unless SANDBOX_BUILD_IN_PLACE=true is set, so an unprivileged
# container says so instead of failing halfway through a mount.
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

if [ "${SANDBOX_BUILD_IN_PLACE:-false}" != "true" ]; then
    cat >&2 <<MESSAGE
The sandbox image $image is missing or out of date, and this script only builds
it in place when SANDBOX_BUILD_IN_PLACE=true: apptainer build needs SYS_ADMIN and
the host's loop devices.

Build it where they are available - a development machine, a CI runner, or the
`sandbox-image` service, which is privileged for exactly this and runs this same
script. To build it here anyway, give the container SYS_ADMIN and the loop
devices (what the service has) and set SANDBOX_BUILD_IN_PLACE=true.
MESSAGE
    exit 1
fi

mkdir -p "$(dirname "$image")"
apptainer build --force "$image" "$definition"
sha256sum "$definition" | cut -d' ' -f1 > "$image.sha256"
echo "Sandbox image built: $image"
