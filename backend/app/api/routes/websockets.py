from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.wsmanager import manager

router = APIRouter()

@router.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket):
    """
    Public stream of events
    """
    await manager.connect(websocket, "stream")
    try:
        while True:
            # Keep connection alive. Optionally, handle incoming messages.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, "stream")
