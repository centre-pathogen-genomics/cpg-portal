import asyncio

from broadcaster import Broadcast
from fastapi import WebSocket

from app.core.config import settings


class ConnectionManager:
    def __init__(
        self,
        broadcast_url: str = settings.REDIS_URI,
        channel: str = "ws_broadcast"
    ):
        # Create a broadcaster instance (Redis is used here by default)
        self.broadcaster = Broadcast(broadcast_url)
        self.channel = channel
        # Optionally keep track of connected WebSocket objects
        self.active_connections: list[WebSocket] = []

    async def startup(self):
        """Call this on application startup to connect the broadcaster."""
        await self.broadcaster.connect()

    async def shutdown(self):
        """Call this on application shutdown to disconnect the broadcaster."""
        await self.broadcaster.disconnect()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        # Start a background task to forward messages from the broadcaster to this websocket
        asyncio.create_task(self._listen_to_broadcast(websocket))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        """Publish a message to all subscribers on the channel."""
        await self.broadcaster.publish(channel=self.channel, message=message)

    async def _listen_to_broadcast(self, websocket: WebSocket):
        """
        For a connected websocket, subscribe to the broadcast channel and
        forward any published messages to the websocket.
        """
        try:
            async with self.broadcaster.subscribe(channel=self.channel) as subscriber:
                async for event in subscriber:
                    # Send the received broadcast message to the connected client
                    await websocket.send_text(event.message)
        except Exception as e:
            print(f"Broadcast subscription error: {e}")

manager = ConnectionManager()
