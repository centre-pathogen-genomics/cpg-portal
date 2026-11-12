import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import Tool, ToolStatus

ARCH = "linux-arm64"
SHA = "a" * 64
APP_BYTES = b"PK\x05\x06" + b"\x00" * 18


def _tool_name(prefix: str) -> str:
    # The suite reuses one database across runs, so a fixed name would collide
    # with the previous run's tool.
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def _artifacts(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    apps = tmp_path / "apps"
    apps.mkdir()
    (apps / "mac-arm64.zip").write_bytes(APP_BYTES)
    runtime = tmp_path / "runtime"
    runtime.mkdir()
    (runtime / f"{ARCH}.tar").write_bytes(b"image")
    (runtime / f"{ARCH}.tar.sha256").write_text(SHA + "\n")
    monkeypatch.setattr(settings, "RUNNER_ARTIFACTS_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "RUNNER_PUBLIC_BASE_URL", "")
    return tmp_path


def _create_tool(*, db: Session, name: str, conda_env: dict | None) -> Tool:
    tool = Tool(
        name=name,
        version="1.2",
        is_default=True,
        command="printf 'hi\\n' > out.txt",
        conda_env=conda_env,
        params=[
            {"name": "message", "param_type": "str", "default": "hi"},
            {"name": "threads", "param_type": "int", "default": 1},
        ],
        targets=[{"path": "out.txt", "target_type": "text", "required": True}],
        enabled=True,
        status=ToolStatus.installed,
    )
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return tool


def _pack(
    client: TestClient,
    *,
    headers: dict[str, str],
    name: str,
    platform: str = "mac-arm64",
    version: str | None = None,
):
    query = f"platform={platform}"
    if version is not None:
        query += f"&version={version}"
    return client.get(f"/api/v1/tools/name/{name}/runner-pack?{query}", headers=headers)


def _conda_env() -> dict:
    return {"channels": ["conda-forge"], "dependencies": ["python=3.11"]}


def test_app_is_served_byte_for_byte_and_cached(
    client: TestClient, _artifacts: Path
) -> None:
    response = client.get("/api/v1/runner/app/mac-arm64")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert response.content == APP_BYTES
    # A rebuilt app must reach the visitor: revalidate rather than pin.
    assert response.headers["cache-control"] == "public, no-cache"
    assert "cpg-runner-mac-arm64.zip" in response.headers["content-disposition"]

    etag = response.headers["etag"]
    assert etag

    revalidated = client.get(
        "/api/v1/runner/app/mac-arm64", headers={"If-None-Match": etag}
    )
    assert revalidated.status_code == 304
    assert revalidated.content == b""

    # A URL pinned to a build may be cached for good.
    build = etag.strip('"')
    pinned = client.get(f"/api/v1/runner/app/mac-arm64?v={build}")
    assert pinned.status_code == 200
    assert pinned.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_app_answers_head_with_its_build(client: TestClient, _artifacts: Path) -> None:
    """The dialog learns which build to link to with HEAD, and nothing else."""
    response = client.head("/api/v1/runner/app/mac-arm64")

    assert response.status_code == 200
    assert response.headers["etag"]
    assert response.content == b""
    assert response.headers["cache-control"] == "public, no-cache"


def test_app_without_a_build_is_404(client: TestClient, _artifacts: Path) -> None:
    response = client.get("/api/v1/runner/app/win-x64")

    assert response.status_code == 404
    assert response.json()["detail"] == "App not available for win-x64"


def test_pack_holds_configuration_only(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    _artifacts: Path,
) -> None:
    tool = _create_tool(db=db, name=_tool_name("packonly"), conda_env=_conda_env())

    response = _pack(client, headers=superuser_token_headers, name=tool.name)

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/json"
    assert f"{tool.name}-1.2.cpgpack" in response.headers["content-disposition"]
    pack = response.json()
    assert set(pack) == {
        "schema_version",
        "tool",
        "runner",
        "environment_yml",
        "readme",
    }
    tool_config = pack["tool"]
    runner_config = pack["runner"]
    environment = pack["environment_yml"]
    readme = pack["readme"]

    # A pack is configuration: it never carries the application itself.
    assert len(response.content) < 20_000

    assert tool_config["schema_version"] == 1
    assert tool_config["tool"]["id"] == str(tool.id)
    assert tool_config["tool"]["name"] == tool.name
    assert tool_config["tool"]["version"] == "1.2"
    assert tool_config["tool"]["command"] == "printf 'hi\\n' > out.txt"
    assert tool_config["tool"]["targets"][0]["path"] == "out.txt"
    assert tool_config["tool"]["setup_files"] == []
    assert tool_config["tool"]["post_install"] is None
    assert tool_config["tool"]["min_cpus"] == 1

    assert runner_config["platform"] == "mac-arm64"
    assert runner_config["docker_arch"] == ARCH
    assert runner_config["tool_name"] == tool.name
    assert runner_config["runtime_image"]["tag"] == settings.RUNNER_RUNTIME_TAG
    assert runner_config["runtime_image"]["sha256"] == SHA
    assert runner_config["runtime_image"]["url"].endswith(
        f"/api/v1/runner/runtime-image/{ARCH}"
    )

    assert "python=3.11" in environment
    assert "CPG Runner pack" in readme


def test_pack_without_a_conda_environment(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    _artifacts: Path,
) -> None:
    tool = _create_tool(db=db, name=_tool_name("nopackenv"), conda_env=None)

    response = _pack(client, headers=superuser_token_headers, name=tool.name)

    assert response.status_code == 200, response.text
    assert response.json()["environment_yml"] is None


def test_pack_uses_the_configured_public_base_url(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    _artifacts: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        settings, "RUNNER_PUBLIC_BASE_URL", "https://portal.example.org/"
    )
    tool = _create_tool(db=db, name=_tool_name("packurl"), conda_env=None)

    response = _pack(client, headers=superuser_token_headers, name=tool.name)

    assert response.status_code == 200, response.text
    runner_config = response.json()["runner"]
    assert (
        runner_config["runtime_image"]["url"]
        == f"https://portal.example.org/api/v1/runner/runtime-image/{ARCH}"
    )


def test_pack_rejects_an_unknown_platform(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    _artifacts: Path,
) -> None:
    response = _pack(client, headers=superuser_token_headers, name="x", platform="nope")

    assert response.status_code == 400
    assert response.json()["detail"] == "Unknown platform: nope"


def test_pack_reports_an_unconfigured_runtime(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
    _artifacts: Path,
) -> None:
    (_artifacts / "runtime" / f"{ARCH}.tar.sha256").unlink()
    tool = _create_tool(db=db, name=_tool_name("packsha"), conda_env=None)

    response = _pack(client, headers=superuser_token_headers, name=tool.name)

    assert response.status_code == 503
    assert response.json()["detail"] == "Runner artifacts are not configured"


def test_pack_is_available_to_anonymous_visitors(
    client: TestClient,
    db: Session,
    _artifacts: Path,
) -> None:
    """The app has no portal session: the pack is public like the app itself.

    The portal only hides the feature (`runner:download`) from its own UI.
    """
    tool = _create_tool(db=db, name=_tool_name("packauth"), conda_env=None)

    response = _pack(client, headers={}, name=tool.name)

    assert response.status_code == 200, response.text


def test_pack_of_an_unknown_tool_is_404(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    _artifacts: Path,
) -> None:
    response = _pack(client, headers=superuser_token_headers, name="no-such-tool")

    assert response.status_code == 404
    assert response.json()["detail"] == "Tool not found"


def test_runtime_image_is_served(
    client: TestClient,
    _artifacts: Path,
) -> None:
    response = client.get(f"/api/v1/runner/runtime-image/{ARCH}")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/x-tar"
    assert response.content == b"image"


def test_runtime_image_rejects_an_unknown_arch(
    client: TestClient,
    _artifacts: Path,
) -> None:
    response = client.get("/api/v1/runner/runtime-image/linux-riscv64")

    assert response.status_code == 404
    assert response.json()["detail"] == "Runtime image not available for linux-riscv64"
