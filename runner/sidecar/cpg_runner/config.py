"""The bundle configuration read from ``--resources-dir``."""

import json
from pathlib import Path

from pydantic import BaseModel, Field, field_validator


class ToolConfig(BaseModel):
    id: str
    name: str
    version: str = ""
    description: str | None = None
    explanation_of_results_markdown: str | None = None
    # What the portal says about the tool: picture, links and badges.
    image: str | None = None
    url: str | None = None
    docs_url: str | None = None
    paper_doi: str | None = None
    license: str | None = None
    github_repo: str | None = None
    tags: list[str] = Field(default_factory=list)
    badges: list[dict] = Field(default_factory=list)
    command: str
    params: list[dict] = Field(default_factory=list)
    targets: list[dict] = Field(default_factory=list)
    timeline: list[dict] = Field(default_factory=list)
    setup_files: list[dict] = Field(default_factory=list)
    post_install: str | None = None
    min_cpus: int = 1
    max_cpus: int | None = None
    default_cpus: int | None = None

    @field_validator("version", mode="before")
    @classmethod
    def _empty_version(cls, value):
        return value or ""


class RuntimeImageConfig(BaseModel):
    tag: str
    url: str
    sha256: str = ""


class RunnerConfig(BaseModel):
    schema_version: int = 1
    platform: str
    docker_arch: str
    runtime_image: RuntimeImageConfig
    tool_name: str


class Resources(BaseModel):
    """Everything the app needs from the download directory."""

    tool: ToolConfig
    runner: RunnerConfig
    environment_yml: Path | None = None

    @property
    def needs_environment(self) -> bool:
        return self.environment_yml is not None


def _read_json(path: Path) -> object:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def load_tool(resources_dir: Path) -> ToolConfig:
    payload = _read_json(resources_dir / "tool.json")
    if isinstance(payload, dict) and isinstance(payload.get("tool"), dict):
        payload = payload["tool"]
    return ToolConfig.model_validate(payload)


def load_runner(resources_dir: Path) -> RunnerConfig:
    return RunnerConfig.model_validate(_read_json(resources_dir / "runner.json"))


def load_resources(resources_dir: Path) -> Resources:
    environment_yml = resources_dir / "environment.yml"
    return Resources(
        tool=load_tool(resources_dir),
        runner=load_runner(resources_dir),
        environment_yml=environment_yml if environment_yml.is_file() else None,
    )
