"""Thin wrapper around the ``docker`` command line."""

import os
import shutil
import subprocess
import sys
import time
from collections.abc import Callable
from pathlib import Path

DOCKER_BIN_ENV = "DOCKER_BIN"


def docker_candidates(platform_name: str | None = None) -> tuple[Path, ...]:
    """Where the docker CLI lives when PATH does not say.

    An app started from Finder or the Start menu inherits a minimal PATH: no
    ``~/.docker/bin``, no ``/usr/local/bin``, no ``/opt/homebrew/bin``. Docker
    Desktop installs its links in the places below, so the CLI is found no
    matter how the app was started.
    """
    platform_name = (platform_name or sys.platform).lower()
    home = Path.home()
    if platform_name.startswith("darwin") or platform_name.startswith("mac"):
        return (
            home / ".docker" / "bin" / "docker",
            Path("/Applications/Docker.app/Contents/Resources/bin/docker"),
            Path("/usr/local/bin/docker"),
            Path("/opt/homebrew/bin/docker"),
        )
    if platform_name.startswith("win"):
        candidates: list[Path] = []
        for base in (
            os.environ.get("ProgramFiles"),
            os.environ.get("LOCALAPPDATA"),
            os.environ.get("ProgramData"),
            r"C:\Program Files",
        ):
            if base:
                candidates.append(
                    Path(base)
                    / "Docker"
                    / "Docker"
                    / "resources"
                    / "bin"
                    / "docker.exe"
                )
        candidates.append(home / ".docker" / "bin" / "docker.exe")
        return tuple(candidates)
    return (
        home / ".docker" / "bin" / "docker",
        Path("/usr/bin/docker"),
        Path("/usr/local/bin/docker"),
        Path("/snap/bin/docker"),
    )


def resolve_docker_binary(
    *,
    which: Callable[[str], str | None] = shutil.which,
    exists: Callable[[Path], bool] = Path.is_file,
    env: dict[str, str] | None = None,
) -> str:
    """Full path of the docker CLI, or the configured name if none is found.

    ``DOCKER_BIN`` still wins: a path is used as given, a name is looked up.
    """
    env = os.environ if env is None else env
    configured = env.get(DOCKER_BIN_ENV, "").strip()
    if configured and (os.path.isabs(configured) or os.sep in configured):
        return configured
    found = which(configured or "docker")
    if found:
        return found
    for candidate in docker_candidates():
        if exists(candidate):
            return str(candidate)
    return configured or "docker"


class Docker:
    def __init__(
        self,
        binary: str | None = None,
        *,
        runner: Callable[..., subprocess.CompletedProcess] | None = None,
    ) -> None:
        self.binary = binary or resolve_docker_binary()
        self._runner = runner or subprocess.run
        # `docker ...` costs ~200 ms per call, and one page load asks for the
        # same answers several times; a one-second cache keeps that honest
        # while making the first paint quick.
        self._probe_cache: dict[tuple[object, ...], tuple[float, object]] = {}
        self._cache_seconds = 1.0

    def _cached(self, key: tuple[object, ...], produce):
        now = time.monotonic()
        cached = self._probe_cache.get(key)
        if cached is not None and now - cached[0] < self._cache_seconds:
            return cached[1]
        value = produce()
        self._probe_cache[key] = (now, value)
        return value

    def forget(self) -> None:
        """Drop cached probe answers, e.g. after loading or removing an image."""
        self._probe_cache.clear()

    def command(self, *args: str) -> list[str]:
        return [self.binary, *args]

    def available(self) -> bool:
        return Path(self.binary).is_file() or shutil.which(self.binary) is not None

    def _probe(
        self, *args: str, timeout: float | None = 30
    ) -> subprocess.CompletedProcess:
        return self._runner(
            self.command(*args),
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )

    def server_version(self) -> str | None:
        try:
            result = self._probe("info", "--format", "{{.ServerVersion}}", timeout=10)
        except (OSError, subprocess.SubprocessError):
            return None
        if result.returncode != 0:
            return None
        version = (result.stdout or "").strip()
        return version or None

    def image_present(self, tag: str) -> bool:
        return self._cached(("image", tag), lambda: self._image_present(tag))

    def _image_present(self, tag: str) -> bool:
        try:
            result = self._probe("image", "inspect", tag)
        except (OSError, subprocess.SubprocessError):
            return False
        return result.returncode == 0

    def load(self, tar: Path) -> int:
        try:
            result = self._probe("load", "-i", str(tar), timeout=None)
        except (OSError, subprocess.SubprocessError):
            return 1
        self.forget()
        return result.returncode

    def volume_exists(self, name: str) -> bool:
        return self._cached(("volume", name), lambda: self._volume_exists(name))

    def _volume_exists(self, name: str) -> bool:
        try:
            result = self._probe("volume", "inspect", name)
        except (OSError, subprocess.SubprocessError):
            return False
        return result.returncode == 0

    def remove_volume(self, name: str) -> int:
        self.forget()
        try:
            result = self._probe("volume", "rm", "-f", name)
        except (OSError, subprocess.SubprocessError):
            return 1
        return result.returncode

    def rm_force(self, name: str) -> int:
        try:
            result = self._probe("rm", "-f", name)
        except (OSError, subprocess.SubprocessError):
            return 1
        return result.returncode

    def run(self, args: list[str], on_line: Callable[[str], None]) -> int:
        """Run a docker command, forwarding every output line to ``on_line``."""
        process = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        assert process.stdout is not None
        for line in process.stdout:
            on_line(line.rstrip("\n"))
        return process.wait()
