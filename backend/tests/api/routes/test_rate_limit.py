from fastapi.testclient import TestClient

from app.core.config import settings
from tests.utils.utils import random_email, random_lower_string


def _login(client: TestClient, email: str, password: str) -> int:
    return client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={"username": email, "password": password},
    ).status_code


def test_login_rate_limited_per_account(
    client: TestClient, monkeypatch
) -> None:
    """Rapid login attempts throttle one account without touching another.

    Rate limiting is off in local/test; this test turns it on with a small
    bucket so the slowapi + Redis path is exercised deterministically.
    """
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_LOGIN", "3/minute")

    email = random_email()
    statuses = [
        _login(client, email, random_lower_string()) for _ in range(4)
    ]
    # First three attempts reach the endpoint (wrong password), the fourth is
    # throttled before it does.
    assert statuses[:3] == [400, 400, 400]
    assert statuses[3] == 429

    # A different account is not affected by account A's bucket.
    assert _login(client, random_email(), random_lower_string()) == 400

    # Buckets are per endpoint: the same account's signup is not throttled by
    # the exhausted login bucket.
    signup = client.post(
        f"{settings.API_V1_STR}/users/signup",
        json={
            "email": email,
            "password": random_lower_string(),
            "full_name": random_lower_string(),
        },
    )
    assert signup.status_code == 200


def test_signup_rate_limited_globally(
    client: TestClient, monkeypatch
) -> None:
    """Signup is a single global bucket, so distinct emails share it: mass
    account creation is bounded across the whole deployment."""
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_SIGNUP", "3/minute")

    def _signup() -> int:
        return client.post(
            f"{settings.API_V1_STR}/users/signup",
            json={
                "email": random_email(),
                "password": random_lower_string(),
                "full_name": random_lower_string(),
            },
        ).status_code

    statuses = [_signup() for _ in range(4)]
    # First three distinct-email signups succeed; the fourth is throttled even
    # though it is a brand-new account.
    assert statuses[:3] == [200, 200, 200]
    assert statuses[3] == 429


def test_password_recovery_rate_limited_per_account(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_PASSWORD_RECOVERY", "2/minute")

    email = random_email()
    url = f"{settings.API_V1_STR}/password-recovery/{email}"
    statuses = [client.post(url).status_code for _ in range(3)]
    assert statuses[:2] == [200, 200]
    assert statuses[2] == 429

    # Another email is unaffected.
    assert (
        client.post(f"{settings.API_V1_STR}/password-recovery/{random_email()}")
        .status_code
        == 200
    )
