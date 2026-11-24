"""Public URLs this backend is reachable under."""

from fastapi import Request

from app.core.config import settings
from app.core.proxies import peer_is_trusted


def public_base_url(request: Request) -> str:
    """Public origin of this backend, for links handed to a client."""
    configured = settings.RUNNER_PUBLIC_BASE_URL.rstrip("/")
    if configured:
        return configured
    # Only honour forwarded scheme/host from a trusted proxy; a client sending
    # these headers directly must not be able to influence the host we advertise
    # (host-header poisoning via an untrusted X-Forwarded-Host).
    if request.client and peer_is_trusted(request.client.host):
        scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
        host = request.headers.get(
            "x-forwarded-host", request.headers.get("host", request.url.netloc)
        )
    else:
        scheme = request.url.scheme
        host = request.url.netloc
    return f"{scheme}://{host}"
