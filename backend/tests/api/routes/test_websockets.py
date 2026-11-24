from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi import WebSocketDisconnect
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core import security
from app.core.config import settings
from app.models import Run, RunStatus, Tool, User
from tests.utils.user import authentication_token_from_email
from tests.utils.utils import random_email, random_lower_string

WS_URL = f"{settings.API_V1_STR}/websockets"


def _make_user(
    client: TestClient, db: Session
) -> tuple[User, dict[str, str]]:
    """A real user with a working REST bearer token."""
    email = random_email()
    headers = authentication_token_from_email(
        client=client, email=email, db=db
    )
    user = crud.get_user_by_email(session=db, email=email)
    assert user is not None
    return user, headers


def _make_run(db: Session, owner: User) -> Run:
    tool = Tool(name=random_lower_string(), command="echo hi")
    db.add(tool)
    db.flush()
    run = Run(
        status=RunStatus.pending,
        created_at=datetime.now(UTC).replace(tzinfo=None),
        command="echo hi",
        params={},
        tool_id=tool.id,
        owner_id=owner.id,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _mint_ws_token(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post(f"{WS_URL}/token", headers=headers)
    assert response.status_code == 200
    token = response.json()["access_token"]
    payload = jwt.decode(
        token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
    )
    assert payload["purpose"] == "ws"
    return token


def test_logs_websocket_rejects_login_token(
    client: TestClient, db: Session
) -> None:
    """A REST login JWT in the socket URL is not accepted as WS auth."""
    user, headers = _make_user(client, db)
    run = _make_run(db, user)
    login_token = headers["Authorization"].split(" ", 1)[1]

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(
            f"{WS_URL}/logs/{run.id}?token={login_token}"
        ) as _:
            pass
    assert exc_info.value.code == 1008


def test_logs_websocket_works_with_minted_ws_token(
    client: TestClient, db: Session
) -> None:
    user, headers = _make_user(client, db)
    run = _make_run(db, user)
    ws_token = _mint_ws_token(client, headers)

    with client.websocket_connect(
        f"{WS_URL}/logs/{run.id}?token={ws_token}"
    ) as websocket:
        # The accept handshake succeeding is the point; nothing is published
        # on this channel, so just keep the loop alive briefly.
        websocket.send_text("ping")


def test_logs_websocket_rejects_expired_ws_token(
    client: TestClient, db: Session
) -> None:
    user, _ = _make_user(client, db)
    run = _make_run(db, user)
    expired = security.create_access_token(
        user.id,
        expires_delta=timedelta(seconds=-60),
        token_version=user.token_version,
        purpose="ws",
    )

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(
            f"{WS_URL}/logs/{run.id}?token={expired}"
        ) as _:
            pass
    assert exc_info.value.code == 1008


def test_logs_websocket_denies_other_owners_run(
    client: TestClient, db: Session
) -> None:
    """The ownership check stays: a valid WS token for another run is refused."""
    owner, _ = _make_user(client, db)
    _, other_headers = _make_user(client, db)
    run = _make_run(db, owner)
    ws_token = _mint_ws_token(client, other_headers)

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(
            f"{WS_URL}/logs/{run.id}?token={ws_token}"
        ) as _:
            pass
    assert exc_info.value.code == 1008


def test_stream_websocket_stays_anonymous(client: TestClient) -> None:
    with client.websocket_connect(f"{WS_URL}/stream") as websocket:
        websocket.send_text("ping")


def test_websocket_rejects_disallowed_origin(client: TestClient) -> None:
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(
            f"{WS_URL}/stream", headers={"origin": "http://evil.example"}
        ) as _:
            pass
    assert exc_info.value.code == 1008


def test_websocket_allows_configured_origin(client: TestClient) -> None:
    origin = settings.FRONTEND_HOST
    with client.websocket_connect(
        f"{WS_URL}/stream", headers={"origin": origin}
    ) as websocket:
        websocket.send_text("ping")
