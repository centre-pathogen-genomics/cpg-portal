from cpg_runner.runs import RunManager
from cpg_runner.state import StateStore
from support import FakeDocker, make_runner, make_tool


def test_interrupted_runs_become_failed_and_are_removed(tmp_path):
    tool = make_tool()
    store = StateStore(
        tmp_path / "data",
        tool_name=tool.name,
        documents_dir=tmp_path / "documents",
        default_cpus=1,
    )
    store.ensure_dirs()
    store.write_run(
        {
            "id": "old-run",
            "status": "running",
            "params": {},
            "cpus": 1,
            "command": "printf hi",
            "created_at": "2026-01-01T00:00:00+00:00",
            "started_at": "2026-01-01T00:00:01+00:00",
            "finished_at": None,
            "exit_code": None,
            "stdout": "partial\n",
            "error": None,
            "output_dir": None,
            "files": [],
        }
    )
    docker = FakeDocker()
    manager = RunManager(
        tool=tool,
        runner=make_runner(),
        docker=docker,
        store=store,
        resources_dir=tmp_path / "resources",
    )
    record = manager.get("old-run")
    assert record.status == "failed"
    assert record.error == "Runner was closed before the run finished"
    assert record.finished_at is not None
    assert "cpg-runner-run-old-run" in docker.removed
    assert store.read_run("old-run")["status"] == "failed"
