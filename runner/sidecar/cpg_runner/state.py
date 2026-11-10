"""Settings and run records kept under ``--data-dir``."""

import json
import os
import tempfile
from collections.abc import Iterator
from pathlib import Path

from pydantic import BaseModel

RUNS_SUBDIR = "runs"
ENVIRONMENTS_SUBDIR = "environments"
RUNTIME_SUBDIR = "runtime"


class Settings(BaseModel):
    cpus: int
    output_dir: str
    network: bool = True


class StateStore:
    def __init__(
        self,
        data_dir: Path,
        *,
        tool_name: str,
        documents_dir: Path,
        default_cpus: int,
    ) -> None:
        self.data_dir = Path(data_dir)
        self.documents_dir = Path(documents_dir)
        self.tool_name = tool_name
        self.default_cpus = default_cpus
        self.runs_dir = self.data_dir / RUNS_SUBDIR
        self.environments_dir = self.data_dir / ENVIRONMENTS_SUBDIR
        self.runtime_dir = self.data_dir / RUNTIME_SUBDIR
        self.settings_path = self.data_dir / "settings.json"

    def ensure_dirs(self) -> None:
        for path in (
            self.data_dir,
            self.runs_dir,
            self.environments_dir,
            self.runtime_dir,
        ):
            path.mkdir(parents=True, exist_ok=True)

    def default_settings(self) -> Settings:
        return Settings(
            cpus=self.default_cpus,
            output_dir=str(self.documents_dir / "CPG Runs" / self.tool_name),
            network=True,
        )

    def load_settings(self) -> Settings:
        try:
            with open(self.settings_path, encoding="utf-8") as handle:
                return Settings.model_validate(json.load(handle))
        except (OSError, ValueError):
            return self.default_settings()

    def save_settings(self, settings: Settings) -> None:
        self._write_json(self.settings_path, settings.model_dump())

    def run_path(self, run_id: str) -> Path:
        return self.runs_dir / f"{run_id}.json"

    def write_run(self, record: dict) -> None:
        self._write_json(self.run_path(str(record["id"])), record)

    def read_run(self, run_id: str) -> dict | None:
        path = self.run_path(run_id)
        if not path.is_file():
            return None
        try:
            with open(path, encoding="utf-8") as handle:
                return json.load(handle)
        except (OSError, ValueError):
            return None

    def iter_runs(self) -> Iterator[dict]:
        if not self.runs_dir.is_dir():
            return
        for path in sorted(self.runs_dir.glob("*.json")):
            try:
                with open(path, encoding="utf-8") as handle:
                    record = json.load(handle)
            except (OSError, ValueError):
                continue
            if isinstance(record, dict) and "id" in record:
                yield record

    def write_environment_marker(self, tool_id: str, payload: dict) -> None:
        self._write_json(self.environments_dir / f"{tool_id}.json", payload)

    def environment_marker(self, tool_id: str) -> Path:
        return self.environments_dir / f"{tool_id}.json"

    @staticmethod
    def _write_json(path: Path, payload: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        handle = tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=path.parent,
            prefix=path.name + ".",
            suffix=".tmp",
            delete=False,
        )
        try:
            with handle:
                json.dump(payload, handle, indent=2)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(handle.name, path)
        except BaseException:
            try:
                os.unlink(handle.name)
            except OSError:
                pass
            raise
