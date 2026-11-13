"""Public URLs this backend is reachable under."""

from fastapi import Request

from app.core.config import settings


def public_base_url(request: Request) -> str:
    """Public origin of this backend, for links handed to a client."""
    configured = settings.RUNNER_PUBLIC_BASE_URL.rstrip("/")
    if configured:
        return configured
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get(
        "x-forwarded-host", request.headers.get("host", request.url.netloc)
    )
    return f"{scheme}://{host}"
