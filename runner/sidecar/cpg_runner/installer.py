"""Download the runtime image and build the tool's conda environment."""

import hashlib
import threading
from datetime import datetime, timezone
from pathlib import Path

import httpx

from .config import Resources
from .docker_args import (
    build_env_create_args,
    build_post_install_args,
    conda_volume_name,
)
from .docker_cli import Docker
from .doctor import Doctor
from .events import EventChannel
from .state import StateStore

DOWNLOAD_CHUNK = 1024 * 256
DOWNLOAD_LOG_STEP = 10 * 1024 * 1024


class InstallBlocked(Exception):
    def __init__(self, report: dict) -> None:
        super().__init__("Docker is not ready")
        self.report = report


class InstallAlreadyRunning(Exception):
    pass


class Installer:
    def __init__(
        self,
        *,
        resources: Resources,
        docker: Docker,
        doctor: Doctor,
        store: StateStore,
    ) -> None:
        self.resources = resources
        self.tool = resources.tool
        self.runner = resources.runner
        self.docker = docker
        self.doctor = doctor
        self.store = store
        self.needs_environment = resources.environment_yml is not None
        self.channel = EventChannel()
        self._lock = threading.Lock()
        self._installing = False
        self._failure: str | None = None
        self._thread: threading.Thread | None = None

    # -- state -------------------------------------------------------------

    @property
    def state(self) -> str:
        if self._installing:
            return "installing"
        if self._failure is not None:
            return "failed"
        return self.status()

    def status(self) -> str:
        if not self.docker.available():
            return "docker_missing"
        if not self.docker.image_present(self.runner.runtime_image.tag):
            return "image_missing"
        if self.needs_environment and not self._env_installed():
            return "env_missing"
        return "installed"

    def _env_installed(self) -> bool:
        if not self.store.environment_marker(self.tool.id).is_file():
            return False
        return self.docker.volume_exists(conda_volume_name(self.tool.id))

    def env_installed(self) -> bool:
        return self._env_installed() if self.needs_environment else True

    # -- operations --------------------------------------------------------

    def start(self) -> str:
        with self._lock:
            if self._installing:
                raise InstallAlreadyRunning("Installation already running")
            report = self.doctor.diagnose()
            if not report["ready"]:
                raise InstallBlocked(report)
            self._installing = True
            self._failure = None
            self.channel.reset()
            self._publish_state("installing")
            self._thread = threading.Thread(target=self._install, daemon=True)
            self._thread.start()
        return "installing"

    def remove(self) -> str:
        with self._lock:
            if self._installing:
                raise InstallAlreadyRunning("Installation already running")
            self.docker.remove_volume(conda_volume_name(self.tool.id))
            marker = self.store.environment_marker(self.tool.id)
            marker.unlink(missing_ok=True)
            tar = self._runtime_tar()
            tar.unlink(missing_ok=True)
            self._failure = None
            self._publish_state("not_installed")
        return "not_installed"

    def _runtime_tar(self) -> Path:
        return self.store.runtime_dir / f"{self.runner.docker_arch}.tar"

    def _install(self) -> None:
        try:
            self._install_image()
            self._install_environment()
        except Exception as exc:  # noqa: BLE001 - reported to the UI
            message = str(exc)
            self._failure = message
            self._log(message)
            with self._lock:
                self._installing = False
            self._publish_state("failed")
            return
        with self._lock:
            self._installing = False
        self._publish_state("installed")

    def _install_image(self) -> None:
        tag = self.runner.runtime_image.tag
        if self.docker.image_present(tag):
            self._log("Runtime image is already installed.")
            return
        url = self.runner.runtime_image.url
        if not url:
            raise RuntimeError("Runtime image download URL is missing")
        tar = self._runtime_tar()
        tar.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256()
        downloaded = 0
        logged = 0
        self._log("Downloading runtime image…")
        with httpx.stream("GET", url, follow_redirects=True, timeout=120) as response:
            response.raise_for_status()
            with open(tar, "wb") as handle:
                for chunk in response.iter_bytes(DOWNLOAD_CHUNK):
                    handle.write(chunk)
                    digest.update(chunk)
                    downloaded += len(chunk)
                    if downloaded - logged >= DOWNLOAD_LOG_STEP:
                        logged = downloaded
                        megabytes = downloaded // (1024 * 1024)
                        self._log(f"Downloading runtime image … {megabytes} MB")
        expected = (self.runner.runtime_image.sha256 or "").strip().lower()
        if expected and digest.hexdigest() != expected:
            tar.unlink(missing_ok=True)
            raise RuntimeError("Runtime image checksum mismatch")
        self._log("Loading runtime image…")
        try:
            returncode = self.docker.load(tar)
        finally:
            tar.unlink(missing_ok=True)
        if returncode != 0:
            raise RuntimeError("Runtime image could not be loaded")

    def _install_environment(self) -> None:
        if not self.needs_environment:
            return
        if self._env_installed():
            self._log("Tool environment is already installed.")
            return
        environment_yml = self.resources.environment_yml
        assert environment_yml is not None
        volume = conda_volume_name(self.tool.id)
        self.docker.remove_volume(volume)
        self._log("Installing tool environment…")
        args, _ = build_env_create_args(
            docker_bin=self.docker.binary,
            tool_id=self.tool.id,
            image_tag=self.runner.runtime_image.tag,
            environment_yml=environment_yml,
        )
        returncode = self.docker.run(args, self._log)
        if returncode != 0:
            raise RuntimeError("Tool environment installation failed")
        if self.tool.post_install:
            self._log("Running post-install…")
            args, _ = build_post_install_args(
                docker_bin=self.docker.binary,
                tool_id=self.tool.id,
                image_tag=self.runner.runtime_image.tag,
                post_install=self.tool.post_install,
            )
            returncode = self.docker.run(args, self._log)
            if returncode != 0:
                raise RuntimeError("Post-install failed")
        self.store.write_environment_marker(
            self.tool.id,
            {
                "tool_id": self.tool.id,
                "installed_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    # -- events ------------------------------------------------------------

    def _log(self, line: str) -> None:
        self.channel.publish_threadsafe({"type": "log", "line": line})

    def _publish_state(self, state: str) -> None:
        self.channel.publish_threadsafe({"type": "state", "state": state})
