"""Artifacts the local runner app downloads.

Both are public: an app archive contains nothing secret, and a visitor needs
the app before they have any reason to log in.
"""

from pathlib import Path

from fastapi import HTTPException, Request, Response
from fastapi.responses import FileResponse

from app.api.permission_router import PermissionAPIRouter
from app.core.config import settings

router = PermissionAPIRouter(resource="runner")

# Architectures a runtime image is built for, named the way Docker names an
# architecture after `docker save`, and the way a pack asks for one.
RUNTIME_ARCHES = {"linux-arm64", "linux-amd64"}

# Host platforms an app is built for. Each run runs the Docker image of the
# architecture next to it.
PLATFORM_IMAGE_ARCH = {
    "mac-arm64": "linux-arm64",
    "mac-x64": "linux-amd64",
    "win-x64": "linux-amd64",
    "linux-x64": "linux-amd64",
}
APP_PLATFORMS = tuple(PLATFORM_IMAGE_ARCH)


def _etag(path: Path) -> str:
    """Identity of one build of an archive, for caching and revalidation."""
    stat = path.stat()
    return f'"{stat.st_size:x}-{stat.st_mtime_ns:x}"'


# HEAD is what a client uses to learn the current build without downloading the
# archive: the handler answers it through the same FileResponse.
@router.api_route("/app/{platform}", methods=["GET", "HEAD"], public=True)
def read_app(platform: str, request: Request) -> Response:
    """Download the desktop app for one platform.

    The same archive serves every tool: a tool is a small pack this app
    imports, so a machine downloads the application once no matter how many
    tools it runs. The archive never changes for a given URL, so it is served
    with a long, immutable cache lifetime.
    """
    if platform not in PLATFORM_IMAGE_ARCH:
        raise HTTPException(status_code=404, detail=f"App not available for {platform}")
    path = Path(settings.RUNNER_ARTIFACTS_PATH) / "apps" / f"{platform}.zip"
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"App not available for {platform}")

    # The URL is stable while the archive behind it is not: a rebuild has to
    # reach the visitor. `no-cache` means "revalidate", not "do not store", so
    # an unchanged build still costs only a 304.
    etag = _etag(path)
    headers = {"ETag": etag, "Cache-Control": "public, no-cache"}
    if request.query_params.get("v") == etag.strip('"'):
        # A URL pinned to this build can be cached forever.
        headers["Cache-Control"] = "public, max-age=31536000, immutable"
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return FileResponse(
        path,
        media_type="application/zip",
        filename=f"cpg-runner-{platform}.zip",
        headers=headers,
    )


@router.get("/runtime-image/{docker_arch}", public=True)
def read_runtime_image(docker_arch: str) -> FileResponse:
    """Download the image the app loads before it can run a tool."""
    detail = f"Runtime image not available for {docker_arch}"
    if docker_arch not in RUNTIME_ARCHES:
        raise HTTPException(status_code=404, detail=detail)
    path = Path(settings.RUNNER_ARTIFACTS_PATH) / "runtime" / f"{docker_arch}.tar"
    if not path.is_file():
        raise HTTPException(status_code=404, detail=detail)
    return FileResponse(
        path,
        media_type="application/x-tar",
        filename=f"cpg-runner-runtime-{docker_arch}.tar",
    )
