"""Download the runtime image and build the tool's conda environment."""

import hashlib
import threading
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import httpx

from .config import Resources
from .docker_args import (
    build_env_create_args,
    build_post_install_args,
    conda_volume_name,
    install_container_name,
)
from .docker_cli import Docker
from .doctor import Doctor
from .events import EventChannel
from .state import StateStore

DOWNLOAD_CHUNK = 1024 * 256
DOWNLOAD_LOG_STEP = 10 * 1024 * 1024
# Lines kept in memory so a failure can show why it happened even after the
# log file is truncated by the next attempt.
FAILURE_TAIL_LINES = 200


class InstallBlocked(Exception):
    def __init__(self, report: dict) -> None:
        super().__init__("Docker is not ready")
        self.report = report


class InstallAlreadyRunning(Exception):
    pass


class InstallCancelled(Exception):
    """Raised inside the install thread once the user cancels it."""


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
        self.channel = EventChannel()
        # Durable install log: every line the sidecar emits is appended here, so
        # a failed install can always be inspected after the dialog closes and
        # the in-memory stream is gone. Per tool, under the tool's data dir.
        self.log_path = self.store.data_dir / "environments" / "install.log"
        # Ring buffer of recent lines, included in a raised failure so the UI
        # shows why an install failed instead of a bare "installation failed".
        self._recent: deque[str] = deque(maxlen=FAILURE_TAIL_LINES)
        # Injected by tests to keep the heartbeat quick.
        self.heartbeat_seconds = 5.0
        self._lock = threading.Lock()
        self._installing = False
        self._failure: str | None = None
        self._thread: threading.Thread | None = None
        # Set by cancel(): the install thread checks it between steps and the
        # running container is killed, so a cancel takes effect promptly.
        self._cancel = threading.Event()

    # -- state -------------------------------------------------------------

    @property
    def needs_environment(self) -> bool:
        """Whether the pack on disk still carries a conda environment.

        Read live: importing a pack replaces its files, and a tool whose
        environment was removed must not keep installing the old one.
        """
        path = self.resources.environment_yml
        return path is not None and path.is_file()

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
            self._cancel.clear()
            self._recent.clear()
            self.channel.reset()
        # Outside the state lock: file I/O and logging both take the lock
        # themselves, and re-entering a plain Lock here would deadlock.
        try:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
            self.log_path.write_text("", encoding="utf-8")
        except OSError:
            pass
        self._log(f"Install log: {self.log_path}")
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

    def cancel(self) -> str:
        """Stop a running install.

        The install thread is usually blocked reading a `docker run` command's
        output, so the install container is removed to make it return; the
        thread then sees the cancel flag and cleans up instead of reporting a
        failure. A download in progress stops at the next chunk.
        """
        with self._lock:
            if not self._installing:
                return self.state
            self._cancel.set()
        self._log("Cancelling installation…")
        self.docker.rm_force(install_container_name(self.tool.id))
        return "cancelling"

    def _check_cancelled(self) -> None:
        if self._cancel.is_set():
            raise InstallCancelled()

    def _cleanup_partial(self) -> None:
        """Remove what a cancelled install made: the half-built environment,
        its marker and the downloaded image tar. The runtime image itself is
        shared and stays installed."""
        self.docker.rm_force(install_container_name(self.tool.id))
        self.docker.remove_volume(conda_volume_name(self.tool.id))
        self.store.environment_marker(self.tool.id).unlink(missing_ok=True)
        self._runtime_tar().unlink(missing_ok=True)

    def _finish_cancelled(self) -> None:
        self._log("Installation cancelled.")
        self._cleanup_partial()
        with self._lock:
            self._failure = None
            self._installing = False
        self._publish_state("not_installed")

    def _runtime_tar(self) -> Path:
        return self.store.runtime_dir / f"{self.runner.docker_arch}.tar"

    def _install(self) -> None:
        try:
            self._install_image()
            self._install_environment()
            self._check_cancelled()
        except InstallCancelled:
            self._finish_cancelled()
            return
        except Exception as exc:  # noqa: BLE001 - reported to the UI
            if self._cancel.is_set():
                # The step failed because cancel killed its container: that is
                # a cancellation, not an install failure.
                self._finish_cancelled()
                return
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
        self._check_cancelled()
        with httpx.stream("GET", url, follow_redirects=True, timeout=360) as response:
            response.raise_for_status()
            with open(tar, "wb") as handle:
                for chunk in response.iter_bytes(DOWNLOAD_CHUNK):
                    self._check_cancelled()
                    handle.write(chunk)
                    digest.update(chunk)
                    downloaded += len(chunk)
                    if downloaded - logged >= DOWNLOAD_LOG_STEP:
                        logged = downloaded
                        megabytes = downloaded // (1024 * 1024)
                        self._log(f"Downloading runtime image … {megabytes} MB")
        self._check_cancelled()
        expected = (self.runner.runtime_image.sha256 or "").strip().lower()
        if expected and digest.hexdigest() != expected:
            tar.unlink(missing_ok=True)
            raise RuntimeError("Runtime image checksum mismatch")
        self._log("Loading runtime image…")
        try:
            returncode = self.docker.load(tar)
        finally:
            tar.unlink(missing_ok=True)
        self._check_cancelled()
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
        returncode = self._run_with_progress(args, "Still installing the environment")
        self._check_cancelled()
        if returncode != 0:
            raise self._raise_with_tail("Tool environment installation failed")
        self._log("Tool environment installed.")
        if self.tool.post_install:
            command = " ".join(self.tool.post_install.split())
            if len(command) > 300:
                command = command[:297] + "..."
            self._log(f"Running post-install: {command}")
            args, _ = build_post_install_args(
                docker_bin=self.docker.binary,
                tool_id=self.tool.id,
                image_tag=self.runner.runtime_image.tag,
                post_install=self.tool.post_install,
            )
            returncode = self._run_with_progress(args, "Still running post-install")
            self._check_cancelled()
            if returncode != 0:
                raise self._raise_with_tail("Post-install failed")
            self._log("Post-install finished.")
        self._check_cancelled()
        self.store.write_environment_marker(
            self.tool.id,
            {
                "tool_id": self.tool.id,
                "installed_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    # -- events ------------------------------------------------------------

    def _run_with_progress(self, args: list[str], label: str) -> int:
        """Run a container command, saying it is still going while it is.

        mamba is quiet for a minute and a tool's post-install may print nothing
        until it exits, which reads as a freeze; a line every few seconds shows
        the install is alive.
        """
        stopped = threading.Event()
        started = time.monotonic()

        def beat() -> None:
            while not stopped.wait(self.heartbeat_seconds):
                elapsed = int(time.monotonic() - started)
                self._log(f"{label} ({elapsed}s)")

        thread = threading.Thread(target=beat, daemon=True)
        thread.start()
        try:
            return self.docker.run(args, self._log)
        finally:
            stopped.set()
            thread.join(timeout=1.0)

    def _log(self, line: str) -> None:
        with self._lock:
            self._recent.append(line)
            try:
                with open(self.log_path, "a", encoding="utf-8") as handle:
                    handle.write(line + "\n")
            except OSError:
                # The stream still shows the line even if the log cannot be
                # written (read-only data dir, full disk, ...).
                pass
        self.channel.publish_threadsafe({"type": "log", "line": line})

    def _raise_with_tail(self, message: str) -> RuntimeError:
        """Wrap a failure with the recent install output so the reason is not
        swallowed: without it a mamba/conda error is invisible (mamba runs with
        --quiet and the dashboard only shows a bare "installation failed")."""
        with self._lock:
            tail = "\n".join(self._recent)
        return RuntimeError(f"{message}\n\n{tail}" if tail else message)

    def _publish_state(self, state: str) -> None:
        self.channel.publish_threadsafe({"type": "state", "state": state})
