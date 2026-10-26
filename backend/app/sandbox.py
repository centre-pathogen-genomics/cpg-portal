"""Execute tool commands inside an Apptainer container.

Tool commands are arbitrary pipelines defined by tool authors and driven by user
parameters, so they are executed in a sandbox container that only sees what a
run legitimately needs:

* ``/work`` - the run's working directory, read-write, where targets are written.
* ``/tmp`` - the run's scratch directory, read-write, discarded with the run.
* ``/inputs`` - the run's input files, read-only, one bind mount per file.
* ``/conda/<tool_id>`` - the tool's conda environment, read-only.
* the reference data directory (``SANDBOX_DATA_PATH``, ``/DB`` by default) -
  read-only, at the same path it has on the worker.

The container root filesystem is read-only, ``--containall`` gives it private
mount/PID/IPC/UTS namespaces with a minimal ``/dev`` and a cleaned environment,
and ``--no-privs`` drops all capabilities from the container process. The
rest of the worker - its filesystem, ``/storage``, its environment with database
credentials, other tools' environments - is not visible from inside either way.

What the container can reach on the network is set by ``network``:

``none`` (default)
    Its own network namespace with a loopback interface only: no internet, no
    database, no redis, no nats.
``internet``
    A network namespace of its own, masqueraded out of the worker so it can
    download from the internet, with every private address dropped by
    ``scripts/sandbox_network_setup.sh``. Database, redis and nats stay out of
    reach. Requires the worker to apply those rules before it starts.
``host``
    The worker's network namespace, i.e. access to everything the worker can
    reach. Only useful for debugging a tool.
"""

import shlex
import shutil
from collections.abc import Mapping
from pathlib import Path

APPTAINER_BIN = "apptainer"

CONTAINER_WORK_DIR = "/work"
CONTAINER_TMP_DIR = "/tmp"
CONTAINER_INPUTS_DIR = "/inputs"

# CNI networks configured in the worker image, see container/*.conf.
LOOPBACK_NETWORK = "loopback"
INTERNET_NETWORK = "internet"

NETWORK_MODES = ("none", "internet", "host")

# Written by scripts/sandbox_setup.sh once the rules for the "internet" mode are
# in place, and checked here so a worker started without them cannot hand out a
# run that reaches the private networks.
NETWORK_READY_FILE = "/run/sandbox-network-ready"

# Same for the cgroup delegation that lets apptainer limit a run to its CPUs.
CGROUPS_READY_FILE = "/run/sandbox-cgroups-ready"


class SandboxError(Exception):
    """Raised when a run cannot be executed inside the sandbox."""


def conda_activation(conda_prefix: Path) -> str:
    """Shell snippet activating ``conda_prefix`` without conda being installed.

    The environment is mounted at the same path it has on the worker, so the
    interpreters, shebangs and hardcoded paths inside it keep working. Only
    ``CONDA_PREFIX``, ``PATH`` and the environment's own activation hooks have
    to be applied.
    """
    prefix = shlex.quote(str(conda_prefix))
    return (
        f"export CONDA_PREFIX={prefix}; "
        f"export PATH={prefix}/bin:$PATH; "
        'if [ -d "$CONDA_PREFIX/etc/conda/activate.d" ]; then '
        'for hook in "$CONDA_PREFIX"/etc/conda/activate.d/*.sh; do '
        'if [ -r "$hook" ]; then . "$hook"; fi; '
        "done; fi"
    )


def check_sandbox_image(image: str) -> None:
    """Raise :class:`SandboxError` if this worker cannot run the sandbox."""
    if shutil.which(APPTAINER_BIN) is None:
        raise SandboxError(
            f"'{APPTAINER_BIN}' was not found, it is required to run tools in a "
            "container"
        )
    if "://" not in image and not Path(image).exists():
        raise SandboxError(
            f"Sandbox image '{image}' was not found, build it with "
            "`scripts/build_sandbox_image.sh`"
        )


def check_sandbox_limits() -> None:
    """Raise :class:`SandboxError` if runs cannot be limited to their CPUs."""
    if not Path(CGROUPS_READY_FILE).exists():
        raise SandboxError(
            "This worker cannot limit runs to their CPUs, the cgroup rules are "
            "applied by `scripts/sandbox_setup.sh` when the worker starts"
        )


def check_sandbox_network(network: str) -> None:
    """Raise :class:`SandboxError` if ``network`` is not usable as requested."""
    if network != "internet":
        return
    if not Path(NETWORK_READY_FILE).exists():
        raise SandboxError(
            "Sandbox network mode 'internet' is not ready on this worker, the "
            "network rules are applied by `scripts/sandbox_network_setup.sh` "
            "when the worker starts"
        )


def sandbox_exec_command(
    *,
    image: str,
    work_dir: Path,
    tmp_dir: Path,
    inputs_dir: Path,
    input_files: Mapping[str, Path],
    conda_prefix: Path | None,
    data_path: Path | None,
    cpus: int,
    network: str,
    dns: str,
    command: str,
) -> list[str]:
    """Build the ``apptainer exec`` argv for a single run."""
    if network not in NETWORK_MODES:
        raise SandboxError(
            f"Unknown sandbox network mode '{network}', expected one of "
            f"{', '.join(NETWORK_MODES)}"
        )
    argv = [
        APPTAINER_BIN,
        "exec",
        "--containall",
        "--no-privs",
        # The run only gets the CPUs it reserved, the scheduler hands the rest
        # to other runs.
        "--cpus",
        str(cpus),
    ]
    if network == "none":
        argv += ["--net", f"--network={LOOPBACK_NETWORK}"]
    elif network == "internet":
        argv += ["--net", f"--network={INTERNET_NETWORK}", "--dns", dns]
    argv += [
        "--pwd",
        CONTAINER_WORK_DIR,
        "--bind",
        f"{work_dir}:{CONTAINER_WORK_DIR}",
        "--bind",
        f"{tmp_dir}:{CONTAINER_TMP_DIR}",
        "--bind",
        f"{inputs_dir}:{CONTAINER_INPUTS_DIR}:ro",
    ]
    for name, location in input_files.items():
        argv += ["--bind", f"{location}:{CONTAINER_INPUTS_DIR}/{name}:ro"]
    if conda_prefix is not None:
        argv += ["--bind", f"{conda_prefix}:{conda_prefix}:ro"]
    if data_path is not None:
        # Reference data keeps its path, so tool commands that refer to it work.
        argv += ["--bind", f"{data_path}:{data_path}:ro"]
    argv += [image, "/bin/bash", "-c", command]
    return argv
