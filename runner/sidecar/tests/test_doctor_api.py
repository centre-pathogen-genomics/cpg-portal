import time

from fastapi.testclient import TestClient

from cpg_runner.api import create_app
from cpg_runner.state import StateStore
from support import (
    ActionDoctor,
    FakeDocker,
    FakeInstaller,
    FakeRunManager,
    make_runner,
    make_tool,
)

HEADERS = {"X-CPG-Token": "test"}
TOKEN = "test"


def _client(tmp_path, *, installer=None):
    tool = make_tool()
    installer = installer or FakeInstaller()
    store = StateStore(
        tmp_path / "data",
        tool_name=tool.name,
        documents_dir=tmp_path / "documents",
        default_cpus=1,
    )
    store.ensure_dirs()
    doctor = ActionDoctor()
    app = create_app(
        token=TOKEN,
        tool=tool,
        runner=make_runner(),
        docker=FakeDocker(),
        doctor=doctor,
        installer=installer,
        runs=FakeRunManager(),
        store=store,
    )
    return TestClient(app), doctor


def test_unknown_action_is_404(tmp_path):
    client, _ = _client(tmp_path)
    response = client.post("/api/doctor/actions/nope", headers=HEADERS)
    assert response.status_code == 404
    assert response.json()["detail"] == "Unknown action: nope"


def test_action_conflict_and_event_stream(tmp_path):
    client, doctor = _client(tmp_path)
    response = client.post("/api/doctor/actions/start-docker", headers=HEADERS)
    assert response.status_code == 202
    assert response.json() == {"action": "start-docker"}
    assert doctor.started.wait(5)
    assert (
        client.post("/api/doctor/actions/start-docker", headers=HEADERS).status_code
        == 409
    )
    doctor.release.set()
    deadline = time.monotonic() + 5
    while not doctor.ready and time.monotonic() < deadline:
        time.sleep(0.01)
    assert doctor.ready

    assert client.get("/api/doctor/events").status_code == 401
    response = client.get("/api/doctor/events?token=test")
    assert response.status_code == 200
    assert "data: line one" in response.text
    assert "data: line two" in response.text
    assert "event: done" in response.text
    assert '"ok": true' in response.text


def test_install_while_blocked_returns_doctor_payload(tmp_path):
    installer = FakeInstaller()
    installer.blocked = {"ready": False, "blocking": "wsl"}
    client, _ = _client(tmp_path, installer=installer)
    response = client.post("/api/install", headers=HEADERS)
    assert response.status_code == 409
    assert response.json()["doctor"]["blocking"] == "wsl"
