"""Detect and (safely) repair the local Docker installation."""

import os
import platform as platform_module
import shutil
import subprocess
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from .docker_cli import docker_candidates

MAC_DOWNLOAD_URL = "https://docs.docker.com/desktop/setup/install/mac-install/"
WINDOWS_DOWNLOAD_URL = "https://docs.docker.com/desktop/setup/install/windows-install/"
LINUX_DOWNLOAD_URL = "https://docs.docker.com/engine/install/"

MAC_INSTALL_INSTRUCTIONS = (
    "Install Docker Desktop: https://docs.docker.com/desktop/setup/install/mac-install/ "
    "or run `brew install --cask docker`. Then start Docker Desktop and press Retry."
)
WINDOWS_WSL_INSTRUCTIONS = (
    "Docker Desktop needs WSL 2. In an elevated PowerShell run `wsl --install`, reboot, "
    "then install Docker Desktop: "
    "https://docs.docker.com/desktop/setup/install/windows-install/. "
    "In Docker Desktop enable Settings → Resources → WSL integration."
)
WINDOWS_INSTALL_INSTRUCTIONS = "Install Docker Desktop: https://docs.docker.com/desktop/setup/install/windows-install/."
WINDOWS_START_INSTRUCTIONS = "Start Docker Desktop from the Start menu and press Retry."
LINUX_INSTALL_INSTRUCTIONS = (
    "Install Docker Engine: https://docs.docker.com/engine/install/ — e.g. "
    "`curl -fsSL https://get.docker.com | sudo sh`."
)
LINUX_PERMISSION_INSTRUCTIONS = (
    "Add your user to the docker group: `sudo usermod -aG docker $USER`, then log out "
    "and back in and press Retry."
)
LINUX_START_INSTRUCTIONS = (
    "Start the daemon: `sudo systemctl start docker` and press Retry."
)


def _default_run(
    argv: list[str], timeout: float | None = None
) -> subprocess.CompletedProcess:
    return subprocess.run(argv, capture_output=True, timeout=timeout, check=False)


def _decode(data: Any) -> str:
    if data is None:
        return ""
    if isinstance(data, bytes):
        if b"\x00" in data:
            return data.decode("utf-16-le", errors="replace")
        return data.decode("utf-8", errors="replace")
    return str(data)


def _last_line(text: str) -> str | None:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return lines[-1] if lines else None


