"""Pure builders for the ``docker run`` commands the sidecar issues."""

from collections.abc import Sequence
from pathlib import Path

CONDA_VOLUME_PREFIX = "cpg-runner-conda-"
# conda downloads every package into this cache; sharing it between tools means
# the second environment reuses the first one's downloads.
CONDA_PKGS_VOLUME = "cpg-runner-conda-pkgs"


def conda_volume_name(tool_id: str) -> str:
    return f"{CONDA_VOLUME_PREFIX}{tool_id}"


def run_container_name(run_id: str) -> str:
    return f"cpg-runner-run-{run_id}"


def install_container_name(tool_id: str) -> str:
    return f"cpg-runner-install-{tool_id}"


def build_run_args(
    *,
    docker_bin: str,
    run_id: str,
    cpus: int,
    network: bool,
    work_dir: str | Path,
    tmp_dir: str | Path,
    image_tag: str,
    shell_command: str,
    tool_id: str | None = None,
    input_files: Sequence[tuple[str, str]] = (),
) -> list[str]:
    """The argv for one run.

    ``input_files`` are the chosen files as (host path, name the tool sees),
    each mounted read-only under that name in the work directory: the file
    the user picked, never a copy of it.
    """
    args = [
        docker_bin,
        "run",
        "--rm",
        "--name",
        run_container_name(run_id),
        "--cpus",
        str(cpus),
        "--network",
        "bridge" if network else "none",
        "--mount",
        f"type=bind,source={work_dir},target=/work",
        "--mount",
        f"type=bind,source={tmp_dir},target=/tmp",
    ]
    for source, name in input_files:
        args += [
            "--mount",
            f"type=bind,source={source},target=/work/{name},readonly",
        ]
    if tool_id is not None:
        args += [
            "--mount",
            (
                f"type=volume,source={conda_volume_name(tool_id)},"
                f"target=/conda/{tool_id},readonly"
            ),
        ]
    args += [
        "-e",
        "PYTHONUNBUFFERED=1",
        "--workdir",
        "/work",
        image_tag,
        "/bin/bash",
        "-c",
        shell_command,
    ]
    return args


def build_env_create_args(
    *,
    docker_bin: str,
    tool_id: str,
    image_tag: str,
    environment_yml: str | Path,
) -> tuple[list[str], str]:
    target = f"/conda/{tool_id}"
    command = (
        "set -euo pipefail; "
        f"mamba env create --yes -f /tmp/environment.yml -p {target}"
    )
    args = [
        docker_bin,
        "run",
        "--rm",
        "--name",
        install_container_name(tool_id),
        "--mount",
        f"type=bind,source={environment_yml},target=/tmp/environment.yml,readonly",
        "--mount",
        f"type=volume,source={conda_volume_name(tool_id)},target={target}",
        "--mount",
        f"type=volume,source={CONDA_PKGS_VOLUME},target=/opt/conda/pkgs",
        "-e",
        "PYTHONUNBUFFERED=1",
        image_tag,
        "/bin/bash",
        "-lc",
        command,
    ]
    return args, command


def build_post_install_args(
    *,
    docker_bin: str,
    tool_id: str,
    image_tag: str,
    post_install: str,
) -> tuple[list[str], str]:
    target = f"/conda/{tool_id}"
    command = (
        f"set -euo pipefail; source /opt/conda/bin/activate {target}; {post_install}"
    )
    args = [
        docker_bin,
        "run",
        "--rm",
        "--name",
        install_container_name(tool_id),
        "--mount",
        f"type=volume,source={conda_volume_name(tool_id)},target={target}",
        "-e",
        "PYTHONUNBUFFERED=1",
        image_tag,
        "/bin/bash",
        "-lc",
        command,
    ]
    return args, command
