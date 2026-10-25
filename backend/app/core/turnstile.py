"""Cloudflare Turnstile, to keep automated signups and bots out.

The checks follow Cloudflare's server-side guidance: the token has to be
present and sane, Cloudflare has to confirm it, and the confirmed action and
hostname have to be the ones this deployment expects. Verification only happens
when a secret key is configured, so a deployment that supplies no key behaves
exactly as it did before.
"""

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
# A token is a JWT-ish string; anything this long is not one.
MAX_TOKEN_LENGTH = 2048
TIMEOUT_SECONDS = 10


def turnstile_enabled() -> bool:
    """Whether this deployment asks visitors to prove they are human."""
    return bool(settings.TURNSTILE_SECRET_KEY)


def expected_hostnames() -> list[str]:
    """The frontend hostnames a token may come from."""
    return [
        hostname.strip()
        for hostname in (settings.TURNSTILE_HOSTNAMES or "").split(",")
        if hostname.strip()
    ]


def _refuse(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def verify_turnstile(
    token: str | None, remote_ip: str | None, action: str | None = None
) -> None:
    """
    Check a Turnstile token, refusing the request when it does not pass.

    A missing token, a rejected token, a mismatched action or hostname, and a
    call that cannot be made all count as failures: once a key is configured the
    door stays shut rather than open.
    """
    secret = settings.TURNSTILE_SECRET_KEY
    if not secret:
        return

    allowed_hostnames = expected_hostnames()
    if not allowed_hostnames:
        # Without the allowlist there is nothing to compare the hostname with,
        # so there is no safe answer.
        raise _refuse(
            "Turnstile is not configured: set TURNSTILE_HOSTNAMES to the "
            "frontend hostnames this deployment serves"
        )
    if not token or len(token) > MAX_TOKEN_LENGTH:
        raise _refuse("Turnstile verification is required")

    payload = {"secret": secret, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip
    try:
        verification = httpx.post(SITEVERIFY_URL, data=payload, timeout=TIMEOUT_SECONDS)
        result = verification.json()
    except Exception as error:
        raise _refuse("Turnstile could not be verified") from error

    if not result.get("success"):
        raise _refuse("Turnstile verification failed")
    # Cloudflare's testing keys answer without an action, which is the only case
    # where there is nothing to compare.
    from_testing_keys = bool((result.get("metadata") or {}).get("result_with_testing_key"))
    if action and not from_testing_keys and result.get("action") != action:
        raise _refuse("Turnstile was solved for a different action")
    if result.get("hostname") not in allowed_hostnames:
        raise _refuse("Turnstile was solved on a different site")
