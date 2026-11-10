#!/usr/bin/env bash
#
# Build the CPG Runner desktop app bundles and, optionally, the Docker runtime image.
#
# Usage:
#   runner/scripts/build-apps.sh [options] [platform ...]
#
# Platforms:
#   mac-arm64 mac-x64 win-x64 linux-x64
# Default: mac-arm64 mac-x64 linux-x64 (win-x64 needs a Windows host, or Linux with wine).
#
# Options:
#   --unsigned     macOS: ad-hoc sign instead of Developer ID signing, skip notarization.
#                  The resulting app only opens via right-click -> Open.
#   --runtime      Also build the Docker runtime image (runner/runtime/build.sh).
#   --skip-build   Reuse the existing sidecar binary and renderer/main builds (CI does
#                  those in earlier steps); only package the app.
#   -h, --help     Show this help.
#
# Output:
#   runner/artifacts/apps/<platform>.zip
#   runner/artifacts/runtime/linux-<arch>.tar{,.sha256}   (with --runtime)
#
# The app zips are never extracted: the portal appends tool.json/runner.json to them,
# and rewriting entries would break the macOS signature and executable bits.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
APPS_DIR="${RUNNER_DIR}/artifacts/apps"
ELECTRON_BUILDER_CONFIG="electron-builder.yml"
SIDECAR_SPEC="cpg-runner.spec"

VALID_PLATFORMS="mac-arm64 mac-x64 win-x64 linux-x64"

unsigned=0
build_runtime=0
skip_build=0
platforms=()
artifacts=()

log() { printf '\n==> %s\n' "$*"; }
die() { printf '%s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '3,25p' "${BASH_SOURCE[0]}" | sed -e 's/^# \{0,1\}//'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --unsigned) unsigned=1 ;;
    --runtime) build_runtime=1 ;;
    --skip-build) skip_build=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    --*) die "Unknown option: $1" ;;
    *) platforms+=("$1") ;;
  esac
  shift
done

if [ "${#platforms[@]}" -eq 0 ]; then
  platforms=(mac-arm64 mac-x64 linux-x64)
fi

for platform in "${platforms[@]}"; do
  case " ${VALID_PLATFORMS} " in
    *" ${platform} "*) ;;
    *) die "Unknown platform: ${platform} (expected one of: ${VALID_PLATFORMS})" ;;
  esac
done

# Fail before doing any build work when a signed macOS build cannot be produced.
needs_mac_signing=0
for platform in "${platforms[@]}"; do
  case "${platform}" in mac-*) needs_mac_signing=1 ;; esac
done
if [ "${needs_mac_signing}" -eq 1 ] && [ "$(uname -s)" != "Darwin" ]; then
  die "macOS platforms must be built on macOS (codesign and notarytool are macOS-only)"
fi
if [ "${needs_mac_signing}" -eq 1 ] && [ "${unsigned}" -eq 0 ]; then
  missing=0
  [ -n "${CSC_LINK:-}" ] || missing=1
  [ -n "${CSC_KEY_PASSWORD:-}" ] || missing=1
  [ -n "${APPLE_ID:-}" ] || missing=1
  [ -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] || missing=1
  [ -n "${APPLE_TEAM_ID:-}" ] || missing=1
  if [ "${missing}" -eq 1 ]; then
    printf '%s\n' "Set the macOS signing/notarization secrets to build a double-clickable app" >&2
    exit 1
  fi
fi

