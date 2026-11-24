"""Regression tests for the trusted-proxy IP resolution, the JSON access log
and the structured security audit events.

These exercise pure middleware and logging behaviour with crafted ASGI scopes,
so they need no database rows. ``TRUSTED_PROXIES`` is set in conftest.py before
the app settings are built.
"""

import asyncio
import io
import json
import logging
from typing import Any

import pytest
from starlette.routing import Route

from app.core.observability import (
    ACCESS_LOGGER_NAME,
    AccessLogMiddleware,
    JsonFormatter,
    audit,
    setup,
)
from app.core.proxies import (
    ProxyHeaderMiddleware,
    client_ip,
    peer_is_trusted,
)


@pytest.fixture
def captured_c_log() -> io.StringIO:
    """Point the JSON loggers at a StringIO and return it."""
    buffer = io.StringIO()
    for name in (ACCESS_LOGGER_NAME, "cpg.security"):
        logger = logging.getLogger(name)
        for handler in list(logger.handlers):
            logger.removeHandler(handler)
        handler = logging.StreamHandler(buffer)
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
    yield buffer


class _Address:
    """Mirrors starlette.requests.Address (host/port attrs)."""

    def __init__(self, host_port: tuple[str, int]) -> None:
        self.host, self.port = host_port


class _FakeRequest:
    def __init__(self, host_port: tuple[str, int]) -> None:
        self.client = _Address(host_port)
        self.scope: dict[str, Any] = {}


async def _app(scope: dict[str, Any], receive: Any, send: Any) -> None:
    await send({"type": "http.response.start", "status": 200})
    await send({"type": "http.response.body"})


async def _noop(_x: Any = None) -> None:
    return None


async def _resolve(scope: dict[str, Any]) -> tuple[str, int]:
    scope["type"] = "http"
    await ProxyHeaderMiddleware(_app)(scope, _noop, _noop)
    return scope["client"]


def test_peer_is_trusted() -> None:
    assert peer_is_trusted("10.0.0.5") is True
    assert peer_is_trusted("10.0.0.10") is True
    assert peer_is_trusted("10.0.0.99") is False
    assert peer_is_trusted("198.51.100.1") is False
    assert peer_is_trusted("not-an-ip") is False


def test_trusted_proxy_resolves_real_client() -> None:
    scope = {
        "type": "http",
        "client": ("10.0.0.10", 4567),
        "headers": [(b"x-forwarded-for", b"198.51.100.42, 10.0.0.5")],
        "method": "GET",
        "path": "/",
        "query_string": b"",
    }
    assert asyncio.run(_resolve(scope)) == ("198.51.100.42", 0)


def test_untrusted_peer_cannot_spoof() -> None:
    scope = {
        "type": "http",
        "client": ("198.51.100.200", 5000),
        "headers": [(b"x-forwarded-for", b"6.6.6.6")],
        "method": "GET",
        "path": "/",
        "query_string": b"",
    }
    assert asyncio.run(_resolve(scope)) == ("198.51.100.200", 5000)


def test_access_log_sanitizes_path_and_headers(captured_c_log: io.StringIO) -> None:
    scope = {
        "type": "http",
        "client": ("198.51.100.9", 6000),
        "headers": [(b"authorization", b"Bearer tok")],
        "method": "GET",
        "path": "/runs/42/files/7?token=SECRET",
        "query_string": b"token=SECRET",
        "server": ("api.example.com", 443),
        "scheme": "https",
    }
    scope["route"] = Route("/runs/{id}", lambda _r: None, name="read_run")
    asyncio.run(AccessLogMiddleware(_app)(scope, _noop, _noop))
    recorded = json.loads(captured_c_log.getvalue().strip().splitlines()[-1])
    assert recorded["event"] == "access"
    assert recorded["path"] == "/runs"  # first segment only, ids stripped
    assert recorded["route"] == "read_run"
    assert recorded["client_ip"] == "198.51.100.9"
    assert recorded["status"] == 200
    raw = json.dumps(recorded)
    assert "SECRET" not in raw
    assert "Bearer tok" not in raw


def test_composed_stack_logs_resolved_client(
    captured_c_log: io.StringIO,
) -> None:
    """AccessLogMiddleware runs outside ProxyHeaderMiddleware (last added is
    outermost in Starlette) and logs the client AFTER the proxy has resolved it,
    so the access line carries the real visitor, not the proxy peer."""
    scope = {
        "type": "http",
        "client": ("10.0.0.10", 4567),  # trusted Traefik peer
        "headers": [(b"x-forwarded-for", b"198.51.100.42, 10.0.0.5")],
        "method": "GET",
        "path": "/api/v1/utils/health-check/",
        "query_string": b"",
    }
    scope["route"] = Route("/api/v1/utils/{name}", lambda _r: None, name="health")
    stack = AccessLogMiddleware(ProxyHeaderMiddleware(_app))
    asyncio.run(stack(scope, _noop, _noop))
    recorded = json.loads(captured_c_log.getvalue().strip().splitlines()[-1])
    assert recorded["client_ip"] == "198.51.100.42"


def test_audit_emits_structured_event(captured_c_log: io.StringIO) -> None:
    request = _FakeRequest(("198.51.100.9", 6000))
    request.scope["request_id"] = "abc123"
    audit("login.failed", request=request, user_id=7, reason="bad_credentials")
    event = json.loads(captured_c_log.getvalue().strip().splitlines()[-1])
    assert event["event"] == "login.failed"
    assert event["client_ip"] == "198.51.100.9"
    assert event["request_id"] == "abc123"
    assert event["user_id"] == 7
    assert event["reason"] == "bad_credentials"


def test_setup_disables_uvicorn_access_log() -> None:
    setup()
    assert logging.getLogger("uvicorn.access").disabled is True


def test_client_ip_helper() -> None:
    request = _FakeRequest(("10.1.2.3", 9000))
    assert client_ip(request) == "10.1.2.3"