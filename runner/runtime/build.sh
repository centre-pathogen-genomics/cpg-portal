#!/usr/bin/env bash
# Build the CPG Runner runtime image for linux/amd64 and linux/arm64,
# save both images as docker archives and write their sha256 checksums.
#
# Output (inside runner/artifacts/runtime/):
#   linux-amd64.tar, linux-amd64.tar.sha256
#   linux-arm64.tar, linux-arm64.tar.sha256
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ARTIFACTS_DIR="${RUNNER_DIR}/artifacts/runtime"
LOCK_FILE="${SCRIPT_DIR}/image.lock"

RUNNER_RUNTIME_TAG="${RUNNER_RUNTIME_TAG:-cpg-runner-runtime:1}"
BASE_TAG="${RUNNER_RUNTIME_BASE_TAG:-condaforge/miniforge3}"
PLATFORMS="${RUNNER_RUNTIME_PLATFORMS:-amd64 arm64}"

QEMU_HINT="Exec format error: this builder cannot execute the target architecture.
Install QEMU/binfmt emulation on the builder host and retry:
  docker run --privileged --rm tonistiigi/binfmt --install all"

sha256_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    echo "Neither shasum nor sha256sum is available" >&2
    return 1
  fi
}

# condaforge/miniforge3:latest -> condaforge/miniforge3@sha256:<digest>
pinned_ref() {
  local ref="$1" repo_digest repo digest last
  repo_digest="$(docker image inspect --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}' "$ref" 2>/dev/null || true)"
  [ -n "${repo_digest}" ] || return 1
  repo="${repo_digest%@*}"
  digest="@${repo_digest##*@}"
  last="${repo##*/}"
  if [[ "${last}" == *:* ]]; then
    repo="${repo%:*}"
  fi
  printf '%s%s\n' "${repo}" "${digest}"
}

mkdir -p "${ARTIFACTS_DIR}"

if [ -f "${LOCK_FILE}" ]; then
  BASE="$(head -n 1 "${LOCK_FILE}" | tr -d '[:space:]')"
  if [ -z "${BASE}" ]; then
    echo "Empty base image pin in ${LOCK_FILE}" >&2
    exit 1
  fi
  echo "Using pinned base image from ${LOCK_FILE}: ${BASE}"
else
  BASE="${BASE_TAG}"
  echo "No ${LOCK_FILE}; using base image tag ${BASE} (will pin its digest after the first build)"
  # Pulling the tag populates RepoDigests, which is where the pin comes from.
  docker pull "${BASE}"
fi

built_any=0
for arch in ${PLATFORMS}; do
  tag_path="${ARTIFACTS_DIR}/linux-${arch}.tar"
  log_file="$(mktemp -t cpg-runner-build.XXXXXX)"

  echo "==> Building ${RUNNER_RUNTIME_TAG} for linux/${arch} (base ${BASE})"
  if docker buildx build \
      --platform "linux/${arch}" \
      --build-arg "MINIFORGE_IMAGE=${BASE}" \
      -t "${RUNNER_RUNTIME_TAG}" \
      --load "${SCRIPT_DIR}" 2>&1 | tee "${log_file}"; then
    :
  else
    if grep -qi 'exec format error' "${log_file}"; then
      echo "${QEMU_HINT}" >&2
    fi
    rm -f "${log_file}"
    exit 1
  fi
  rm -f "${log_file}"

  echo "==> Saving ${tag_path}"
  docker save "${RUNNER_RUNTIME_TAG}" -o "${tag_path}"
  sha256_file "${tag_path}" | tr -d '[:space:]' > "${tag_path}.sha256"
  built_any=1

  if [ ! -f "${LOCK_FILE}" ]; then
    if pinned="$(pinned_ref "${BASE_TAG}")"; then
      printf '%s\n' "${pinned}" > "${LOCK_FILE}"
      BASE="${pinned}"
      echo "==> Wrote base image pin to ${LOCK_FILE}: ${pinned}"
    else
      echo "Warning: no RepoDigests for ${BASE_TAG}; ${LOCK_FILE} was not written" >&2
    fi
  fi
done

if [ "${built_any}" -ne 1 ]; then
  echo "No platforms were built" >&2
  exit 1
fi

echo "==> Runtime artifacts:"
for arch in ${PLATFORMS}; do
  ls -l "${ARTIFACTS_DIR}/linux-${arch}.tar" "${ARTIFACTS_DIR}/linux-${arch}.tar.sha256"
done
