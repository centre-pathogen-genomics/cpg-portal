"""The installer follows the pack on disk, not the one read at startup."""

from pathlib import Path

from cpg_runner.config import Resources
from cpg_runner.installer import Installer
from cpg_runner.state import StateStore
from support import (
    BlockingDocker,
    FakeDocker,
    FakeDoctor,
    make_runner,
    make_tool,
    wait_for,
)


def _installer(
    tmp_path: Path, environment_yml: Path | None
) -> tuple[Installer, FakeDocker, StateStore]:
    resources = Resources(
        tool=make_tool(),
        runner=make_runner(),
        environment_yml=environment_yml,
    )
    docker = FakeDocker()
    store = StateStore(
        tmp_path / "data",
        tool_name="my tool",
        documents_dir=tmp_path / "docs",
        default_cpus=1,
    )
    installer = Installer(
        resources=resources, docker=docker, doctor=FakeDoctor(), store=store
    )
    return installer, docker, store


def test_a_removed_environment_is_not_installed(tmp_path):
    """A pack re-imported without its environment must not mount the old file."""
    environment = tmp_path / "environment.yml"
    environment.write_text("channels: [conda-forge]\ndependencies: []\n")
    installer, docker, _store = _installer(tmp_path, environment)

    assert installer.needs_environment is True
    assert installer.status() == "env_missing"

    environment.unlink()

    assert installer.needs_environment is False
    assert installer.status() == "installed"

    installer.start()
    wait_for(lambda: installer.state == "installed")

    assert docker.run_args == []


def test_an_environment_on_disk_is_created(tmp_path):
    environment = tmp_path / "environment.yml"
    environment.write_text("channels: [conda-forge]\ndependencies: [python=3.11]\n")
    installer, docker, store = _installer(tmp_path, environment)

    installer.start()
    marker = store.environment_marker(installer.tool.id)
    wait_for(marker.is_file)

    assert len(docker.run_args) == 1
    assert "mamba env create" in " ".join(docker.run_args[0])


def test_the_install_log_names_the_post_install_command(tmp_path):
    environment = tmp_path / "environment.yml"
    environment.write_text("channels: [conda-forge]\ndependencies: []\n")
    installer, docker, store = _installer(tmp_path, environment)
    installer.tool.post_install = "sleep 60"

    installer.start()
    marker = store.environment_marker(installer.tool.id)
    wait_for(marker.is_file)

    assert any("Running post-install: sleep 60" == line for line in _lines(installer))
    assert len(docker.run_args) == 2


def test_the_install_log_is_persisted_to_disk(tmp_path):
    """Every line the sidecar emits is appended to a durable per-tool file, so
    a failed install can be inspected after the dialog and its stream are gone."""
    environment = tmp_path / "environment.yml"
    environment.write_text("channels: [conda-forge]\ndependencies: []\n")
    installer, docker, store = _installer(tmp_path, environment)

    installer.start()
    marker = store.environment_marker(installer.tool.id)
    wait_for(marker.is_file)

    log = installer.log_path.read_text(encoding="utf-8")
    assert f"Install log: {installer.log_path}" in log
    assert "line one" in log
    assert "line two" in log


def test_a_failed_environment_install_surfaces_the_output_tail(tmp_path):
    """A failing mamba env create must report *why*, not a bare generic
    message. The recent output is included in the failure the dashboard shows."""
    environment = tmp_path / "environment.yml"
    environment.write_text("channels: [conda-forge]\ndependencies: []\n")
    installer, docker, store = _installer(tmp_path, environment)
    docker.returncode = 1

    installer.start()
    wait_for(lambda: installer.state == "failed")

    failures = [
        line
        for line in _lines(installer)
        if "Tool environment installation failed" in line
    ]
    assert failures, "the failure must be logged"
    assert "line one" in failures[0]
    assert "line two" in failures[0]
    # And it is preserved on disk for later inspection.
    assert "line one" in installer.log_path.read_text(encoding="utf-8")


class CancellingDocker(BlockingDocker):
    """Blocks like a real install; cancel() removes the container to unblock it."""

    def rm_force(self, name: str) -> int:
        self.release.set()
        return super().rm_force(name)


def test_cancelling_a_running_install_cleans_up(tmp_path):
    """Cancel must stop the blocked docker command, not report a failure, and
    remove the half-built environment so Retry starts from a clean slate."""
    environment = tmp_path / "environment.yml"
    environment.write_text("channels: [conda-forge]\ndependencies: []\n")
    resources = Resources(
        tool=make_tool(), runner=make_runner(), environment_yml=environment
    )
    docker = CancellingDocker()
    store = StateStore(
        tmp_path / "data",
        tool_name="my tool",
        documents_dir=tmp_path / "docs",
        default_cpus=1,
    )
    installer = Installer(
        resources=resources, docker=docker, doctor=FakeDoctor(), store=store
    )

    installer.start()
    wait_for(docker.started.is_set)

    installer.cancel()
    wait_for(lambda: installer.state != "installing")

    assert installer.state != "failed"
    assert not store.environment_marker(installer.tool.id).exists()
    assert f"cpg-runner-install-{installer.tool.id}" in docker.removed
    assert "Installation cancelled." in _lines(installer)


def _lines(installer: Installer) -> list[str]:
    return [
        message["line"] for message in installer.channel.history() if "line" in message
    ]
