"""Shared test doubles."""

import subprocess
import threading
import time
import uuid
from pathlib import Path

from cpg_runner.config import RunnerConfig, ToolConfig
from cpg_runner.events import EventChannel
from cpg_runner.installer import InstallBlocked, InstallAlreadyRunning
from cpg_runner.runs import (
    RunConflict,
    RunFolderExists,
    RunNotFound,
    RunRecord,
    TERMINAL_STATUSES,
)


def make_tool(**overrides) -> ToolConfig:
    data = {
        "id": "tool-1",
        "name": "my tool",
        "version": "1.2",
        "command": "printf hi > out.txt",
        "params": [],
        "targets": [{"path": "out.txt", "target_type": "text", "required": True}],
        "min_cpus": 1,
    }
    data.update(overrides)
    return ToolConfig.model_validate(data)


def make_runner(**overrides) -> RunnerConfig:
    data = {
        "schema_version": 1,
        "platform": "mac-arm64",
        "docker_arch": "linux-arm64",
        "runtime_image": {
            "tag": "cpg-runner-runtime:1",
            "url": "https://portal.example/api/v1/runner/runtime-image/linux-arm64",
            "sha256": "a" * 64,
        },
        "tool_name": "my tool",
    }
    data.update(overrides)
    return RunnerConfig.model_validate(data)


class FakeDocker:
    binary = "docker"

    def __init__(
        self,
        *,
        available: bool = True,
        image_present: bool = True,
        returncode: int = 0,
    ) -> None:
        self._available = available
        self._image_present = image_present
        self.returncode = returncode
        self.volumes: set[str] = set()
        self.removed: list[str] = []
        self.loaded: list[Path] = []
        self.run_args: list[list[str]] = []
        self.run_lines: list[str] = ["line one", "line two"]

    def available(self) -> bool:
        return self._available

    def image_present(self, tag: str) -> bool:
        return self._image_present

    def load(self, tar: Path) -> int:
        self.loaded.append(Path(tar))
        return self.returncode

    def volume_exists(self, name: str) -> bool:
        return name in self.volumes

    def remove_volume(self, name: str) -> int:
        self.volumes.discard(name)
        return 0

    def rm_force(self, name: str) -> int:
        self.removed.append(name)
        return 0

    def run(self, args, on_line) -> int:
        self.run_args.append(args)
        for line in self.run_lines:
            on_line(line)
        return self.returncode


class WritingDocker(FakeDocker):
    def __init__(self, *, write: bool = True, files=None, **kwargs) -> None:
        super().__init__(**kwargs)
        self.write = write
        self.files = files if files is not None else {"out.txt": "hi"}

    def run(self, args, on_line) -> int:
        self.run_args.append(args)
        work = _work_dir(args)
        if self.write and work is not None:
            for name, content in self.files.items():
                (work / name).write_text(content)
        for line in self.run_lines:
            on_line(line)
        return self.returncode


class BlockingDocker(FakeDocker):
    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self.started = threading.Event()
        self.release = threading.Event()

    def run(self, args, on_line) -> int:
        self.run_args.append(args)
        self.started.set()
        self.release.wait(5)
        on_line("released")
        return 0


def _work_dir(args: list[str]) -> Path | None:
    for arg in args:
        if arg.startswith("type=bind,source=") and arg.endswith(",target=/work"):
            source = arg[len("type=bind,source=") : -len(",target=/work")]
            return Path(source)
    return None


def completed(returncode: int = 0, stdout="", stderr="") -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(
        args=[], returncode=returncode, stdout=stdout, stderr=stderr
    )


class FakeDoctor:
    def __init__(self, *, ready: bool = True, actions=None) -> None:
        self.ready = ready
        self.actions = list(actions or [])
        self.blocking = None if ready else "docker_daemon"

    def diagnose(self):
        return {
            "platform": "darwin",
            "docker": {
                "cli": True,
                "daemon": self.ready,
                "version": "27.0" if self.ready else None,
                "error": None if self.ready else "daemon down",
            },
            "desktop": {"installed": True, "path": "/Applications/Docker.app"},
            "wsl": None,
            "ready": self.ready,
            "blocking": self.blocking,
            "actions": self.actions if not self.ready else [],
            "instructions": "" if self.ready else "Start Docker Desktop.",
            "download_url": "https://docs.docker.com/desktop/setup/install/mac-install/",
        }

    def run_action(self, action_id, emit):
        emit("action started")


class ActionDoctor(FakeDoctor):
    def __init__(self) -> None:
        super().__init__(
            ready=False, actions=[{"id": "start-docker", "label": "Start"}]
        )
        self.started = threading.Event()
        self.release = threading.Event()

    def diagnose(self):
        report = super().diagnose()
        report["actions"] = (
            [] if self.ready else [{"id": "start-docker", "label": "Start"}]
        )
        return report

    def run_action(self, action_id, emit):
        self.started.set()
        self.release.wait(5)
        emit("line one")
        emit("line two")
        self.ready = True


class FakeInstaller:
    def __init__(self) -> None:
        self.needs_environment = False
        self.state = "installed"
        self.channel = EventChannel()
        self.blocked: dict | None = None
        self._running = False

    def status(self) -> str:
        return self.state

    def env_installed(self) -> bool:
        return True

    def start(self) -> str:
        if self.blocked is not None:
            raise InstallBlocked(self.blocked)
        if self._running:
            raise InstallAlreadyRunning("Installation already running")
        self._running = True
        self.state = "installing"
        return "installing"

    def remove(self) -> str:
        self._running = False
        self.state = "not_installed"
        return "not_installed"


class FakeRunManager:
    def __init__(self) -> None:
        self.records: dict[str, RunRecord] = {}
        self.channels: dict[str, EventChannel] = {}

    def start(self, params: dict, cpus: int, *, name: str = "") -> RunRecord:
        if params.get("fail"):
            raise ValueError("Missing required parameter: x")
        if params.get("conflict"):
            raise RunFolderExists(
                'A folder named "my run" already exists in /tmp/runs'
            )
        record = RunRecord(
            id=str(uuid.uuid4()),
            name=name or "unnamed-run",
            status="pending",
            params=params,
            cpus=cpus,
            created_at="2026-01-01T00:00:00+00:00",
        )
        self.records[record.id] = record
        return record

    def get(self, run_id: str) -> RunRecord:
        if run_id not in self.records:
            raise RunNotFound(run_id)
        return self.records[run_id]

    def cancel(self, run_id: str) -> RunRecord:
        record = self.get(run_id)
        if record.status in TERMINAL_STATUSES:
            raise RunConflict("Run already finished")
        record.status = "cancelled"
        return record

    def subscribe(self, run_id: str):
        record = self.get(run_id)
        channel = self.channels.setdefault(run_id, EventChannel())
        channel.publish({"type": "status", "status": record.status, "exit_code": None})
        return channel.history(), channel


def wait_for(predicate, timeout: float = 5.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.01)
    raise AssertionError("condition was not met in time")
