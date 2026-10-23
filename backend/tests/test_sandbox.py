import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest

from app import sandbox
from app.core.config import settings
from app.tasks import (
    RunDirs,
    build_run_argv,
    link_input_files,
    process_targets,
    sandbox_data_path,
)


def _dirs(tmp_path: Path) -> RunDirs:
    dirs = RunDirs(
        work=tmp_path / "work",
        inputs=tmp_path / "inputs",
        tmp=tmp_path / "tmp",
    )
    for directory in (dirs.work, dirs.inputs, dirs.tmp):
        directory.mkdir()
    return dirs


def _input_file(tmp_path: Path, name: str) -> tuple[uuid.UUID, Path]:
    """Create a file as it is stored by the portal, and its database id."""
    file_id = uuid.uuid4()
    location = tmp_path / f"{file_id}_{name}"
    location.write_text("input data")
    return file_id, location


class _StubSession:
    """Minimal session returning prepared File rows, and accepting updates."""

    def __init__(self, locations: dict[uuid.UUID, Path]):
        self.locations = locations

    def get(self, model, file_id):  # noqa: ARG002
        return SimpleNamespace(location=str(self.locations[file_id]))

    def add(self, instance) -> None:
        pass

    def commit(self) -> None:
        pass


def test_sandbox_exec_command_only_mounts_the_run(tmp_path: Path) -> None:
    dirs = _dirs(tmp_path)
    _, location = _input_file(tmp_path, "sample.bam")
    conda_prefix = Path("/conda") / str(uuid.uuid4())
    data_path = tmp_path / "DB"
    data_path.mkdir()

    argv = sandbox.sandbox_exec_command(
        image="/apptainer/runtime.sif",
        work_dir=dirs.work,
        tmp_dir=dirs.tmp,
        inputs_dir=dirs.inputs,
        input_files={location.name: location},
        conda_prefix=conda_prefix,
        data_path=data_path,
        cpus=4,
        network="none",
        dns="1.1.1.1",
        command="samtools view sample.bam",
    )

    assert argv[:2] == ["apptainer", "exec"]
    # The container process is isolated and runs without capabilities.
    assert "--containall" in argv
    assert "--no-privs" in argv
    # ... with a network namespace of its own, so it cannot reach the worker's
    # services (database, redis, nats) or the internet.
    assert argv[argv.index("--net") + 1] == f"--network={sandbox.LOOPBACK_NETWORK}"
    assert argv[argv.index("--pwd") + 1] == sandbox.CONTAINER_WORK_DIR
    # Only the working directory and the scratch directory are writable, the
    # input files and the tool environment are mounted read-only.
    assert f"{dirs.work}:{sandbox.CONTAINER_WORK_DIR}" in argv
    assert f"{dirs.tmp}:{sandbox.CONTAINER_TMP_DIR}" in argv
    assert f"{dirs.inputs}:{sandbox.CONTAINER_INPUTS_DIR}:ro" in argv
    assert f"{location}:{sandbox.CONTAINER_INPUTS_DIR}/{location.name}:ro" in argv
    # The environment keeps its original path, so interpreters inside it resolve.
    assert f"{conda_prefix}:{conda_prefix}:ro" in argv
    # Reference data is mounted read-only at its own path.
    assert f"{data_path}:{data_path}:ro" in argv
    # The run only gets the CPUs the scheduler handed it.
    assert argv[argv.index("--cpus") + 1] == "4"
    assert argv[-4:] == [
        "/apptainer/runtime.sif",
        "/bin/bash",
        "-c",
        "samtools view sample.bam",
    ]


def test_sandbox_exec_command_without_conda_environment(tmp_path: Path) -> None:
    dirs = _dirs(tmp_path)

    argv = sandbox.sandbox_exec_command(
        image="/apptainer/runtime.sif",
        work_dir=dirs.work,
        tmp_dir=dirs.tmp,
        inputs_dir=dirs.inputs,
        input_files={},
        conda_prefix=None,
        data_path=None,
        cpus=2,
        network="internet",
        dns="9.9.9.9",
        command="echo hello",
    )

    assert not any(bind.startswith("/conda") for bind in argv)
    # Internet access still uses a namespace of its own, with the configured
    # resolver; scripts/sandbox_network_setup.sh drops private destinations.
    assert argv[argv.index("--net") + 1] == f"--network={sandbox.INTERNET_NETWORK}"
    assert argv[argv.index("--dns") + 1] == "9.9.9.9"


