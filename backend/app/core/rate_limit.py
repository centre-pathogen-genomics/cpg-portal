"""Per-account rate limiting for the public auth endpoints.

A slowapi ``Limiter`` instance provides a Redis-backed rate limiter shared
across the uvicorn workers; each limited route records its own attempts after
its request body has been parsed, keyed by the *account* (the submitted
email), never the client IP: the portal sits behind proxies, where IPs are
meaningless.
"""

from fastapi import HTTPException, status
from limits import parse
from slowapi import Limiter

from app.core.config import settings

# slowapi builds the Redis storage from this URI lazily; `.limiter` is the
# storage-backed RateLimiter the routes check against.
limiter = Limiter(key_func=lambda _request: "unused", storage_uri=settings.REDIS_URI)


def effective_limit(limit: str) -> str:
    """Bucket size for a route: the configured one, or a huge one when rate
    limiting is disabled (local development / the test suite). Evaluated per
    request, so tests can toggle the settings at runtime."""
    if not settings.rate_limiting_enabled:
        return "1000000/minute"
    return limit


def check_rate_limit(limit: str, item: str, scope: str) -> None:
    """Record one attempt for ``item`` (an account) and refuse on overflow.

    ``scope`` names the endpoint, so a burst of logins does not drain the
    signup bucket of the same account.
    """
    parsed = parse(limit)
    if not limiter.limiter.hit(parsed, item, scope):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests, please try again later",
        )
