import subprocess

import pytest

from cpg_runner.doctor import (
    LINUX_DOWNLOAD_URL,
    MAC_DOWNLOAD_URL,
    WINDOWS_DOWNLOAD_URL,
    Doctor,
)


def completed(returncode: int = 0, stdout="", stderr=""):
    return subprocess.CompletedProcess(
        args=[], returncode=returncode, stdout=stdout, stderr=stderr
    )


def _which(names):
    def which(name):
        return f"/usr/bin/{name}" if name in names else None

    return which


def test_macos_without_docker_offers_no_brew_without_homebrew():
    doctor = Doctor(
        "darwin",
        which=_which(set()),
        run=lambda argv, timeout=None: completed(1),
        path_exists=lambda path: False,
    )
    report = doctor.diagnose()
    assert report["blocking"] == "docker_cli"
    assert report["ready"] is False
    assert report["actions"] == []
    assert report["download_url"] == MAC_DOWNLOAD_URL
    assert "Install Docker Desktop" in report["instructions"]
    assert report["desktop"] == {"installed": False, "path": None}


def test_macos_without_docker_offers_brew_when_available():
    doctor = Doctor(
        "darwin",
        which=_which({"brew"}),
        run=lambda argv, timeout=None: completed(1),
        path_exists=lambda path: False,
    )
    report = doctor.diagnose()
    assert report["blocking"] == "docker_cli"
    assert [action["id"] for action in report["actions"]] == ["install-docker-brew"]


def test_macos_desktop_installed_but_daemon_down():
    def run(argv, timeout=None):
        if "info" in argv:
            return completed(1, stderr=b"Cannot connect to the Docker daemon")
        return completed(0)

    doctor = Doctor(
        "darwin",
        which=_which({"docker"}),
        run=run,
        path_exists=lambda path: path == "/Applications/Docker.app",
    )
    report = doctor.diagnose()
    assert report["blocking"] == "docker_daemon"
    assert report["desktop"] == {
        "installed": True,
        "path": "/Applications/Docker.app",
    }
    assert [action["id"] for action in report["actions"]] == ["start-docker"]
    assert "Start Docker Desktop" in report["instructions"]


def test_windows_without_wsl():
    doctor = Doctor(
        "windows",
        which=_which({"docker"}),
        run=lambda argv, timeout=None: completed(
            1, stderr=b"Cannot connect to the Docker daemon"
        ),
        path_exists=lambda path: False,
        env={"ProgramFiles": r"C:\Program Files", "LOCALAPPDATA": ""},
    )
    report = doctor.diagnose()
    assert report["wsl"] == {"present": False, "version2": False}
    assert report["blocking"] == "wsl"
    assert report["actions"] == []
    assert "wsl --install" in report["instructions"]
    assert report["download_url"] == WINDOWS_DOWNLOAD_URL


def _windows_runner(*, wsl_version: int = 2, winget: bool = False):
    def run(argv, timeout=None):
        if argv[0] == "wsl.exe":
            if "--status" in argv:
                return completed(0)
            listing = (
                "  NAME      STATE           VERSION\r\n"
                f"* Ubuntu    Running         {wsl_version}\r\n"
            )
            return completed(0, stdout=listing.encode("utf-16-le"))
        if "info" in argv:
            return completed(1, stderr=b"Cannot connect to the Docker daemon")
        return completed(0)

    return run


def test_windows_wsl_version_one_is_blocked():
    doctor = Doctor(
        "windows",
        which=_which({"wsl.exe", "docker"}),
        run=_windows_runner(wsl_version=1),
        path_exists=lambda path: False,
        env={"ProgramFiles": r"C:\Program Files", "LOCALAPPDATA": ""},
    )
    report = doctor.diagnose()
    assert report["wsl"] == {"present": True, "version2": False}
    assert report["blocking"] == "wsl"


def test_windows_winget_action_depends_on_winget():
    names = {"wsl.exe", "winget"}
    doctor = Doctor(
        "windows",
        which=_which(names),
        run=_windows_runner(),
        path_exists=lambda path: False,
        env={"ProgramFiles": r"C:\Program Files", "LOCALAPPDATA": ""},
    )
    report = doctor.diagnose()
    assert report["wsl"] == {"present": True, "version2": True}
    assert report["blocking"] == "docker_cli"
    assert [action["id"] for action in report["actions"]] == ["install-docker-winget"]
    assert "Install Docker Desktop" in report["instructions"]

    without = Doctor(
        "windows",
        which=_which({"wsl.exe"}),
        run=_windows_runner(),
        path_exists=lambda path: False,
        env={"ProgramFiles": r"C:\Program Files", "LOCALAPPDATA": ""},
    )
    assert without.diagnose()["actions"] == []


