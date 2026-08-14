from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import DEFAULT_LLM_MODEL


def test_read_app_settings(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/settings/",
        headers=superuser_token_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["llm_model"]


def test_update_app_settings(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.patch(
        f"{settings.API_V1_STR}/settings/",
        headers=superuser_token_headers,
        json={"llm_model": "gemini-test-model"},
    )

    assert response.status_code == 200
    assert response.json()["llm_model"] == "gemini-test-model"

    response = client.patch(
        f"{settings.API_V1_STR}/settings/",
        headers=superuser_token_headers,
        json={"llm_model": DEFAULT_LLM_MODEL},
    )

    assert response.status_code == 200
    assert response.json()["llm_model"] == DEFAULT_LLM_MODEL


def test_update_app_settings_requires_superuser(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    response = client.patch(
        f"{settings.API_V1_STR}/settings/",
        headers=normal_user_token_headers,
        json={"llm_model": "gemini-test-model"},
    )

    assert response.status_code == 403
