import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import User, UserCreate
from tests.utils.user import user_authentication_headers
from tests.utils.utils import random_email, random_lower_string


def _create_user_headers(
    client: TestClient, db: Session
) -> tuple[User, dict[str, str]]:
    email = random_email()
    password = random_lower_string()
    user = crud.create_user(
        session=db, user_create=UserCreate(email=email, password=password)
    )
    return user, user_authentication_headers(
        client=client, email=email, password=password
    )


def test_me_lists_default_permissions(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/users/me", headers=normal_user_token_headers
    )
    assert response.status_code == 200
    permissions = response.json()["permissions"]
    # What the default role grants...
    assert "files:read" in permissions
    assert "runs:create" in permissions
    # ...and what it deliberately does not.
    assert "rbac:read" not in permissions
    assert "admin:pause_queue" not in permissions


def test_management_requires_permission(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/rbac/roles", headers=normal_user_token_headers
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Missing permission: rbac:read"

    response = client.post(
        f"{settings.API_V1_STR}/rbac/roles",
        headers=normal_user_token_headers,
        json={"name": f"role-{random_lower_string()}", "permissions": []},
    )
    assert response.status_code == 403


def test_permission_catalog_lists_enforced_permissions(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/rbac/permissions", headers=superuser_token_headers
    )
    assert response.status_code == 200
    permissions = {
        permission["name"]: permission["description"] for permission in response.json()
    }
    assert {"rbac:read", "rbac:create", "trakka:send", "files:delete"} <= set(
        permissions
    )
    # Static permissions keep their hand-written description...
    assert permissions["trakka:send"] == "Send Newick trees to Trakka"
    # ...while route permissions name each enforcing endpoint and its docstring.
    assert "read_files: Retrieve saved files." in permissions["files:read"]
    assert "read_file: Retrieve file metadata." in permissions["files:read"]
    # The UI shows only the first sentence of an entry until it is hovered, but
    # the whole docstring paragraph is in the catalog.
    assert "copy_file: Copy a file (or pair)" in permissions["files:create"]
    assert "- If the user already owns the file" in permissions["files:create"]


def test_role_grants_permission_and_delete_revokes_it(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
) -> None:
    user, headers = _create_user_headers(client, db)
    assert (
        client.get(f"{settings.API_V1_STR}/rbac/roles", headers=headers).status_code
        == 403
    )

    role_name = f"role-{random_lower_string()}"
    created = client.post(
        f"{settings.API_V1_STR}/rbac/roles",
        headers=superuser_token_headers,
        json={"name": role_name, "permissions": ["rbac:read"]},
    )
    assert created.status_code == 200
    role = created.json()
    assert role["permissions"] == ["rbac:read"]
    assert role["is_default"] is False

    access_url = f"{settings.API_V1_STR}/rbac/users/{user.id}/access"
    current = client.get(access_url, headers=superuser_token_headers).json()
    updated = client.put(
        access_url,
        headers=superuser_token_headers,
        json={
            "role_ids": [*current["role_ids"], role["id"]],
            "permissions": current["permissions"],
        },
    )
    assert updated.status_code == 200
    assert role["id"] in updated.json()["role_ids"]
    assert "rbac:read" in updated.json()["effective_permissions"]

    assert (
        client.get(f"{settings.API_V1_STR}/rbac/roles", headers=headers).status_code
        == 200
    )

    deleted = client.delete(
        f"{settings.API_V1_STR}/rbac/roles/{role['id']}",
        headers=superuser_token_headers,
    )
    assert deleted.status_code == 200
    # The assignment went with the role.
    assert (
        client.get(f"{settings.API_V1_STR}/rbac/roles", headers=headers).status_code
        == 403
    )
    assert client.get(access_url, headers=superuser_token_headers).json()[
        "role_ids"
    ] == [role_id for role_id in current["role_ids"] if role_id != role["id"]]


def test_direct_permission_grants_and_removal_revokes(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
) -> None:
    user, headers = _create_user_headers(client, db)
    access_url = f"{settings.API_V1_STR}/rbac/users/{user.id}/access"
    current = client.get(access_url, headers=superuser_token_headers).json()

    granted = client.put(
        access_url,
        headers=superuser_token_headers,
        json={"role_ids": current["role_ids"], "permissions": ["rbac:read"]},
    )
    assert granted.status_code == 200
    assert "rbac:read" in granted.json()["effective_permissions"]
    assert (
        client.get(f"{settings.API_V1_STR}/rbac/roles", headers=headers).status_code
        == 200
    )

    revoked = client.put(
        access_url,
        headers=superuser_token_headers,
        json={"role_ids": current["role_ids"], "permissions": []},
    )
    assert revoked.status_code == 200
    assert "rbac:read" not in revoked.json()["effective_permissions"]
    assert (
        client.get(f"{settings.API_V1_STR}/rbac/roles", headers=headers).status_code
        == 403
    )


def test_unknown_permission_and_role_are_rejected(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.post(
        f"{settings.API_V1_STR}/rbac/roles",
        headers=superuser_token_headers,
        json={"name": f"role-{random_lower_string()}", "permissions": ["nope:read"]},
    )
    assert response.status_code == 400
    assert "Unknown permission" in response.json()["detail"]

    response = client.post(
        f"{settings.API_V1_STR}/rbac/roles",
        headers=superuser_token_headers,
        json={"name": f"role-{random_lower_string()}", "permissions": []},
    )
    role_id = response.json()["id"]
    response = client.put(
        f"{settings.API_V1_STR}/rbac/users/{uuid.uuid4()}/access",
        headers=superuser_token_headers,
        json={"role_ids": [role_id], "permissions": []},
    )
    assert response.status_code == 404
    client.delete(
        f"{settings.API_V1_STR}/rbac/roles/{role_id}",
        headers=superuser_token_headers,
    )


def test_default_role_is_immutable(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    roles = client.get(
        f"{settings.API_V1_STR}/rbac/roles", headers=superuser_token_headers
    ).json()["data"]
    default_role = next(role for role in roles if role["is_default"])

    response = client.patch(
        f"{settings.API_V1_STR}/rbac/roles/{default_role['id']}",
        headers=superuser_token_headers,
        json={"description": "changed"},
    )
    assert response.status_code == 400

    response = client.delete(
        f"{settings.API_V1_STR}/rbac/roles/{default_role['id']}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 400


def test_duplicate_role_name_is_rejected(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    roles = client.get(
        f"{settings.API_V1_STR}/rbac/roles", headers=superuser_token_headers
    ).json()["data"]
    existing_name = roles[0]["name"]
    response = client.post(
        f"{settings.API_V1_STR}/rbac/roles",
        headers=superuser_token_headers,
        json={"name": existing_name, "permissions": []},
    )
    assert response.status_code == 409
