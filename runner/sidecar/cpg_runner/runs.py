"""Local runs: state machine, Docker invocation and output collection."""

import os
import shutil
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.run_spec import (
    input_file_name,
    render_command,
    render_target_path,
    render_template,
    sanitise_shell_input,
)
from app.sandbox import conda_activation
from pydantic import BaseModel, Field

from .config import ToolConfig
from .docker_args import build_run_args, run_container_name
from .docker_cli import Docker
from .events import EventChannel
from .params import _path_list, resolve_params
from .state import StateStore

TERMINAL_STATUSES = {"completed", "failed", "cancelled"}
# Where a run works, inside the output folder the settings name.
WORK_DIR_NAME = ".cpg_work"
# Where the files its targets name end up, next to the run's report.
RESULTS_DIR_NAME = "results"
MAX_CPUS = 1024


class RunFile(BaseModel):
    name: str
    path: str
    size: int


class RunRecord(BaseModel):
    id: str
    name: str = ""
    status: str = "pending"
    params: dict[str, Any] = Field(default_factory=dict)
    # The files the user picked, by parameter, so a rerun can offer the same.
    param_files: dict[str, list[str]] = Field(default_factory=dict)
    cpus: int = 1
    command: str = ""
    created_at: str
    started_at: str | None = None
    finished_at: str | None = None
    exit_code: int | None = None
    stdout: str = ""
    error: str | None = None
    work_dir: str | None = None
    output_dir: str | None = None
    files: list[RunFile] = Field(default_factory=list)


class RunNotFound(KeyError):
    pass


class RunConflict(Exception):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def default_name(tool: ToolConfig, records: dict[str, RunRecord]) -> str:
    """Name for a run left unnamed, e.g. ``Sleep-20261023-001``."""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    runs_today = sum(
        1 for record in records.values() if record.created_at.startswith(today)
    )
    return f"{tool.name}-{now:%Y%m%d}-{runs_today + 1:03d}"


def resolve_cpus(
    tool: ToolConfig,
    params: dict[str, Any],
    requested: int,
) -> int:
    """The CPUs a local run gets.

    The tool's ``max_cpus`` bounds the portal's scheduler, not this computer:
    locally the user may give a run every CPU the machine has.
    """
    minimum = max(1, tool.min_cpus)
    scaled = 0
    for param in tool.params:
        if str(param["param_type"]) != "file":
            continue
        per_file = int(param.get("cpus_per_file") or 0)
        if per_file <= 0:
            continue
        value = params.get(param["name"])
        if isinstance(value, str):
            count = 1 if value else 0
        elif isinstance(value, list):
            count = len(value)
        else:
            count = 0
        scaled += per_file * count
    return max(minimum, scaled, requested)


