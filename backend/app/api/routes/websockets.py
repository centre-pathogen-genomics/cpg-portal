from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.wsmanager import manager

router = APIRouter()

@router.websocket("/runs")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive. Optionally, handle incoming messages.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
