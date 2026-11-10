from cpg_runner.docker_args import build_run_args, conda_volume_name


def test_network_enabled_argv():
    args = build_run_args(
        docker_bin="docker",
        run_id="run-1",
        cpus=4,
        network=True,
        work_dir="/data/runs/run-1/work",
        tmp_dir="/data/runs/run-1/tmp",
        inputs_dir="/data/runs/run-1/inputs",
        image_tag="cpg-runner-runtime:1",
        shell_command="set -euo pipefail; echo hi",
    )
    assert args == [
        "docker",
        "run",
        "--rm",
        "--name",
        "cpg-runner-run-run-1",
        "--cpus",
        "4",
        "--network",
        "bridge",
        "--mount",
        "type=bind,source=/data/runs/run-1/work,target=/work",
        "--mount",
        "type=bind,source=/data/runs/run-1/tmp,target=/tmp",
        "--mount",
        "type=bind,source=/data/runs/run-1/inputs,target=/inputs,readonly",
        "--workdir",
        "/work",
        "cpg-runner-runtime:1",
        "/bin/bash",
        "-c",
        "set -euo pipefail; echo hi",
    ]


def test_network_disabled_and_environment_volume():
    args = build_run_args(
        docker_bin="docker",
        run_id="run-2",
        cpus=1,
        network=False,
        work_dir="/w",
        tmp_dir="/t",
        inputs_dir="/i",
        image_tag="runtime:1",
        shell_command="true",
        tool_id="tool-1",
    )
    assert "--network" in args
    assert args[args.index("--network") + 1] == "none"
    assert [
        "type=volume,source=cpg-runner-conda-tool-1,target=/conda/tool-1,readonly"
    ] == [arg for arg in args if arg.startswith("type=volume")]
    assert conda_volume_name("tool-1") == "cpg-runner-conda-tool-1"
    assert args[-4:] == ["runtime:1", "/bin/bash", "-c", "true"]


def test_paths_with_spaces_and_windows_style_path():
    args = build_run_args(
        docker_bin="docker",
        run_id="run-3",
        cpus=2,
        network=False,
        work_dir="/Users/Test User/CPG Runs/run 3/work",
        tmp_dir="/Users/Test User/CPG Runs/run 3/tmp",
        inputs_dir="/Users/Test User/CPG Runs/run 3/inputs",
        image_tag="runtime:1",
        shell_command="true",
    )
    assert "type=bind,source=/Users/Test User/CPG Runs/run 3/work,target=/work" in args
    assert "--mount" in args
    assert (
        args.count("type=bind,source=/Users/Test User/CPG Runs/run 3/tmp,target=/tmp")
        == 1
    )

    windows = build_run_args(
        docker_bin="docker",
        run_id="run-4",
        cpus=2,
        network=False,
        work_dir=r"C:\Users\Test User\CPG Runs\run 4\work",
        tmp_dir=r"C:\Users\Test User\CPG Runs\run 4\tmp",
        inputs_dir=r"C:\Users\Test User\CPG Runs\run 4\inputs",
        image_tag="runtime:1",
        shell_command="true",
    )
    assert (
        r"type=bind,source=C:\Users\Test User\CPG Runs\run 4\work,target=/work"
        in windows
    )
    # A Windows drive path is a single argv element, not split on the colon.
    assert any(
        arg
        == r"type=bind,source=C:\Users\Test User\CPG Runs\run 4\inputs,target=/inputs,readonly"
        for arg in windows
    )
