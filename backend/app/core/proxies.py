"""Resolve the real client address behind trusted reverse proxies.

Apache forwards the visitor through Traefik, and each of them preprends the
previous peer to ``X-Forwarded-For``. We only honour that header when the
direct socket peer is one of ``settings.TRUSTED_PROXIES`` (Apache and/or
Traefik). Anything a client sends themselves is discarded, so nobody can forge
their identity.

After :class:`ProxyHeaderMiddleware` runs, ``request.client.host`` is the real
visitor for requests that came through a trusted proxy, and the direct peer
otherwise.
"""

import ipaddress

from fastapi import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import settings

X_FORWARDED_FOR = b"x-forwarded-for"


def _trusted_networks() -> list[ipaddress._BaseNetwork]:
    """Trusted proxy peers as networks (a bare host becomes a /32 or /128)."""
    networks: list[ipaddress._BaseNetwork] = []
    for entry in settings.TRUSTED_PROXIES.split(","):
        value = entry.strip()
        if not value:
            continue
        try:
            networks.append(ipaddress.ip_network(value, strict=False))
        except ValueError:
            # Unparseable entry: ignore rather than fail the whole stack.
            continue
    return networks


def peer_is_trusted(peer: str) -> bool:
    """Whether ``peer`` (the direct socket client) may set forwarded headers."""
    try:
        address = ipaddress.ip_address(peer)
    except ValueError:
        return False
    return any(address in network for network in _trusted_networks())


def _first_forwarded(headers: list[tuple[bytes, bytes]]) -> str | None:
    """Leftmost (original) address from the first X-Forwarded-For header."""
    for name, value in headers:
        if name.lower() == X_FORWARDED_FOR:
            first = value.decode("latin1").split(",")[0].strip()
            return first or None
    return None


def client_ip(request: Request) -> str | None:
    """The real client address for this request, after proxy headers resolve."""
    if request.client:
        return request.client.host
    return None


class ProxyHeaderMiddleware:
    """Rewrite ``scope["client"]`` from ``X-Forwarded-For`` for trusted peers."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            client = scope.get("client")
            peer = client[0] if client else None
            if peer is not None and peer_is_trusted(peer):
                remote = _first_forwarded(scope.get("headers", []))
                if remote:
                    scope["client"] = (remote, 0)
        await self.app(scope, receive, send)