def test_sandbox_exec_command_with_host_network(tmp_path: Path) -> None:
    dirs = _dirs(tmp_path)

    argv = sandbox.sandbox_exec_command(
        image="/apptainer/runtime.sif",
        work_dir=dirs.work,
        tmp_dir=dirs.tmp,
        inputs_dir=dirs.inputs,
        input_files={},
        conda_prefix=None,
        data_path=None,
        cpus=1,
        network="host",
        dns="1.1.1.1",
        command="echo hello",
    )

    assert "--net" not in argv


def test_sandbox_exec_command_rejects_unknown_network(tmp_path: Path) -> None:
    dirs = _dirs(tmp_path)

    with pytest.raises(sandbox.SandboxError, match="Unknown sandbox network mode"):
        sandbox.sandbox_exec_command(
            image="/apptainer/runtime.sif",
            work_dir=dirs.work,
            tmp_dir=dirs.tmp,
            inputs_dir=dirs.inputs,
            input_files={},
            conda_prefix=None,
            data_path=None,
            cpus=1,
            network="bridge",
            dns="1.1.1.1",
            command="echo hello",
        )


def test_sandbox_data_path(monkeypatch, tmp_path: Path) -> None:
    # A worker without the reference data directory simply gets no bind mount.
    monkeypatch.setattr(settings, "SANDBOX_DATA_PATH", str(tmp_path / "missing"))
    assert sandbox_data_path() is None

    data = tmp_path / "DB"
    data.mkdir()
    monkeypatch.setattr(settings, "SANDBOX_DATA_PATH", str(data))
    assert sandbox_data_path() == data


