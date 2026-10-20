"""
Tests for the single-use emailed tokens (activation / password reset) and for
session revocation via ``User.token_version``.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import jwt
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.core.security import ALGORITHM, create_access_token, verify_password
from app.models import AuthToken, AuthTokenPurpose, User, UserCreate
from tests.utils.user import user_authentication_headers
from tests.utils.utils import random_email, random_lower_string

API = settings.API_V1_STR


def _make_user(db: Session, *, is_active: bool = True) -> tuple[User, str]:
    password = random_lower_string()
    user = crud.create_user(
        session=db,
        user_create=UserCreate(
            email=random_email(), password=password, is_active=is_active
        ),
    )
    return user, password


def _tokens_for(db: Session, user: User) -> list[AuthToken]:
    db.expire_all()
    return list(db.exec(select(AuthToken).where(AuthToken.user_id == user.id)).all())


def _reset(client: TestClient, token: str, new_password: str = "newpassword123"):
    return client.post(
        f"{API}/reset-password/",
        json={"new_password": new_password, "token": token},
    )


# --------------------------------------------------------------------------- storage


def test_token_is_stored_hashed_only(db: Session) -> None:
    user, _ = _make_user(db)
    token = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.RESET
    )
    rows = _tokens_for(db, user)
    assert len(rows) == 1
    assert rows[0].token_hash != token
    assert rows[0].token_hash == crud._hash_auth_token(token)
    assert rows[0].purpose == AuthTokenPurpose.RESET.value


def test_consume_is_single_use(db: Session) -> None:
    user, _ = _make_user(db)
    token = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.RESET
    )
    first = crud.consume_auth_token(
        session=db, token=token, purpose=AuthTokenPurpose.RESET
    )
    db.commit()
    assert first is not None and first.id == user.id
    assert (
        crud.consume_auth_token(session=db, token=token, purpose=AuthTokenPurpose.RESET)
        is None
    )


def test_consume_wrong_purpose_does_not_spend_token(db: Session) -> None:
    user, _ = _make_user(db)
    token = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.RESET
    )
    assert (
        crud.consume_auth_token(
            session=db, token=token, purpose=AuthTokenPurpose.ACTIVATE
        )
        is None
    )
    db.commit()
    assert len(_tokens_for(db, user)) == 1


def test_consume_expired_token(db: Session) -> None:
    user, _ = _make_user(db)
    token = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.RESET
    )
    row = _tokens_for(db, user)[0]
    row.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=1)
    db.add(row)
    db.commit()
    assert (
        crud.consume_auth_token(session=db, token=token, purpose=AuthTokenPurpose.RESET)
        is None
    )


def test_creating_token_purges_users_expired_tokens(db: Session) -> None:
    user, _ = _make_user(db)
    crud.create_auth_token(session=db, user=user, purpose=AuthTokenPurpose.RESET)
    old = _tokens_for(db, user)[0]
    old.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1)
    db.add(old)
    db.commit()
    crud.create_auth_token(session=db, user=user, purpose=AuthTokenPurpose.RESET)
    assert len(_tokens_for(db, user)) == 1


# ------------------------------------------------------------------------ reset flow


def test_reset_password_token_is_single_use(client: TestClient, db: Session) -> None:
    user, _ = _make_user(db)
    token = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.RESET
    )
    first_password = random_lower_string()

    r = _reset(client, token, first_password)
    assert r.status_code == 200

    # replay, even with a different password, is rejected and changes nothing
    r = _reset(client, token, "attackerpassword1")
    assert r.status_code == 400
    assert r.json()["detail"] == "Invalid token"
    db.refresh(user)
    assert verify_password(first_password, user.hashed_password)[0]


def test_reset_password_rejects_expired_token(client: TestClient, db: Session) -> None:
    user, password = _make_user(db)
    token = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.RESET
    )
    row = _tokens_for(db, user)[0]
    row.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=1)
    db.add(row)
    db.commit()

    r = _reset(client, token)
    assert r.status_code == 400
    assert r.json()["detail"] == "Invalid token"
    db.refresh(user)
    assert verify_password(password, user.hashed_password)[0]


def test_reset_password_rejects_activation_token(
    client: TestClient, db: Session
) -> None:
    user, password = _make_user(db)
    token = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.ACTIVATE
    )
    r = _reset(client, token)
    assert r.status_code == 400
    assert r.json()["detail"] == "Invalid token"
    db.refresh(user)
    assert verify_password(password, user.hashed_password)[0]


def test_reset_password_rejects_forged_jwt(client: TestClient, db: Session) -> None:
    """The old design: a JWT {sub: email} signed with SECRET_KEY. Must not work."""
    user, password = _make_user(db)
    now = datetime.now(UTC)
    forged = jwt.encode(
        {"exp": now + timedelta(hours=1), "nbf": now, "sub": user.email},
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )
    r = _reset(client, forged)
    assert r.status_code == 400
    db.refresh(user)
    assert verify_password(password, user.hashed_password)[0]


def test_reset_password_rejects_inactive_user(client: TestClient, db: Session) -> None:
    user, _ = _make_user(db, is_active=False)
    token = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.RESET
    )
    r = _reset(client, token)
    assert r.status_code == 400
    assert r.json()["detail"] == "Invalid token"
    db.refresh(user)
    assert user.is_active is False


def test_reset_revokes_existing_sessions_and_other_tokens(
    client: TestClient, db: Session
) -> None:
    user, password = _make_user(db)
    old_headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    assert (
        client.post(f"{API}/login/test-token", headers=old_headers).status_code == 200
    )

    reset_token = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.RESET
    )
    other_token = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.RESET
    )
    new_password = random_lower_string()
    assert _reset(client, reset_token, new_password).status_code == 200

    # session from before the reset is dead
    r = client.post(f"{API}/login/test-token", headers=old_headers)
    assert r.status_code == 401
    # other outstanding links are dead too
    assert _reset(client, other_token, "anotherpassword1").status_code == 400
    assert _tokens_for(db, user) == []

    # logging in with the new password works
    new_headers = user_authentication_headers(
        client=client, email=user.email, password=new_password
    )
    assert (
        client.post(f"{API}/login/test-token", headers=new_headers).status_code == 200
    )


# --------------------------------------------------------------------- recovery flow


def test_recovery_issues_token_and_email_for_active_user(
    client: TestClient, db: Session
) -> None:
    user, _ = _make_user(db)
    with (
        patch("app.core.config.settings.SMTP_HOST", "smtp.example.com"),
        patch("app.core.config.settings.SMTP_USER", "admin@example.com"),
        patch("app.api.routes.login.send_email") as send,
    ):
        r = client.post(f"{API}/password-recovery/{user.email}")
    assert r.status_code == 200
    assert send.call_count == 1
    rows = _tokens_for(db, user)
    assert len(rows) == 1
    assert rows[0].purpose == AuthTokenPurpose.RESET.value


def test_recovery_issues_nothing_for_inactive_user(
    client: TestClient, db: Session
) -> None:
    user, _ = _make_user(db, is_active=False)
    with (
        patch("app.core.config.settings.SMTP_HOST", "smtp.example.com"),
        patch("app.core.config.settings.SMTP_USER", "admin@example.com"),
        patch("app.api.routes.login.send_email") as send,
    ):
        r = client.post(f"{API}/password-recovery/{user.email}")
    # same generic answer as for an unknown address
    assert r.status_code == 200
    assert (
        r.json()["message"]
        == "If that email is registered, we sent a password recovery link"
    )
    assert send.call_count == 0
    assert _tokens_for(db, user) == []


# ------------------------------------------------------------------- activation flow


def test_signup_then_activate_once(client: TestClient, db: Session) -> None:
    email = random_email()
    password = random_lower_string()
    r = client.post(
        f"{API}/users/signup",
        json={"email": email, "password": password, "full_name": "New Person"},
    )
    assert r.status_code == 200
    user = crud.get_user_by_email(session=db, email=email)
    assert user is not None and user.is_active is False

    token = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.ACTIVATE
    )
    r = client.get(f"{API}/users/activate", params={"token": token})
    assert r.status_code == 200
    db.refresh(user)
    assert user.is_active is True

    # single use
    r = client.get(f"{API}/users/activate", params={"token": token})
    assert r.status_code == 400
    assert r.json()["detail"] == "Invalid or expired token"


def test_activate_rejects_reset_token(client: TestClient, db: Session) -> None:
    user, _ = _make_user(db, is_active=False)
    token = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.RESET
    )
    r = client.get(f"{API}/users/activate", params={"token": token})
    assert r.status_code == 400
    db.refresh(user)
    assert user.is_active is False


def test_activate_rejects_expired_token(client: TestClient, db: Session) -> None:
    user, _ = _make_user(db, is_active=False)
    token = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.ACTIVATE
    )
    row = _tokens_for(db, user)[0]
    row.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=1)
    db.add(row)
    db.commit()
    r = client.get(f"{API}/users/activate", params={"token": token})
    assert r.status_code == 400
    db.refresh(user)
    assert user.is_active is False


def test_activate_rejects_forged_jwt(client: TestClient, db: Session) -> None:
    """A holder of SECRET_KEY who knows only an email cannot activate an account."""
    user, _ = _make_user(db, is_active=False)
    now = datetime.now(UTC)
    forged = jwt.encode(
        {"exp": now + timedelta(hours=1), "nbf": now, "sub": user.email},
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )
    r = client.get(f"{API}/users/activate", params={"token": forged})
    assert r.status_code == 400
    db.refresh(user)
    assert user.is_active is False


# ---------------------------------------------------------------- session revocation


def test_access_token_without_version_is_rejected(
    client: TestClient, db: Session
) -> None:
    user, _ = _make_user(db)
    token = create_access_token(user.id, expires_delta=timedelta(minutes=5))
    r = client.post(
        f"{API}/login/test-token", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 401


def test_access_token_with_wrong_version_is_rejected(
    client: TestClient, db: Session
) -> None:
    """Forging with the key and the user id is not enough: the version is random."""
    user, _ = _make_user(db)
    token = create_access_token(
        user.id,
        expires_delta=timedelta(minutes=5),
        token_version=user.token_version + 1,
    )
    r = client.post(
        f"{API}/login/test-token", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 401


def test_access_token_with_current_version_is_accepted(
    client: TestClient, db: Session
) -> None:
    user, _ = _make_user(db)
    token = create_access_token(
        user.id,
        expires_delta=timedelta(minutes=5),
        token_version=user.token_version,
    )
    r = client.post(
        f"{API}/login/test-token", headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200


def test_admin_deactivation_revokes_sessions_and_links(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    user, password = _make_user(db)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    assert client.post(f"{API}/login/test-token", headers=headers).status_code == 200
    activation = crud.create_auth_token(
        session=db, user=user, purpose=AuthTokenPurpose.ACTIVATE
    )

    r = client.patch(
        f"{API}/users/{user.id}",
        headers=superuser_token_headers,
        json={"is_active": False},
    )
    assert r.status_code == 200

    assert client.post(f"{API}/login/test-token", headers=headers).status_code == 401
    assert _tokens_for(db, user) == []

    # a deactivated user cannot re-activate themselves with an old emailed link
    r = client.get(f"{API}/users/activate", params={"token": activation})
    assert r.status_code == 400
    db.refresh(user)
    assert user.is_active is False


def test_admin_password_change_revokes_sessions(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    user, password = _make_user(db)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    assert client.post(f"{API}/login/test-token", headers=headers).status_code == 200

    new_password = random_lower_string()
    r = client.patch(
        f"{API}/users/{user.id}",
        headers=superuser_token_headers,
        json={"password": new_password},
    )
    assert r.status_code == 200

    assert client.post(f"{API}/login/test-token", headers=headers).status_code == 401
    fresh = user_authentication_headers(
        client=client, email=user.email, password=new_password
    )
    assert client.post(f"{API}/login/test-token", headers=fresh).status_code == 200


def test_admin_update_without_password_or_deactivation_keeps_sessions(
    client: TestClient, db: Session, superuser_token_headers: dict[str, str]
) -> None:
    user, password = _make_user(db)
    headers = user_authentication_headers(
        client=client, email=user.email, password=password
    )
    r = client.patch(
        f"{API}/users/{user.id}",
        headers=superuser_token_headers,
        json={"full_name": "Renamed"},
    )
    assert r.status_code == 200
    assert client.post(f"{API}/login/test-token", headers=headers).status_code == 200
