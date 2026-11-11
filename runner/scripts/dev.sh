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
#   CPG_RUNNER_DEV_PACK      use an existing .cpgpack instead of the dev tool
#   CPG_RUNNER_PORTAL_URL    portal origin for the runtime image (default
#                            http://127.0.0.1:8000)
set -euo pipefail

RUNNER_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd -- "${RUNNER_DIR}/.." && pwd)"
DEV_DIR="${RUNNER_DIR}/.dev"
UI_PORT="${CPG_RUNNER_DEV_UI_PORT:-5174}"
UI_URL="http://127.0.0.1:${UI_PORT}"
PACK="${CPG_RUNNER_DEV_PACK:-${DEV_DIR}/dev.cpgpack}"
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

SIDECAR_BIN="${RUNNER_DIR}/sidecar/dist/cpg-runner"
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

if [ ! -f "${PACK}" ]; then
  log "Writing a dev tool pack to ${PACK}"
  python3 - "${PACK}" "${PORTAL_URL}" <<'PY'
import json
import platform
import sys

path, portal = sys.argv[1], sys.argv[2].rstrip("/")
machine = platform.machine().lower()
arch = "linux-arm64" if machine in ("arm64", "aarch64") else "linux-amd64"
tool = {
    "id": "dev-tool",
    "name": "dev_echo",
    "version": "0.1",
    "description": "The tool the dev runner starts with. Replace it by importing a real pack.",
    "explanation_of_results_markdown": None,
    "command": "printf 'dev ok\\n' > out.txt",
    "params": [
        {"name": "message", "param_type": "str", "default": "hello"},
        {"name": "input", "param_type": "file", "multiple": False},
    ],
    "targets": [{"path": "out.txt", "target_type": "text", "required": True}],
    "setup_files": [],
    "post_install": None,
    "min_cpus": 1,
    "max_cpus": None,
    "default_cpus": None,
}
pack = {
    "schema_version": 1,
    "tool": {"schema_version": 1, "tool": tool},
    "runner": {
        "schema_version": 1,
        "platform": "mac-arm64" if machine in ("arm64", "aarch64") else "mac-x64",
        "docker_arch": arch,
        "runtime_image": {
            "tag": "cpg-runner-runtime:1",
            "url": f"{portal}/api/v1/runner/runtime-image/{arch}",
            "sha256": "",
        },
        "tool_name": tool["name"],
    },
    "environment_yml": None,
    "readme": "Dev tool pack",
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(pack, handle, indent=2)
PY
fi

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
  bunx electron "${RUNNER_DIR}/dist/electron/main.js" "${PACK}" "$@"