def test_check_sandbox_limits(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(sandbox, "CGROUPS_READY_FILE", str(tmp_path / "missing"))

    with pytest.raises(sandbox.SandboxError, match="limit runs to their CPUs"):
        sandbox.check_sandbox_limits()

    ready = tmp_path / "ready"
    ready.touch()
    monkeypatch.setattr(sandbox, "CGROUPS_READY_FILE", str(ready))
    sandbox.check_sandbox_limits()


def test_check_sandbox_network(monkeypatch, tmp_path: Path) -> None:
    ready = tmp_path / "ready"
    monkeypatch.setattr(sandbox, "NETWORK_READY_FILE", str(ready))

    # Modes that do not need the worker's rules are always fine.
    sandbox.check_sandbox_network("none")
    sandbox.check_sandbox_network("host")
    with pytest.raises(sandbox.SandboxError, match="internet"):
        sandbox.check_sandbox_network("internet")

    ready.touch()
    sandbox.check_sandbox_network("internet")


def test_check_sandbox_image(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(sandbox.shutil, "which", lambda name: f"/usr/bin/{name}")

    with pytest.raises(sandbox.SandboxError, match="was not found"):
        sandbox.check_sandbox_image(str(tmp_path / "missing.sif"))

    image = tmp_path / "runtime.sif"
    image.touch()
    sandbox.check_sandbox_image(str(image))
    # Remote images are resolved by apptainer itself.
    sandbox.check_sandbox_image("docker://debian:trixie-slim")


def test_check_sandbox_image_without_apptainer(monkeypatch) -> None:
    monkeypatch.setattr(sandbox.shutil, "which", lambda name: None)

    with pytest.raises(sandbox.SandboxError, match="'apptainer' was not found"):
        sandbox.check_sandbox_image("docker://debian:trixie-slim")


def test_conda_activation_applies_the_environment() -> None:
    snippet = sandbox.conda_activation(Path("/conda") / "abc")

    assert "export CONDA_PREFIX=/conda/abc;" in snippet
    assert "export PATH=/conda/abc/bin:$PATH;" in snippet
    assert '"$CONDA_PREFIX"/etc/conda/activate.d/*.sh' in snippet


def test_build_run_argv_uses_a_sandbox(monkeypatch, tmp_path: Path) -> None:
    dirs = _dirs(tmp_path)
    image = tmp_path / "runtime.sif"
    image.touch()
    monkeypatch.setattr(sandbox.shutil, "which", lambda name: f"/usr/bin/{name}")
    monkeypatch.setattr(settings, "SANDBOX_ENABLED", True)
    monkeypatch.setattr(settings, "SANDBOX_IMAGE", str(image))
    monkeypatch.setattr(settings, "SANDBOX_NETWORK", "none")
    cgroups_ready = tmp_path / "cgroups-ready"
    cgroups_ready.touch()
    monkeypatch.setattr(sandbox, "CGROUPS_READY_FILE", str(cgroups_ready))

    argv = build_run_argv(
        command="echo hello",
        conda_prefix=None,
        dirs=dirs,
        input_files={},
        cpus=1,
    )

    assert argv[0] == "apptainer"
    assert argv[-1] == "set -euo pipefail; echo hello"
    assert argv[argv.index("--net") + 1] == f"--network={sandbox.LOOPBACK_NETWORK}"


def test_build_run_argv_with_sandbox_network(monkeypatch, tmp_path: Path) -> None:
    dirs = _dirs(tmp_path)
    image = tmp_path / "runtime.sif"
    image.touch()
    monkeypatch.setattr(sandbox.shutil, "which", lambda name: f"/usr/bin/{name}")
    monkeypatch.setattr(settings, "SANDBOX_ENABLED", True)
    monkeypatch.setattr(settings, "SANDBOX_IMAGE", str(image))
    monkeypatch.setattr(settings, "SANDBOX_NETWORK", "internet")
    monkeypatch.setattr(settings, "SANDBOX_DNS", "9.9.9.9")
    ready = tmp_path / "ready"
    ready.touch()
    monkeypatch.setattr(sandbox, "NETWORK_READY_FILE", str(ready))
    cgroups_ready = tmp_path / "cgroups-ready"
    cgroups_ready.touch()
    monkeypatch.setattr(sandbox, "CGROUPS_READY_FILE", str(cgroups_ready))

    argv = build_run_argv(
        command="echo hello",
        conda_prefix=None,
        dirs=dirs,
        input_files={},
        cpus=1,
    )

    assert argv[argv.index("--net") + 1] == f"--network={sandbox.INTERNET_NETWORK}"
    assert argv[argv.index("--dns") + 1] == "9.9.9.9"


def test_build_run_argv_without_sandbox(monkeypatch, tmp_path: Path) -> None:
    dirs = _dirs(tmp_path)
    monkeypatch.setattr(settings, "SANDBOX_ENABLED", False)

    argv = build_run_argv(
        command="echo hello",
        conda_prefix=None,
        dirs=dirs,
        input_files={},
        cpus=1,
    )

    assert argv == ["/bin/bash", "-c", "set -euo pipefail; echo hello"]


def test_link_input_files_mounts_read_only(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(settings, "SANDBOX_ENABLED", True)
    dirs = _dirs(tmp_path)
    file_id, location = _input_file(tmp_path, "sample.bam")
    session = _StubSession({file_id: location})
    run = SimpleNamespace(input_file_ids=[file_id])

    input_files = link_input_files(session, run, dirs)

    assert input_files == {location.name: location}
    # The working directory links to the file inside the container, and the
    # bind mount target exists so that apptainer can mount over it.
    assert (dirs.work / location.name).is_symlink()
    assert (dirs.work / location.name).readlink() == Path(
        sandbox.CONTAINER_INPUTS_DIR
    ) / location.name
    assert (dirs.inputs / location.name).stat().st_size == 0
    assert not (dirs.work / location.name).exists()  # dangling on the worker


def test_link_input_files_without_sandbox(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(settings, "SANDBOX_ENABLED", False)
    dirs = _dirs(tmp_path)
    file_id, location = _input_file(tmp_path, "sample.bam")
    session = _StubSession({file_id: location})
    run = SimpleNamespace(input_file_ids=[file_id])

    link_input_files(session, run, dirs)

    assert (dirs.work / location.name).readlink() == location
    assert (dirs.work / location.name).read_text() == "input data"
    assert not list(dirs.inputs.iterdir())


def test_process_targets_ignores_input_files(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(settings, "SANDBOX_ENABLED", True)
    dirs = _dirs(tmp_path)
    file_id, location = _input_file(tmp_path, "sample.bam")
    session = _StubSession({file_id: location})
    run = SimpleNamespace(
        id=file_id,
        input_file_ids=[file_id],
        params={},
        tags=[],
        files=[],
        stdout="",
        email_on_completion=False,
        tool=SimpleNamespace(
            targets=[{"path": "*.bam", "target_type": "bam", "required": True}]
        ),
    )
    link_input_files(session, run, dirs)

    # A pattern matching an input file must not save that input as a target,
    # which is what makes the read-only input mounts safe.
    assert process_targets(session, run, dirs.work) is False
    assert run.files == []
    assert "No files matched pattern '*.bam'" in run.stdout
