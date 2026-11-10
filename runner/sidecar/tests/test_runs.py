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
    assert (output / "out.txt").read_text() == "hi"
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


def test_input_files_are_copied_and_linked_into_work(tmp_path):
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
    manager = _manager(tmp_path, tool, WritingDocker())
    source = tmp_path / "input.fasta"
    source.write_text(">a\nACGT\n")
    record = manager.start({"seq": [str(source)]}, 1)
    wait_for(lambda: manager.get(record.id).status in TERMINAL_STATUSES)
    run_dir = tmp_path / "data" / "runs" / record.id
    assert (run_dir / "inputs" / "input.fasta").read_text() == ">a\nACGT\n"
    link = run_dir / "work" / "input.fasta"
    assert link.is_symlink()
    assert link.readlink() == Path("/inputs/input.fasta")
    assert manager.get(record.id).params["seq"] == "input.fasta"


def test_setup_files_are_rendered(tmp_path):
    tool = make_tool(
        command="true",
        params=[{"name": "x", "param_type": "str", "default": "value"}],
        setup_files=[{"name": "config.txt", "content": "x={{ x }}"}],
        targets=[],
    )
    manager = _manager(tmp_path, tool, WritingDocker())
    record = manager.start({}, 1)
    wait_for(lambda: manager.get(record.id).status in TERMINAL_STATUSES)
    assert manager.get(record.id).status == "completed"
    work = tmp_path / "data" / "runs" / record.id / "work"
    assert (work / "config.txt").read_text() == "x=value"
