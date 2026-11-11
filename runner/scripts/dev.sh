#!/usr/bin/env bash
#
# Run the desktop app from its sources.
#
#   bash runner/scripts/dev.sh [electron args...]
#
# Vite serves the renderer on one port with hot reload, the sidecar serves the
# API, and Electron shows the window. A dev session keeps its state in
# runner/.dev/ and never touches the tools installed in the real app.
#
# Override with:
#   CPG_RUNNER_DEV_UI_PORT   port for vite (default 5174)
#   CPG_RUNNER_DEV_PACK      open this .cpgpack at startup instead of the
#                            first-run screen
#   CPG_RUNNER_PORTAL_URL    portal origin for the runtime image (default
#                            http://127.0.0.1:8000)
set -euo pipefail

RUNNER_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd -- "${RUNNER_DIR}/.." && pwd)"
DEV_DIR="${RUNNER_DIR}/.dev"
UI_PORT="${CPG_RUNNER_DEV_UI_PORT:-5174}"
UI_URL="http://127.0.0.1:${UI_PORT}"
PACK="${CPG_RUNNER_DEV_PACK:-}"
PORTAL_URL="${CPG_RUNNER_PORTAL_URL:-http://127.0.0.1:8000}"

log() { printf '\n==> %s\n' "$*"; }
die() {
  printf '%s\n' "$*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required for development"
}

need bun
need python3
command -v docker >/dev/null 2>&1 ||
  printf 'warning: docker is not on PATH; the app will show its setup screen\n' >&2

mkdir -p "${DEV_DIR}/userdata"

# Electron downloads its platform binary the first time it runs.
if [ ! -d "${REPO_DIR}/node_modules/electron/dist" ]; then
  log "Downloading Electron"
  (cd "${REPO_DIR}" && bunx electron --version >/dev/null)
fi

SIDECAR_BIN="${RUNNER_DIR}/sidecar/dist/cpg-runner/cpg-runner"
stale=""
if [ -x "${SIDECAR_BIN}" ]; then
  stale="$(find "${RUNNER_DIR}/sidecar/cpg_runner" "${RUNNER_DIR}/sidecar"/*.spec \
    -newer "${SIDECAR_BIN}" -print -quit 2>/dev/null)"
fi
if [ ! -x "${SIDECAR_BIN}" ] || [ -n "${stale}" ]; then
  log "Building the sidecar"
  (cd "${RUNNER_DIR}/sidecar" && uv run pyinstaller cpg-runner.spec --noconfirm)
fi

log "Building the main process"
(cd "${RUNNER_DIR}" && bun run build:main)

cleanup() {
  if [ -n "${vite_pid:-}" ]; then
    kill "${vite_pid}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

log "Starting vite on ${UI_URL}"
(cd "${RUNNER_DIR}" &&
  bunx vite --config renderer/vite.config.ts --host 127.0.0.1 \
    --port "${UI_PORT}" --strictPort \
    >"${DEV_DIR}/vite.log" 2>&1) &
vite_pid=$!

for _ in $(seq 1 60); do
  if curl -s -o /dev/null "${UI_URL}/"; then break; fi
  sleep 0.5
done
curl -s -o /dev/null "${UI_URL}/" ||
  die "vite did not start; see ${DEV_DIR}/vite.log"

log "Starting Electron (data in ${DEV_DIR}/userdata)"
CPG_RUNNER_UI_URL="${UI_URL}" \
  CPG_RUNNER_DATA_DIR="${DEV_DIR}/userdata" \
  CPG_RUNNER_SIDECAR="${SIDECAR_BIN}" \
  CPG_RUNNER_UI_DIR="${RUNNER_DIR}/renderer/dist" \
  CPG_RUNNER_LOGO="${REPO_DIR}/frontend/public/assets/images/cpg-logo.png" \
  CPG_RUNNER_PORTAL_URL="${PORTAL_URL}" \
  bunx electron "${RUNNER_DIR}/dist/electron/main.js" ${PACK:+"${PACK}"} "$@"
