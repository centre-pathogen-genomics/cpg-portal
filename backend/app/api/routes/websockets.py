import uuid
from datetime import timedelta
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    WebSocket,
    WebSocketDisconnect,
    WebSocketException,
    status,
)

from app.api.deps import (
    CurrentUser,
    SessionDep,
    get_current_user_from_ws_token,
)
from app.core import security
from app.core.config import settings
from app.models import Run, Token, User
from app.wsmanager import manager

router = APIRouter()

# Close code for refused connections: policy violation. Sent instead of an
# accept, so a rejected client just sees the socket fail.
WS_REFUSED = status.WS_1008_POLICY_VIOLATION


def _origin_allowed(websocket: WebSocket) -> bool:
    """Whether the browser origin may open this socket.

    Origin is only sent by browsers; a missing header means a non-browser
    client (CLI tool, test) and is allowed. A present Origin must be one of
    the origins this deployment serves (BACKEND_CORS_ORIGINS / FRONTEND_HOST).
    """
    origin = websocket.headers.get("origin")
    if not origin:
        return True
    return origin.rstrip("/") in settings.all_cors_origins


@router.post("/token", response_model=Token)
def create_ws_token(current_user: CurrentUser) -> Token:
    """
    Mint a short-lived, single-purpose websocket token from the REST bearer
    token.

    The returned token only authenticates websocket connections (purpose
    ``ws``) and expires after ``WS_TOKEN_EXPIRE_SECONDS``, so the long-lived
    login JWT never has to appear in a socket URL.
    """
    expires = timedelta(seconds=settings.WS_TOKEN_EXPIRE_SECONDS)
    return Token(
        access_token=security.create_access_token(
            current_user.id,
            expires_delta=expires,
            token_version=current_user.token_version,
            purpose="ws",
        )
    )


@router.websocket("/stream")
async def stream(websocket: WebSocket):
    """
    Public stream of events
    """
    if not _origin_allowed(websocket):
        raise WebSocketException(code=WS_REFUSED, reason="Origin not allowed")
    await manager.connect(websocket, "stream")
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, "stream")


@router.websocket("/logs/{run_id}")
async def logs(
    websocket: WebSocket,
    run_id: uuid.UUID,
    session: SessionDep,
    current_user: Annotated[User, Depends(get_current_user_from_ws_token)],
):
    if not _origin_allowed(websocket):
        raise WebSocketException(code=WS_REFUSED, reason="Origin not allowed")
    run: Run | None = session.get(Run, run_id)
    if run is None:
        raise WebSocketException(code=WS_REFUSED, reason="Run not found")
    if run.owner_id != current_user.id:
        raise WebSocketException(code=WS_REFUSED, reason="Unauthorized access")

    # Accept the websocket connection
    await manager.connect(websocket, str(run_id))
    try:
        while True:
            # Keep connection alive (you might process incoming messages if needed)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, str(run_id))
