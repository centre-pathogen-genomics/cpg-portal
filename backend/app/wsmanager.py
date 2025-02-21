import asyncio
from collections import defaultdict

from broadcaster import Broadcast
from fastapi import WebSocket

from app.core.config import settings


class ConnectionManager:
    def __init__(self, broadcast_url: str = settings.REDIS_URI):
        # Create a broadcaster instance (using Redis by default)
        self.broadcaster = Broadcast(broadcast_url)
        # Dictionary to hold active websocket connections per channel.
        self.active_connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def startup(self):
        """Connect the broadcaster on application startup."""
        await self.broadcaster.connect()

    async def shutdown(self):
        """Disconnect the broadcaster on application shutdown."""
        await self.broadcaster.disconnect()

    async def connect(self, websocket: WebSocket, channel: str):
        """
        Accepts a websocket connection and subscribes it to a specified channel.

        Args:
            websocket: The FastAPI WebSocket object.
            channel: The channel to subscribe this connection to.
        """
        await websocket.accept()
        self.active_connections[channel].append(websocket)
        # Launch a background task to listen for messages on this channel.
        asyncio.create_task(self._listen_to_broadcast(websocket, channel))

    def disconnect(self, websocket: WebSocket, channel: str):
        """
        Disconnects a websocket from a specific channel.

        Args:
            websocket: The FastAPI WebSocket object.
            channel: The channel to disconnect this websocket from.
        """
        if websocket in self.active_connections[channel]:
            self.active_connections[channel].remove(websocket)

    async def broadcast(self, message: str, channel: str):
        """
        Publishes a message to the specified channel.

        Args:
            message: The message to broadcast.
            channel: The channel to which the message should be published.
        """
        await self.broadcaster.publish(channel=channel, message=message)

    async def _listen_to_broadcast(self, websocket: WebSocket, channel: str):
        """
        Listens for messages on a specific channel and forwards them to the websocket.

        Args:
            websocket: The FastAPI WebSocket object.
            channel: The channel to subscribe to.
        """
        try:
            # Subscribe to the given channel using an asynchronous context manager.
            async with self.broadcaster.subscribe(channel=channel) as subscriber:
                async for event in subscriber:
                    # Send the received message to the connected client.
                    await websocket.send_text(event.message)
        except Exception as e:
            print(f"Broadcast subscription error on channel '{channel}': {e}")


# Example usage:
# Instantiate the manager (typically as a global or injected dependency)
manager = ConnectionManager()
