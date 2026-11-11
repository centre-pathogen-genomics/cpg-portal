import os
from datetime import datetime, timezone
from pathlib import Path

from cpg_runner import runs as runs_module
from cpg_runner.runs import RunManager, TERMINAL_STATUSES
from cpg_runner.state import StateStore
from support import BlockingDocker, WritingDocker, make_runner, make_tool, wait_for


def _store(tmp_path, tool):
    store = StateStore(
        tmp_path / "data",
        tool_name=tool.name,
        documents_dir=tmp_path / "documents",
        default_cpus=1,
    )
    store.ensure_dirs()
    store.save_settings(store.default_settings())
    return store


def _manager(tmp_path, tool, docker):
    return RunManager(
        tool=tool,
        runner=make_runner(),
        docker=docker,
        store=_store(tmp_path, tool),
        resources_dir=tmp_path / "resources",
    )


def _work_root(record):
    """The work folder inside the run's own output folder."""
    return Path(record.output_dir) / ".cpg_work"


def _keep_work(manager):
    store = manager.store
    store.save_settings(
        store.load_settings().model_copy(update={"clean_work_dir": False})
    )


def test_completed_run_copies_outputs_and_streams_status(tmp_path):
    docker = WritingDocker()
    manager = _manager(tmp_path, make_tool(), docker)
    record = manager.start({}, 1)
    wait_for(lambda: manager.get(record.id).status in TERMINAL_STATUSES)

    record = manager.get(record.id)
    assert record.status == "completed"
    assert record.exit_code == 0
    assert "line one" in record.stdout
    assert record.command == "printf hi > out.txt"
    output = Path(record.output_dir)
    assert output.name.startswith("my_tool-")
    assert (output / "results" / "out.txt").read_text() == "hi"
    assert record.files[0].name == "out.txt"
    assert record.files[0].size == 2

    history, _ = manager.subscribe(record.id)
    statuses = [message["status"] for message in history if message["type"] == "status"]
    assert statuses[0] == "pending"
    assert "running" in statuses
    assert statuses[-1] == "completed"
    assert docker.run_args[0][:3] == ["docker", "run", "--rm"]


def test_required_target_missing_fails(tmp_path):
    docker = WritingDocker(write=False)
    manager = _manager(tmp_path, make_tool(), docker)
    record = manager.start({}, 1)
    wait_for(lambda: manager.get(record.id).status in TERMINAL_STATUSES)
    record = manager.get(record.id)
    assert record.status == "failed"
    assert record.error.startswith("Missing required target(s): out.txt")


def test_cancel_removes_container_and_marks_cancelled(tmp_path):
    docker = BlockingDocker()
    manager = _manager(tmp_path, make_tool(), docker)
    record = manager.start({}, 1)
    assert docker.started.wait(5)
    manager.cancel(record.id)
    assert manager.get(record.id).status == "cancelled"
    docker.release.set()
    wait_for(lambda: manager.get(record.id).finished_at is not None)
    assert manager.get(record.id).status == "cancelled"
    assert f"cpg-runner-run-{record.id}" in docker.removed


def test_output_folder_is_deduplicated(tmp_path, monkeypatch):
    monkeypatch.setattr(runs_module, "_timestamp", lambda: "20260101-000000")
    docker = WritingDocker()
    manager = _manager(tmp_path, make_tool(), docker)
    first = manager.start({}, 1)
    wait_for(lambda: manager.get(first.id).status in TERMINAL_STATUSES)
    second = manager.start({}, 1)
    wait_for(lambda: manager.get(second.id).status in TERMINAL_STATUSES)
    assert Path(manager.get(second.id).output_dir).name == ("my_tool-20260101-000000-2")


def test_input_files_are_mounted_and_linked_into_work(tmp_path):
    """The user's file is mounted where the tool reads it, not copied."""
    tool = make_tool(
        command="cat {{ seq }} > out.txt",
        params=[
            {
                "name": "seq",
                "param_type": "file",
                "allowed_file_types": ["fasta"],
            }
        ],
    )
    docker = WritingDocker()
    manager = _manager(tmp_path, tool, docker)
    _keep_work(manager)
    source = tmp_path / "input.fasta"
    source.write_text(">a\nACGT\n")
    record = manager.start({"seq": [str(source)]}, 1)
    wait_for(lambda: manager.get(record.id).status in TERMINAL_STATUSES)

    argv = docker.run_args[0]
    assert f"type=bind,source={source},target=/inputs/input.fasta,readonly" in argv

    run_dir = _work_root(record)
    # Nothing was copied next to the run: only the link the tool needs.
    assert not (run_dir / "inputs").exists()
    link = run_dir / "work" / "input.fasta"
    assert link.is_symlink()
    assert link.readlink() == Path("/inputs/input.fasta")
    assert source.read_text() == ">a\nACGT\n"
    assert manager.get(record.id).params["seq"] == "input.fasta"


def test_setup_files_are_rendered(tmp_path):
    tool = make_tool(
        command="true",
        params=[{"name": "x", "param_type": "str", "default": "value"}],
        setup_files=[{"name": "config.txt", "content": "x={{ x }}"}],
        targets=[],
    )
    manager = _manager(tmp_path, tool, WritingDocker())
    _keep_work(manager)
    record = manager.start({}, 1)
    wait_for(lambda: manager.get(record.id).status in TERMINAL_STATUSES)
    assert manager.get(record.id).status == "completed"
    work = _work_root(record) / "work"
    assert (work / "config.txt").read_text() == "x=value"


