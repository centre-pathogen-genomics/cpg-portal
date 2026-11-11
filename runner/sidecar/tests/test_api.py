from fastapi.testclient import TestClient

from cpg_runner.api import create_app
from cpg_runner.state import StateStore
from support import (
    FakeDocker,
    FakeDoctor,
    FakeInstaller,
    FakeRunManager,
    make_runner,
    make_tool,
)

HEADERS = {"X-CPG-Token": "test"}
TOKEN = "test"


def _client(tmp_path, *, installer=None, doctor=None, environment_yml=None):
    tool = make_tool()
    installer = installer or FakeInstaller()
    store = StateStore(
        tmp_path / "data",
        tool_name=tool.name,
        documents_dir=tmp_path / "documents",
        default_cpus=1,
    )
    store.ensure_dirs()
    app = create_app(
        token=TOKEN,
        tool=tool,
        runner=make_runner(),
        docker=FakeDocker(),
        doctor=doctor or FakeDoctor(),
        installer=installer,
        runs=FakeRunManager(),
        store=store,
        environment_yml=environment_yml,
        ui_dir=None,
    )
    return TestClient(app), installer


def test_requests_need_the_token(tmp_path):
    client, _ = _client(tmp_path)
    assert client.get("/api/health").status_code == 401
    response = client.get("/api/health", headers=HEADERS)
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert (
        client.get("/api/doctor", headers={"X-CPG-Token": "wrong"}).status_code == 401
    )


def test_a_run_takes_its_name(tmp_path):
    client, _ = _client(tmp_path)
    response = client.post(
        "/api/runs", json={"params": {}, "cpus": 1, "name": "my run"}, headers=HEADERS
    )
    assert response.status_code == 201
    assert response.json()["name"] == "my run"


def test_install_state_transitions(tmp_path):
    client, installer = _client(tmp_path)
    status = client.get("/api/status", headers=HEADERS).json()
    assert status["installing"] is False
    assert status["image"]["present"] is True
    assert status["env"] == {"needed": False, "installed": True}

    response = client.post("/api/install", headers=HEADERS)
    assert response.status_code == 202
    assert response.json() == {"state": "installing"}
    assert client.get("/api/status", headers=HEADERS).json()["installing"] is True
    assert client.post("/api/install", headers=HEADERS).status_code == 409

    response = client.delete("/api/install", headers=HEADERS)
    assert response.status_code == 202
    assert response.json() == {"state": "not_installed"}
    assert client.get("/api/status", headers=HEADERS).json()["installing"] is False


def test_install_blocked_returns_the_doctor_report(tmp_path):
    installer = FakeInstaller()
    installer.blocked = {"ready": False, "blocking": "docker_cli"}
    client, _ = _client(tmp_path, installer=installer)
    response = client.post("/api/install", headers=HEADERS)
    assert response.status_code == 409
    body = response.json()
    assert body["detail"] == "Docker is not ready"
    assert body["doctor"]["ready"] is False


def test_run_creation_validation_and_creation(tmp_path):
    client, installer = _client(tmp_path)
    response = client.post(
        "/api/runs", headers=HEADERS, json={"params": {"x": "a"}, "cpus": 2}
    )
    assert response.status_code == 201
    run = response.json()
    assert run["cpus"] == 2
    assert run["created_at"]
    run_id = run["id"]

    response = client.post(
        "/api/runs", headers=HEADERS, json={"params": {"fail": True}, "cpus": 1}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Missing required parameter: x"

    installer.state = "image_missing"
    response = client.post("/api/runs", headers=HEADERS, json={"params": {}, "cpus": 1})
    assert response.status_code == 409
    assert "runtime image" in response.json()["detail"].lower()

    installer.state = "installed"
    response = client.get(f"/api/runs/{run_id}/files/0", headers=HEADERS)
    assert response.status_code == 404
    assert client.get("/api/runs/missing", headers=HEADERS).status_code == 404


def test_settings_are_validated_and_saved(tmp_path):
    client, _ = _client(tmp_path)
    response = client.put(
        "/api/settings",
        headers=HEADERS,
        json={"cpus": 0, "output_dir": "/tmp/out", "network": True},
    )
    assert response.status_code == 400
    response = client.put(
        "/api/settings",
        headers=HEADERS,
        json={"cpus": 2, "output_dir": "relative", "network": True},
    )
    assert response.status_code == 400
    response = client.put(
        "/api/settings",
        headers=HEADERS,
        json={"cpus": 2, "output_dir": "/tmp/out", "network": False},
    )
    assert response.status_code == 200
    assert response.json()["cpus"] == 2
    assert client.get("/api/settings", headers=HEADERS).json()["network"] is False


def test_tool_and_file_types(tmp_path):
    client, _ = _client(tmp_path)
    tool = client.get("/api/tool", headers=HEADERS).json()
    assert tool["name"] == "my tool"
    file_types = client.get("/api/file-types", headers=HEADERS).json()
    assert ".fasta" in file_types["fasta"]["extensions"]


def test_environment_is_the_packs_yaml(tmp_path):
    """The run page's Environment section shows what the pack installed."""
    yaml_text = "channels:\n- conda-forge\ndependencies:\n- python=3.11\n"
    client, _ = _client(tmp_path, environment_yml=yaml_text)

    response = client.get("/api/environment", headers=HEADERS)

    assert response.status_code == 200
    assert response.json() == {"yml": yaml_text}


def test_environment_is_absent_for_a_tool_without_one(tmp_path):
    client, _ = _client(tmp_path)

    assert client.get("/api/environment", headers=HEADERS).json() == {"yml": None}


def test_a_local_dev_origin_may_call_the_api(tmp_path):
    """Vite serves the UI in development; the sidecar answers its requests."""
    client, _ = _client(tmp_path)

    response = client.get(
        "/api/health",
        headers={**HEADERS, "Origin": "http://127.0.0.1:5174"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5174"
