from cpg_runner.config import load_resources
from cpg_runner.runs import RunManager
from cpg_runner.state import StateStore
from support import FakeDocker, make_runner, make_tool


def test_pack_network_seeds_the_run_setting_once(tmp_path):
    """The tool's network policy sets the per-run default, once."""
    store = StateStore(
        tmp_path / "data",
        tool_name="my tool",
        documents_dir=tmp_path / "documents",
        default_cpus=1,
    )
    store.ensure_dirs()
    assert store.load_settings().network is True

    store.apply_network_default("none")
    assert store.load_settings().network is False

    # A repack cannot flip a choice the owner has already made.
    store.apply_network_default("internet")
    assert store.load_settings().network is False


def test_pack_network_default_keeps_the_apps_choice(tmp_path):
    store = StateStore(
        tmp_path / "data",
        tool_name="my tool",
        documents_dir=tmp_path / "documents",
        default_cpus=1,
    )
    store.ensure_dirs()

    store.apply_network_default("default")

    assert store.load_settings().network is True


def test_runner_config_parses_the_network_field(tmp_path):
    runner = make_runner(network="internet")
    resources_dir = tmp_path / "resources"
    resources_dir.mkdir()
    (resources_dir / "tool.json").write_text(make_tool().model_dump_json())
    (resources_dir / "runner.json").write_text(runner.model_dump_json())

    resources = load_resources(resources_dir)

    assert resources.runner.network == "internet"


def test_runner_config_defaults_network_for_old_packs(tmp_path):
    # A pack from before the field existed has no "network" key.
    resources_dir = tmp_path / "resources"
    resources_dir.mkdir()
    (resources_dir / "tool.json").write_text(make_tool().model_dump_json())
    (resources_dir / "runner.json").write_text(
        make_runner().model_dump_json(exclude={"network"})
    )

    resources = load_resources(resources_dir)

    assert resources.runner.network == "default"


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