class Doctor:
    def __init__(
        self,
        platform_name: str | None = None,
        *,
        which: Callable[[str], str | None] = shutil.which,
        run: Callable[..., subprocess.CompletedProcess] | None = None,
        path_exists: Callable[[str], bool] | None = None,
        sleep: Callable[[float], None] = time.sleep,
        docker_bin: str | None = None,
        env: dict[str, str] | None = None,
    ) -> None:
        self.platform = (platform_name or platform_module.system()).lower()
        if self.platform == "darwin" or self.platform.startswith("mac"):
            self.platform = "darwin"
        elif self.platform.startswith("win"):
            self.platform = "windows"
        elif self.platform.startswith("linux"):
            self.platform = "linux"
        self.which = which
        self.run = run or _default_run
        self.path_exists = path_exists or (lambda path: Path(path).exists())
        self.sleep = sleep
        self.env = env if env is not None else os.environ
        self.docker_bin = docker_bin or self.env.get("DOCKER_BIN", "docker")
        # Where the CLI was actually found; resolved on every diagnosis.
        self.docker_path = self.docker_bin

    # -- detection ---------------------------------------------------------

    def _docker_info(self) -> tuple[bool, str | None, str | None]:
        try:
            result = self.run(
                [self.docker_path, "info", "--format", "{{.ServerVersion}}"],
                timeout=10,
            )
        except Exception as exc:  # noqa: BLE001 - report any probe failure
            return False, None, str(exc)
        stdout = _decode(result.stdout).strip()
        stderr = _decode(result.stderr)
        if result.returncode == 0:
            return True, stdout or None, None
        return False, None, _last_line(stderr)

    def _desktop(self) -> tuple[bool, str | None]:
        if self.platform == "darwin":
            path = "/Applications/Docker.app"
            return self.path_exists(path), path if self.path_exists(path) else None
        if self.platform == "windows":
            candidates = [
                str(
                    Path(self.env.get("ProgramFiles", r"C:\Program Files"))
                    / "Docker"
                    / "Docker"
                    / "Docker Desktop.exe"
                ),
                str(
                    Path(self.env.get("LOCALAPPDATA", ""))
                    / "Docker"
                    / "Docker Desktop.exe"
                ),
            ]
            for candidate in candidates:
                if self.path_exists(candidate):
                    return True, candidate
            return False, None
        return False, None

    def _wsl(self) -> dict[str, bool]:
        if self.which("wsl.exe") is None:
            return {"present": False, "version2": False}
        try:
            status = self.run(["wsl.exe", "--status"], timeout=10)
        except Exception:  # noqa: BLE001
            return {"present": False, "version2": False}
        present = status.returncode == 0
        version2 = False
        if present:
            try:
                listing = self.run(["wsl.exe", "-l", "-v"], timeout=10)
                text = _decode(listing.stdout)
                for line in text.splitlines()[1:]:
                    tokens = line.replace("*", " ").split()
                    if tokens and tokens[-1] == "2":
                        version2 = True
            except Exception:  # noqa: BLE001
                version2 = False
        return {"present": present, "version2": version2}

    def resolve_cli(self) -> str | None:
        """The docker CLI, or None.

        PATH comes first, then the places Docker installs its links: a GUI
        launch has a minimal PATH, so a bare `which` would miss a perfectly
        fine Docker Desktop.
        """
        found = self.which(self.docker_bin)
        if found:
            return found
        if Path(self.docker_bin).is_absolute():
            return self.docker_bin if self.path_exists(self.docker_bin) else None
        for candidate in docker_candidates(self.platform):
            if self.path_exists(str(candidate)):
                return str(candidate)
        return None

    def diagnose(self) -> dict[str, Any]:
        cli_path = self.resolve_cli()
        cli = cli_path is not None
        if cli_path:
            self.docker_path = cli_path
        daemon, version, error = (
            self._docker_info() if cli_path else (False, None, None)
        )
        desktop_installed, desktop_path = self._desktop()
        wsl = self._wsl() if self.platform == "windows" else None

        permission_denied = bool(error and "permission denied" in error.lower())
        blocking: str | None = None
        ready = False
        if self.platform == "windows" and (
            wsl is None or not wsl["present"] or not wsl["version2"]
        ):
            blocking = "wsl"
        elif not cli:
            blocking = "docker_cli"
        elif permission_denied:
            blocking = "docker_permission"
        elif not daemon:
            blocking = "docker_daemon"
        else:
            ready = True

        actions = self._actions(desktop_installed=desktop_installed, daemon=daemon)
        return {
            "platform": self.platform,
            "docker": {
                "cli": cli,
                "daemon": daemon,
                "version": version,
                "error": error,
            },
            "desktop": {
                "installed": desktop_installed,
                "path": desktop_path,
            },
            "wsl": wsl,
            "ready": ready,
            "blocking": blocking,
            "actions": actions,
            "instructions": self._instructions(
                cli=cli,
                daemon=daemon,
                permission_denied=permission_denied,
                desktop_installed=desktop_installed,
                wsl=wsl,
            ),
            "download_url": self._download_url(),
        }

    def _actions(
        self, *, desktop_installed: bool, daemon: bool
    ) -> list[dict[str, str]]:
        actions: list[dict[str, str]] = []
        if desktop_installed and not daemon:
            actions.append({"id": "start-docker", "label": "Start Docker Desktop"})
        if self.platform == "darwin" and not desktop_installed:
            if self.which("brew") is not None:
                actions.append(
                    {
                        "id": "install-docker-brew",
                        "label": "Install Docker Desktop with Homebrew",
                    }
                )
        if self.platform == "windows" and not desktop_installed:
            if self.which("winget") is not None:
                actions.append(
                    {
                        "id": "install-docker-winget",
                        "label": "Install Docker Desktop with winget",
                    }
                )
        return actions

    def _instructions(
        self,
        *,
        cli: bool,
        daemon: bool,
        permission_denied: bool,
        desktop_installed: bool,
        wsl: dict[str, bool] | None,
    ) -> str:
        if self.platform == "darwin":
            if not desktop_installed:
                return MAC_INSTALL_INSTRUCTIONS
            if not daemon:
                return (
                    "Start Docker Desktop from the Applications folder and press Retry."
                )
            return ""
        if self.platform == "windows":
            if wsl is None or not wsl["present"] or not wsl["version2"]:
                return WINDOWS_WSL_INSTRUCTIONS
            if not desktop_installed:
                return WINDOWS_INSTALL_INSTRUCTIONS
            if not daemon:
                return WINDOWS_START_INSTRUCTIONS
            return ""
        if not cli:
            return LINUX_INSTALL_INSTRUCTIONS
        if permission_denied:
            return LINUX_PERMISSION_INSTRUCTIONS
        if not daemon:
            return LINUX_START_INSTRUCTIONS
        return ""

    def _download_url(self) -> str:
        if self.platform == "darwin":
            return MAC_DOWNLOAD_URL
        if self.platform == "windows":
            return WINDOWS_DOWNLOAD_URL
        return LINUX_DOWNLOAD_URL

    # -- actions -----------------------------------------------------------

    def run_action(self, action_id: str, emit: Callable[[str], None]) -> None:
        report = self.diagnose()
        allowed = {action["id"] for action in report["actions"]}
        if action_id not in allowed:
            raise KeyError(action_id)
        if action_id == "start-docker":
            self._start_docker(report, emit)
        elif action_id == "install-docker-brew":
            emit("Homebrew may ask for your macOS password in the terminal it opened.")
            self._run_command(["brew", "install", "--cask", "docker"], emit)
            report = self.diagnose()
            self._start_docker(report, emit)
        elif action_id == "install-docker-winget":
            emit("Windows will show a UAC prompt.")
            self._run_command(
                [
                    "winget",
                    "install",
                    "--exact",
                    "--id",
                    "Docker.DockerDesktop",
                    "--accept-package-agreements",
                    "--accept-source-agreements",
                ],
                emit,
            )
        else:  # pragma: no cover - the allowed set is the source of truth
            raise KeyError(action_id)

    def _run_command(self, argv: list[str], emit: Callable[[str], None]) -> int:
        try:
            result = self.run(argv, timeout=None)
        except Exception as exc:  # noqa: BLE001
            emit(str(exc))
            return 1
        for line in _decode(getattr(result, "stdout", "")).splitlines():
            if line.strip():
                emit(line.rstrip())
        for line in _decode(getattr(result, "stderr", "")).splitlines():
            if line.strip():
                emit(line.rstrip())
        return result.returncode

    def _start_docker(
        self, report: dict[str, Any], emit: Callable[[str], None]
    ) -> None:
        desktop_path = report["desktop"]["path"]
        if self.platform == "darwin":
            argv = ["open", "-a", "Docker"]
        elif self.platform == "windows":
            argv = [
                "powershell",
                "-NoProfile",
                "-Command",
                f"Start-Process -FilePath '{desktop_path}'",
            ]
        else:
            emit(LINUX_START_INSTRUCTIONS)
            return
        result = self._run_command(argv, emit)
        if result != 0:
            emit("Docker could not be started.")
            return
        emit("Waiting for Docker daemon…")
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            if self._docker_info()[0]:
                emit("Docker is ready.")
                return
            self.sleep(2)
        emit("Docker did not start within 2 minutes.")
