import uuid
from typing import Annotated

from fastapi import (
    Depends,
    WebSocket,
    WebSocketDisconnect,
    WebSocketException,
)

from app.api.deps import SessionDep, get_current_user_from_query
from app.api.routers import TrailingSlashRouter as APIRouter
from app.models import Run, User
from app.wsmanager import manager

router = APIRouter()

@router.websocket("/stream")
async def stream(websocket: WebSocket):
    """
    Public stream of events
    """
    await manager.connect(websocket, "stream")
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, "stream")


@router.websocket("/logs/{run_id}")
async def logs(websocket: WebSocket, run_id: uuid.UUID, session: SessionDep, current_user: Annotated[User, Depends(get_current_user_from_query)]):
    run: Run = session.get(Run, run_id)
    if run is None:
        raise WebSocketException("Run not found")
    if run.owner_id != current_user.id:
        raise WebSocketException("Unauthorized access")

    # Accept the websocket connection
    await manager.connect(websocket, str(run_id))
    try:
        while True:
            # Keep connection alive (you might process incoming messages if needed)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, str(run_id))