def test_a_run_keeps_the_given_name_or_names_itself(tmp_path):
    manager = _manager(tmp_path, make_tool(), WritingDocker())

    named = manager.start({}, 1, name="  my run  ")
    assert named.name == "my run"

    unnamed = manager.start({}, 1)
    # Named after the tool and the day, numbered after the runs before it.
    assert unnamed.name == f"my tool-{datetime.now(timezone.utc):%Y%m%d}-002"


def test_a_local_run_may_use_more_cpus_than_the_tool_allows(tmp_path):
    """The tool's maximum is the portal's limit, not this computer's."""
    manager = _manager(tmp_path, make_tool(max_cpus=2), WritingDocker())
    record = manager.start({}, 8)
    assert record.cpus == 8
    wait_for(lambda: manager.get(record.id).status in TERMINAL_STATUSES)


def test_a_run_still_gets_the_tools_minimum(tmp_path):
    manager = _manager(tmp_path, make_tool(min_cpus=4), WritingDocker())
    record = manager.start({}, 1)
    assert record.cpus == 4
    wait_for(lambda: manager.get(record.id).status in TERMINAL_STATUSES)


def test_a_run_works_in_the_output_folder_and_cleans_up_afterwards(tmp_path):
    docker = WritingDocker()
    manager = _manager(tmp_path, make_tool(), docker)
    record = manager.start({}, 1)
    wait_for(lambda: manager.get(record.id).status in TERMINAL_STATUSES)

    work_mount = next(
        arg for arg in docker.run_args[0] if arg.endswith(",target=/work")
    )
    work_dir = Path(work_mount.split("source=", 1)[1].split(",", 1)[0])
    assert work_dir == _work_root(record) / "work"

    finished = manager.get(record.id)
    assert finished.status == "completed"
    assert finished.work_dir is None
    # The results and the report stay; the work folder goes with the run.
    output = Path(finished.output_dir)
    assert (output / "results" / "out.txt").read_text() == "hi"
    assert (output / "README.md").is_file()
    assert not (output / ".cpg_work").exists()


def test_the_work_folder_can_be_kept(tmp_path):
    manager = _manager(tmp_path, make_tool(), WritingDocker())
    _keep_work(manager)
    record = manager.start({}, 1)
    wait_for(lambda: manager.get(record.id).status in TERMINAL_STATUSES)

    finished = manager.get(record.id)
    assert finished.work_dir == str(_work_root(record))
    assert (Path(finished.work_dir) / "work" / "out.txt").read_text() == "hi"
    assert (Path(finished.output_dir) / "results" / "out.txt").is_file()


def test_outputs_come_with_their_provenance(tmp_path):
    resources = tmp_path / "resources"
    resources.mkdir()
    (resources / "environment.yml").write_text("channels: [conda-forge]\n")
    tool = make_tool(
        post_install="conda install -y fastqc",
        explanation_of_results_markdown="## What you get\n\nOne row per gene.",
    )
    manager = RunManager(
        tool=tool,
        runner=make_runner(),
        docker=WritingDocker(),
        store=_store(tmp_path, tool),
        resources_dir=resources,
    )
    record = manager.start({}, 1)
    wait_for(lambda: manager.get(record.id).status in TERMINAL_STATUSES)
    record = manager.get(record.id)
    assert record.status == "completed"

    output = Path(record.output_dir)
    readme = (output / "README.md").read_text()
    assert readme.startswith("# my tool")
    assert f"Run `{record.name}`" in readme
    assert "One row per gene." in readme
    assert "`results/out.txt`" in readme
    assert (output / "log.txt").read_text() == record.stdout
    assert (output / "environment.yml").read_text() == "channels: [conda-forge]\n"

    install = output / "install.sh"
    script = install.read_text()
    assert script.startswith("#!/usr/bin/env bash")
    assert "env create --yes --file environment.yml --prefix ./env" in script
    assert "conda install -y fastqc" in script
    assert os.access(install, os.X_OK)

    command = output / "command.sh"
    assert command.read_text().splitlines()[0] == "#!/usr/bin/env bash"
    assert 'export PATH="$PWD/env/bin:$PATH"' in command.read_text()
    assert "printf hi > out.txt" in command.read_text()
    # The container's own activation would not resolve here.
    assert "/conda/" not in command.read_text()
    assert os.access(command, os.X_OK)
    # The post-install step lives in install.sh, not in a second script.
    assert not (output / "post_install.sh").exists()

    assert "## Reproducing this run" in readme
    assert "./install.sh" in readme
    assert "./command.sh" in readme
    assert "`install.sh`" in readme


def test_a_tool_without_environment_or_post_install_saves_what_it_has(tmp_path):
    manager = _manager(tmp_path, make_tool(), WritingDocker())
    record = manager.start({}, 1)
    wait_for(lambda: manager.get(record.id).status in TERMINAL_STATUSES)

    readme = (Path(manager.get(record.id).output_dir) / "README.md").read_text()
    assert "does not describe its results" in readme
    output = Path(manager.get(record.id).output_dir)
    assert not (output / "environment.yml").exists()
    assert not (output / "install.sh").exists()
    assert (output / "log.txt").is_file()
    assert "## Reproducing this run" in readme
    assert "./command.sh" in readme
    assert "runtime image" in readme


def test_a_failed_run_still_reports_itself(tmp_path):
    manager = _manager(tmp_path, make_tool(), WritingDocker(write=False))
    record = manager.start({}, 1)
    wait_for(lambda: manager.get(record.id).status in TERMINAL_STATUSES)

    failed = manager.get(record.id)
    assert failed.status == "failed"
    output = Path(failed.output_dir)
    readme = (output / "README.md").read_text()
    assert "## Failure" in readme
    assert "Missing required target(s): out.txt" in readme
    assert (output / "log.txt").is_file()
    assert (output / "command.sh").is_file()
    assert not (output / ".cpg_work").exists()
