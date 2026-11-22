"""Structured, JSON logging for security monitoring.

Two independent streams, both written as one JSON object per line so a log
shipper (Promtail, Fluentd, a SIEM agent) can parse them without bespoke
parsing:

* ``cpg.access`` -- one line per HTTP request, with the real client address
  (after :mod:`app.core.proxies` resolves it), the matched route, status and
  duration, plus a ``request_id`` echoed to the client in ``X-Request-ID``.
  Raw paths, query strings and identifiers are not logged: only the first path
  segment and the matched route name, so tokens, user ids and file/run ids stay
  out of the feed.

* ``cpg.security`` -- application security events (login attempts, permission
  denials, uploads, job submissions), emitted by :func:`audit`.

A single JSON formatter is used by both; extra structured fields are passed by
callers via :func:`audit`. ``uvicorn.access`` is disabled so each request is
logged exactly once (by ``cpg.access``).
"""

import json
import logging
import time
import uuid
from datetime import UTC, datetime

from fastapi import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.proxies import client_ip

ACCESS_LOGGER_NAME = "cpg.access"
SECURITY_LOGGER_NAME = "cpg.security"

# LogRecord attributes produced by logging itself; they are excluded from the
# JSON payload, which only carries the fields callers set.
_LOG_INTERNALS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "taskName",
    "message",
    "asctime",
}


class JsonFormatter(logging.Formatter):
    """Render one record as a compact JSON object on a single line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
        }
        message = record.getMessage()
        if message:
            payload["message"] = message
        payload["event"] = record.__dict__.get("event") or record.name.split(".")[-1]
        for key, value in record.__dict__.items():
            if key.startswith("_") or key in _LOG_INTERNALS or key == "event":
                continue
            # Only scalar and simple structured values are meaningful here.
            payload[key] = value
        return json.dumps(payload, default=str, separators=(",", ":"))


def _structured_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
    return logger


ACCESS_LOGGER = _structured_logger(ACCESS_LOGGER_NAME)
SECURITY_LOGGER = _structured_logger(SECURITY_LOGGER_NAME)


def setup() -> None:
    """Wire JSON loggers and stop uvicorn's plain-text access log.

    Called once at app import, after which every request is logged exactly once
    by :class:`AccessLogMiddleware` in JSON.
    """
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.disabled = True
    access_logger.propagate = False


def audit(
    event: str,
    *,
    level: int = logging.INFO,
    request: Request | None = None,
    user_id: str | int | None = None,
    **fields: object,
) -> None:
    """Emit one structured security event to ``cpg.security``.

    ``request`` contributes the resolved client address; callers add identity
    and event-specific fields. Never pass secrets, tokens, bodies or uncurated
    user content here -- the fields are logged as-is.
    """
    payload: dict[str, object] = {}
    if request is not None:
        ip = client_ip(request)
        if ip:
            payload["client_ip"] = ip
        request_id = request.scope.get("request_id")
        if request_id:
            payload["request_id"] = request_id
    if user_id is not None:
        payload["user_id"] = user_id
    payload.update(fields)
    SECURITY_LOGGER.log(level, "", extra={"event": event, **payload})


def _coarse_path(path: str) -> str:
    """First path segment only: ``"/runs/42/files/7"`` -> ``"/runs"``."""
    stripped = path.lstrip("/")
    if not stripped:
        return "/"
    return "/" + stripped.split("/")[0]


class AccessLogMiddleware:
    """One JSON ``cpg.access`` line per HTTP request, with a client request id."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid.uuid4().hex[:16]
        scope["request_id"] = request_id
        # Exposed to handlers as request.state.request_id.
        scope.setdefault("state", {})["request_id"] = request_id

        started = time.perf_counter()
        status: dict[str, int] = {"code": 0}

        async def send_with_trace(message: Message) -> None:
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
                headers = message.setdefault("headers", [])
                headers.append((b"x-request-id", request_id.encode("ascii")))
            await send(message)

        try:
            await self.app(scope, receive, send_with_trace)
        finally:
            route = scope.get("route")
            fields: dict[str, object] = {
                "method": scope.get("method", ""),
                "path": _coarse_path(scope.get("path") or "/"),
                "status": status["code"],
                "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                "request_id": request_id,
            }
            if route is not None:
                fields["route"] = getattr(route, "name", None)
            client = scope.get("client")
            if client:
                fields["client_ip"] = client[0]
            ACCESS_LOGGER.log(logging.INFO, "", extra={"event": "access", **fields})