need() { command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"; }

[ -f "${RUNNER_DIR}/package.json" ] || die "Missing ${RUNNER_DIR}/package.json"
[ -f "${RUNNER_DIR}/${ELECTRON_BUILDER_CONFIG}" ] || die "Missing ${RUNNER_DIR}/${ELECTRON_BUILDER_CONFIG}"
mkdir -p "${APPS_DIR}"

build_inputs() {
  if [ "${skip_build}" -eq 1 ]; then
    [ -e "${RUNNER_DIR}/sidecar/dist/cpg-runner" ] ||
      die "Missing sidecar build at ${RUNNER_DIR}/sidecar/dist/cpg-runner; run without --skip-build"
    [ -f "${RUNNER_DIR}/dist/electron/main.js" ] ||
      die "Missing main process build at ${RUNNER_DIR}/dist/electron/main.js; run without --skip-build"
    [ -f "${RUNNER_DIR}/renderer/dist/index.html" ] ||
      die "Missing renderer build at ${RUNNER_DIR}/renderer/dist/index.html; run without --skip-build"
    log "Reusing the existing sidecar and renderer builds"
    return
  fi

  [ -f "${RUNNER_DIR}/sidecar/${SIDECAR_SPEC}" ] ||
    die "Missing PyInstaller spec: ${RUNNER_DIR}/sidecar/${SIDECAR_SPEC}"
  need uv
  log "Building the Python sidecar"
  (cd "${RUNNER_DIR}/sidecar" && uv run pyinstaller "${SIDECAR_SPEC}" --noconfirm)

  need bun
  log "Building the renderer and main process"
  (cd "${RUNNER_DIR}" && bun run build)
}

run_electron_builder() {
  need bun
  # --publish never: the release workflow uploads the archives itself.
  if [ "${unsigned}" -eq 1 ]; then
    (cd "${RUNNER_DIR}" && CSC_IDENTITY_AUTO_DISCOVERY=false bunx electron-builder --config "${ELECTRON_BUILDER_CONFIG}" --publish never "$@")
  else
    (cd "${RUNNER_DIR}" && bunx electron-builder --config "${ELECTRON_BUILDER_CONFIG}" --publish never "$@")
  fi
}

find_mac_app() {
  local arch="$1" candidate
  case "${arch}" in
    arm64) set -- "${RUNNER_DIR}/dist/mac-arm64/CPG Runner.app" "${RUNNER_DIR}/dist/mac/CPG Runner.app" ;;
    x64) set -- "${RUNNER_DIR}/dist/mac/CPG Runner.app" "${RUNNER_DIR}/dist/mac-x64/CPG Runner.app" ;;
    *) die "Unsupported macOS architecture: ${arch}" ;;
  esac
  for candidate in "$@"; do
    if [ -d "${candidate}" ]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done
  return 1
}

package_mac() {
  local platform="$1" arch="$2" app zip notarize_zip
  if [ "$(uname -s)" != "Darwin" ]; then
    die "Platform ${platform} must be built on macOS (codesign and notarytool are macOS-only)"
  fi
  for tool in codesign ditto xcrun spctl; do need "${tool}"; done

  log "Packaging ${platform}"
  run_electron_builder --mac "--${arch}" --dir
  app="$(find_mac_app "${arch}")" || die "electron-builder did not produce an .app bundle for ${platform}"
  zip="${APPS_DIR}/${platform}.zip"
  rm -f "${zip}"

  if [ "${unsigned}" -eq 1 ]; then
    codesign --force --deep --sign - "${app}"
    codesign --verify --deep --strict --verbose=2 "${app}"
    ditto -c -k --keepParent "${app}" "${zip}"
    printf 'Unsigned build: macOS requires right-click → Open\n'
  else
    codesign --verify --deep --strict --verbose=2 "${app}"
    notarize_zip="$(mktemp -t cpg-notarize)"
    ditto -c -k --keepParent "${app}" "${notarize_zip}"
    xcrun notarytool submit "${notarize_zip}" \
      --apple-id "${APPLE_ID}" \
      --password "${APPLE_APP_SPECIFIC_PASSWORD}" \
      --team-id "${APPLE_TEAM_ID}" \
      --wait
    rm -f "${notarize_zip}"
    xcrun stapler staple "${app}"
    spctl -a -vv "${app}"
    ditto -c -k --keepParent "${app}" "${zip}"
  fi

  artifacts+=("${zip}")
}

package_zip() {
  local platform="$1" produced
  shift

  log "Packaging ${platform}"
  # electron-builder writes the platform archives to dist/; drop stale ones so the
  # artifact picked below is the one we just built.
  rm -f "${RUNNER_DIR}/dist/"*.zip
  run_electron_builder "$@"

  produced="$(find "${RUNNER_DIR}/dist" -maxdepth 1 -type f -name '*.zip' -print -quit)"
  if [ -z "${produced}" ]; then
    die "electron-builder did not produce a zip archive for ${platform}"
  fi
  mv -f "${produced}" "${APPS_DIR}/${platform}.zip"
  artifacts+=("${APPS_DIR}/${platform}.zip")
}

build_inputs

for platform in "${platforms[@]}"; do
  case "${platform}" in
    mac-arm64) package_mac mac-arm64 arm64 ;;
    mac-x64) package_mac mac-x64 x64 ;;
    win-x64) package_zip win-x64 --win --x64 ;;
    linux-x64) package_zip linux-x64 --linux --x64 ;;
  esac
done

if [ "${build_runtime}" -eq 1 ]; then
  [ -f "${RUNNER_DIR}/runtime/build.sh" ] || die "Missing ${RUNNER_DIR}/runtime/build.sh"
  log "Building the Docker runtime image"
  bash "${RUNNER_DIR}/runtime/build.sh"
fi

log "Artifacts"
for path in "${artifacts[@]}"; do
  printf '  %s\n' "${path}"
done
if [ "${build_runtime}" -eq 1 ]; then
  for path in "${RUNNER_DIR}/artifacts/runtime/"*.tar "${RUNNER_DIR}/artifacts/runtime/"*.sha256; do
    if [ -f "${path}" ]; then
      printf '  %s\n' "${path}"
    fi
  done
fi