class RunManager:
    def __init__(
        self,
        *,
        tool: ToolConfig,
        runner: Any,
        docker: Docker,
        store: StateStore,
        resources_dir: Path,
    ) -> None:
        self.tool = tool
        self.runner = runner
        self.docker = docker
        self.store = store
        self.resources_dir = Path(resources_dir)
        environment_yml = self.resources_dir / "environment.yml"
        self.environment_yml: Path | None = (
            environment_yml if environment_yml.is_file() else None
        )

        self._records: dict[str, RunRecord] = {}
        self._channels: dict[str, EventChannel] = {}
        self._file_paths: dict[str, dict[str, list[str]]] = {}
        self._cancelled: set[str] = set()
        self._reported: set[str] = set()
        self._lock = threading.Lock()
        self.recover()

    # -- lifecycle ---------------------------------------------------------

    def recover(self) -> None:
        for raw in self.store.iter_runs():
            try:
                record = RunRecord.model_validate(raw)
            except ValueError:
                continue
            if record.status in {"pending", "running"}:
                record.status = "failed"
                record.error = "Runner was closed before the run finished"
                record.finished_at = _now()
                self.store.write_run(record.model_dump())
                self.docker.rm_force(run_container_name(record.id))
            self._records[record.id] = record

    def start(
        self, submitted: dict[str, Any], cpus: int, *, name: str = ""
    ) -> RunRecord:
        file_paths: dict[str, list[str]] = {}
        for param in self.tool.params:
            if str(param["param_type"]) != "file":
                continue
            paths = _path_list(submitted.get(param["name"]))
            if paths:
                file_paths[param["name"]] = paths

        resolved = resolve_params(self.tool, submitted, file_paths)
        actual_cpus = resolve_cpus(self.tool, resolved, cpus)

        run_id = str(uuid.uuid4())
        record = RunRecord(
            id=run_id,
            name=name.strip()[:255] or default_name(self.tool, self._records),
            status="pending",
            params=resolved,
            param_files={name: list(paths) for name, paths in file_paths.items()},
            cpus=actual_cpus,
            created_at=_now(),
        )
        channel = EventChannel()
        with self._lock:
            self._records[run_id] = record
            self._channels[run_id] = channel
            self._file_paths[run_id] = file_paths
        self._persist(record)
        channel.publish({"type": "status", "status": "pending", "exit_code": None})
        thread = threading.Thread(target=self._execute, args=(run_id,), daemon=True)
        thread.start()
        return record

    def get(self, run_id: str) -> RunRecord:
        record = self._records.get(run_id)
        if record is None:
            raise RunNotFound(run_id)
        return record

    def cancel(self, run_id: str) -> RunRecord:
        record = self.get(run_id)
        if record.status in TERMINAL_STATUSES:
            raise RunConflict("Run already finished")
        self._cancelled.add(run_id)
        self.docker.rm_force(run_container_name(run_id))
        self._finish(record, "cancelled")
        return record

    def subscribe(self, run_id: str) -> tuple[list[dict[str, Any]], EventChannel]:
        record = self.get(run_id)
        channel = self._channels.get(run_id)
        if channel is None:
            # A record restored from disk has no live stream.
            channel = EventChannel()
            for line in record.stdout.splitlines():
                channel.publish({"type": "log", "line": line})
            channel.publish(
                {
                    "type": "status",
                    "status": record.status,
                    "exit_code": record.exit_code,
                }
            )
            self._channels[run_id] = channel
        return channel.history(), channel

    # -- execution ---------------------------------------------------------

    def _execute(self, run_id: str) -> None:
        record = self.get(run_id)
        if run_id in self._cancelled:
            return
        try:
            output_dir = self._new_output_dir()
            record.output_dir = str(output_dir)
            dirs = self._prepare_dirs(record, output_dir)
            input_files = self._input_files(record)
            self._write_setup_files(record, dirs["work"])
            command = self._render_command(record)
        except Exception as exc:  # noqa: BLE001 - surfaced to the user
            self._finish(record, "failed", error=str(exc))
            return

        record.command = command
        if run_id in self._cancelled:
            self._finish(record, "cancelled")
            return
        self._set_status(record, "running", started_at=_now())

        argv = build_run_args(
            docker_bin=self.docker.binary,
            run_id=run_id,
            cpus=record.cpus,
            network=bool(self.store.load_settings().network),
            work_dir=dirs["work"],
            tmp_dir=dirs["tmp"],
            input_files=[(str(path), name) for path, name in input_files],
            image_tag=self.runner.runtime_image.tag,
            shell_command=f"set -euo pipefail; {command}",
            tool_id=self.tool.id if self.environment_yml is not None else None,
        )
        try:
            exit_code = self.docker.run(argv, lambda line: self._log(record, line))
        except Exception as exc:  # noqa: BLE001 - e.g. docker disappeared
            self._finish(record, "failed", error=str(exc))
            return

        if run_id in self._cancelled or record.status == "cancelled":
            self._finish(record, "cancelled", exit_code=exit_code)
            return
        if exit_code != 0:
            self._finish(record, "failed", exit_code=exit_code)
            return

        try:
            matched = self._collect_targets(record, dirs["work"])
            self._write_outputs(record, matched, output_dir)
        except Exception as exc:  # noqa: BLE001 - surfaced to the user
            self._finish(record, "failed", exit_code=exit_code, error=str(exc))
            return

        self._finish(record, "completed", exit_code=exit_code)

    def _new_output_dir(self) -> Path:
        """The folder this run owns: its outputs, report and work folder."""
        settings = self.store.load_settings()
        base = (
            Path(settings.output_dir)
            / f"{sanitise_shell_input(self.tool.name)}-{_timestamp()}"
        )
        output_dir = base
        index = 2
        while output_dir.exists():
            output_dir = base.with_name(f"{base.name}-{index}")
            index += 1
        try:
            output_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise RuntimeError(
                f"Could not write to output folder: {settings.output_dir}"
            ) from exc
        return output_dir

    def _prepare_dirs(self, record: RunRecord, output_dir: Path) -> dict[str, Path]:
        base = output_dir / WORK_DIR_NAME
        dirs = {
            "work": base / "work",
            "tmp": base / "tmp",
        }
        try:
            for path in dirs.values():
                path.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise RuntimeError(
                f"Could not write to output folder: {output_dir}"
            ) from exc
        record.work_dir = str(base)
        return dirs

    def _input_files(self, record: RunRecord) -> list[tuple[Path, str]]:
        """The chosen files as (host path, name the tool sees).

        They are mounted, not copied: locally the file is already on this
        computer, and duplicating a genome next to the run is a waste.
        """
        files: list[tuple[Path, str]] = []
        seen: set[str] = set()
        for sources in self._file_paths.get(record.id, {}).values():
            for source in sources:
                path = Path(source).expanduser().resolve()
                name = input_file_name(path.name)
                if name in seen:
                    continue
                seen.add(name)
                files.append((path, name))
        return files

    def _write_setup_files(self, record: RunRecord, work_dir: Path) -> None:
        for setup_file in self.tool.setup_files:
            name = str(setup_file["name"])
            path = work_dir / name
            if path.exists():
                raise RuntimeError(f"Setup file already exists: {name}")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                render_template(str(setup_file.get("content", "")), record.params),
                encoding="utf-8",
            )

    def _render_command(self, record: RunRecord) -> str:
        command = render_command(self.tool.command, record.params, record.cpus)
        if self.environment_yml is not None:
            command = f"{conda_activation(Path(f'/conda/{self.tool.id}'))} && {command}"
        return command

    def _collect_targets(self, record: RunRecord, work_dir: Path) -> list[Path]:
        work_root = work_dir.resolve()
        matched: list[Path] = []
        seen: set[Path] = set()
        missing: list[str] = []
        for target in self.tool.targets:
            rendered = render_target_path(str(target["path"]), record.params)
            matches = []
            for path in work_dir.glob(rendered):
                resolved = path.resolve()
                if not resolved.is_relative_to(work_root):
                    continue
                if not path.is_file():
                    continue
                matches.append(path)
            if target.get("required", True) and not matches:
                missing.append(rendered)
                continue
            for path in matches:
                if path.resolve() in seen:
                    continue
                seen.add(path.resolve())
                matched.append(path)
        if missing:
            raise RuntimeError(f"Missing required target(s): {', '.join(missing)}")
        return matched

    def _write_outputs(
        self, record: RunRecord, matched: list[Path], output_dir: Path
    ) -> None:
        settings = self.store.load_settings()
        files: list[RunFile] = []
        # The tool's files go in their own folder, so the run folder stays a
        # report: results, provenance and the work folder, each in its place.
        results_dir = output_dir / RESULTS_DIR_NAME
        try:
            results_dir.mkdir(parents=True, exist_ok=True)
            for path in matched:
                destination = results_dir / path.name
                shutil.copy2(path, destination)
                files.append(
                    RunFile(
                        name=destination.name,
                        path=str(destination),
                        size=os.path.getsize(destination),
                    )
                )
        except OSError as exc:
            raise RuntimeError(
                f"Could not write to output folder: {settings.output_dir}"
            ) from exc
        record.files = files

    def _write_report(self, record: RunRecord, status: str) -> None:
        """The provenance of the run, in its own output folder.

        A run that failed has no outputs, and the folder is where its log and
        command are the only way to see what happened, so every finished run
        writes one. Files the tool itself produced are never overwritten.
        """
        if record.output_dir is None or record.id in self._reported:
            return
        self._reported.add(record.id)
        output_dir = Path(record.output_dir)
        settings = self.store.load_settings()

        def write(name: str, text: str, *, mode: int | None = None) -> None:
            path = output_dir / name
            if path.exists():
                return
            path.write_text(text, encoding="utf-8")
            if mode is not None:
                path.chmod(mode)

        try:
            write("command.sh", self._command_script(record), mode=0o755)
            write("log.txt", record.stdout)
            if self.environment_yml is not None:
                environment = output_dir / "environment.yml"
                if not environment.exists():
                    shutil.copy2(self.environment_yml, environment)
                write("install.sh", self._install_script(), mode=0o755)
            write(
                "README.md",
                self._readme(
                    record, output_dir, status=status, network=settings.network
                ),
            )
        except OSError:
            self._log(record, "Could not write the run report to the output folder.")

    def _command_script(self, record: RunRecord) -> str:
        """The command this run executed, runnable in this folder.

        The container's activation (``/conda/<tool id>``) gives way to
        ``./env``, which ``install.sh`` builds here, so the folder reproduces
        the run with the environment it saved.
        """
        lines = [
            "#!/usr/bin/env bash",
            "# The command this run executed, on the run's own inputs.",
            "set -euo pipefail",
            'cd "$(dirname "$0")"',
            'if [ -d env ]; then export PATH="$PWD/env/bin:$PATH"; fi',
            "",
            render_command(self.tool.command, record.params, record.cpus),
        ]
        return "\n".join(lines) + "\n"

    def _install_script(self) -> str:
        """A script that rebuilds the run's environment next to the outputs."""
        lines = [
            "#!/usr/bin/env bash",
            "# Recreates the environment this run used, then runs the tool's",
            "# post-install step. Needs conda or mamba on PATH:",
            "# https://conda-forge.org/download/",
            "set -euo pipefail",
            'cd "$(dirname "$0")"',
            "",
            'CONDA_BIN="$(command -v mamba || command -v conda || true)"',
            'if [ -z "$CONDA_BIN" ]; then',
            '  echo "Conda or mamba is required to recreate this environment." >&2',
            "  exit 1",
            "fi",
            "",
            "# A prefix next to these files, so nothing global is touched.",
            "if [ ! -d env ]; then",
            '  "$CONDA_BIN" env create --yes --file environment.yml --prefix ./env',
            "fi",
            "",
            "# The post-install step expects the environment to be active.",
            'export PATH="$PWD/env/bin:$PATH"',
        ]
        if self.tool.post_install:
            lines += ["", self.tool.post_install.strip()]
        return "\n".join(lines) + "\n"

    def _readme(
        self, record: RunRecord, output_dir: Path, *, status: str, network: bool
    ) -> str:
        version = f" {self.tool.version}" if self.tool.version else ""
        lines = [
            f"# {self.tool.name}{version}",
            "",
            (
                f"Run `{record.name}` finished on "
                f"{datetime.now().astimezone():%Y-%m-%d %H:%M} with "
                f"{record.cpus} {'CPU' if record.cpus == 1 else 'CPUs'}"
                f"{', network access on.' if network else ', offline.'}"
            ),
        ]
        if self.tool.description:
            lines += ["", self.tool.description.strip()]
        explanation = (self.tool.explanation_of_results_markdown or "").strip()
        if status == "completed":
            lines += [
                "",
                "## Results",
                "",
                explanation or "This tool does not describe its results.",
            ]
        else:
            lines += [
                "",
                f"## {'Cancelled' if status == 'cancelled' else 'Failure'}",
                "",
                record.error or f"The run {status} before it produced its results.",
                "",
                "`log.txt` holds everything the tool printed.",
            ]
        lines += ["", "## Reproducing this run", ""]
        if self.environment_yml is not None:
            lines += [
                "```bash",
                "./install.sh   # builds ./env from environment.yml, then runs the post-install step",
                "./command.sh",
                "```",
            ]
        else:
            lines += [
                "```bash",
                "./command.sh",
                "```",
                "",
                "This tool needs no conda environment: the command runs in the"
                " runtime image, whose tools it uses.",
            ]
        if any(str(param["param_type"]) == "file" for param in self.tool.params):
            lines += [
                "",
                "Input files are read from this folder, so put them here first;"
                " the work folder is cleaned up unless the setting says otherwise.",
            ]
        lines += ["", "## Files", ""]
        for file in record.files:
            lines.append(f"- `{RESULTS_DIR_NAME}/{file.name}` — what the run produced")
        descriptions = {
            "log.txt": "everything the run printed",
            "command.sh": "the command that produced these files, runnable here",
            "environment.yml": "the conda environment it ran in",
            "install.sh": "builds that environment and runs the post-install step",
        }
        for name, description in descriptions.items():
            if (output_dir / name).is_file():
                lines.append(f"- `{name}` — {description}")
        return "\n".join(lines) + "\n"

    # -- state helpers -----------------------------------------------------

    def _persist(self, record: RunRecord) -> None:
        self.store.write_run(record.model_dump())

    def _publish(self, record: RunRecord, message: dict[str, Any]) -> None:
        channel = self._channels.get(record.id)
        if channel is not None:
            channel.publish_threadsafe(message)

    def _log(self, record: RunRecord, line: str) -> None:
        record.stdout += line + "\n"
        self._publish(record, {"type": "log", "line": line})

    def _set_status(self, record: RunRecord, status: str, **fields: Any) -> None:
        record.status = status
        for key, value in fields.items():
            setattr(record, key, value)
        self._persist(record)
        self._publish(
            record,
            {
                "type": "status",
                "status": record.status,
                "exit_code": record.exit_code,
            },
        )

    def _finish(
        self,
        record: RunRecord,
        status: str,
        *,
        exit_code: int | None = None,
        error: str | None = None,
    ) -> None:
        if exit_code is not None:
            record.exit_code = exit_code
        if error is not None:
            record.error = error
        if record.finished_at is None:
            record.finished_at = _now()
        # The report and the cleanup happen before the status flips, so a
        # terminal status means the folder is already as it will stay.
        self._write_report(record, status)
        self._clean_work_dir(record)
        self._set_status(record, status)

    def _clean_work_dir(self, record: RunRecord) -> None:
        """Remove the run's work folder when the settings ask for it.

        The outputs and the report sit next to it in the run's own folder, so
        what goes is only the inputs, the command's temp files and whatever
        else it left in ``.cpg_work``.
        """
        if record.work_dir is None:
            return
        if not self.store.load_settings().clean_work_dir:
            return
        shutil.rmtree(Path(record.work_dir), ignore_errors=True)
        record.work_dir = None