def test_linux_permission_denied():
    doctor = Doctor(
        "linux",
        which=_which({"docker"}),
        run=lambda argv, timeout=None: completed(
            1, stderr=b"permission denied while trying to connect to the Docker daemon"
        ),
        path_exists=lambda path: False,
    )
    report = doctor.diagnose()
    assert report["blocking"] == "docker_permission"
    assert report["actions"] == []
    assert "usermod -aG docker" in report["instructions"]
    assert report["download_url"] == LINUX_DOWNLOAD_URL


def test_linux_daemon_down_has_no_executable_action():
    doctor = Doctor(
        "linux",
        which=_which({"docker"}),
        run=lambda argv, timeout=None: completed(
            1,
            stderr=b"Cannot connect to the Docker daemon at unix:///var/run/docker.sock",
        ),
        path_exists=lambda path: False,
    )
    report = doctor.diagnose()
    assert report["blocking"] == "docker_daemon"
    assert report["actions"] == []
    assert "systemctl start docker" in report["instructions"]


def test_run_action_refuses_unknown_ids():
    calls = []

    def run(argv, timeout=None):
        calls.append(argv)
        return completed(1, stderr=b"Cannot connect to the Docker daemon")

    doctor = Doctor(
        "linux",
        which=_which({"docker"}),
        run=run,
        path_exists=lambda path: False,
    )
    with pytest.raises(KeyError):
        doctor.run_action("install-everything", lambda line: None)
    forbidden = ("sudo", "wsl --install", "systemctl")
    assert not any(
        token in part for argv in calls for part in argv for token in forbidden
    )


def test_macos_start_docker_action_streams_and_uses_open():
    state = {"launched": False}
    calls = []

    def run(argv, timeout=None):
        calls.append(argv)
        if argv[0] == "open":
            state["launched"] = True
            return completed(0)
        if "info" in argv:
            if state["launched"]:
                return completed(0, stdout=b"27.0")
            return completed(1, stderr=b"Cannot connect to the Docker daemon")
        return completed(0)

    doctor = Doctor(
        "darwin",
        which=_which({"docker"}),
        run=run,
        path_exists=lambda path: path == "/Applications/Docker.app",
        sleep=lambda seconds: None,
    )
    lines = []
    doctor.run_action("start-docker", lines.append)
    assert state["launched"] is True
    assert ["open", "-a", "Docker"] in calls
    assert any("Waiting for Docker daemon" in line for line in lines)
    assert any("Docker is ready" in line for line in lines)
    for line in lines:
        assert "sudo" not in line
        assert "wsl --install" not in line
        assert "systemctl" not in line


def test_macos_brew_action_emits_note_and_starts_docker():
    state = {"launched": False}
    calls = []

    def run(argv, timeout=None):
        calls.append(argv)
        if argv[0] == "open":
            state["launched"] = True
            return completed(0)
        if "info" in argv:
            if state["launched"]:
                return completed(0, stdout=b"27.0")
            return completed(1, stderr=b"Cannot connect to the Docker daemon")
        if argv[:2] == ["brew", "install"]:
            return completed(0)
        return completed(0)

    doctor = Doctor(
        "darwin",
        which=_which({"brew"}),
        run=run,
        path_exists=lambda path: False,
        sleep=lambda seconds: None,
    )
    lines = []
    doctor.run_action("install-docker-brew", lines.append)
    assert lines[0] == (
        "Homebrew may ask for your macOS password in the terminal it opened."
    )
    assert ["brew", "install", "--cask", "docker"] in calls
    for line in lines:
        assert "sudo" not in line


def test_macos_gui_launch_without_path_finds_docker_desktop():
    """A Finder-launched app has no ~/.docker/bin or /usr/local/bin in PATH."""
    desktop = "/Applications/Docker.app/Contents/Resources/bin/docker"
    calls = []

    def run(argv, timeout=None):
        calls.append(argv)
        return completed(0, stdout="29.8.1\n")

    doctor = Doctor(
        "darwin",
        which=lambda name: None,
        run=run,
        path_exists=lambda path: path == desktop,
    )

    report = doctor.diagnose()

    assert report["docker"]["cli"] is True
    assert report["docker"]["daemon"] is True
    assert report["blocking"] is None
    assert report["ready"] is True
    assert calls and calls[0][0] == desktop


def test_linux_gui_launch_without_path_finds_the_engine():
    calls = []

    def run(argv, timeout=None):
        calls.append(argv)
        return completed(0, stdout="27.0.0\n")

    doctor = Doctor(
        "linux",
        which=lambda name: None,
        run=run,
        path_exists=lambda path: path == "/usr/bin/docker",
    )

    report = doctor.diagnose()

    assert report["docker"]["cli"] is True
    assert report["ready"] is True
    assert calls[0][0] == "/usr/bin/docker"
