"""Replayable in-memory message streams for logs and progress."""

import asyncio
from collections import deque
from typing import Any

DEFAULT_HISTORY = 500


class EventChannel:
    """Keeps the last ``limit`` messages and fans new ones out to subscribers."""

    def __init__(self, limit: int = DEFAULT_HISTORY) -> None:
        self._messages: deque[dict[str, Any]] = deque(maxlen=limit)
        self._queues: set[asyncio.Queue[dict[str, Any]]] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop | None = None) -> None:
        if loop is None:
            loop = asyncio.get_running_loop()
        self._loop = loop

    def reset(self) -> None:
        self._messages.clear()

    def history(self) -> list[dict[str, Any]]:
        return list(self._messages)

    def publish(self, message: dict[str, Any]) -> None:
        """Publish from the event loop thread."""
        self._messages.append(message)
        for queue in list(self._queues):
            queue.put_nowait(message)

    def publish_threadsafe(self, message: dict[str, Any]) -> None:
        """Publish from a worker thread."""
        loop = self._loop
        if loop is None:
            self._messages.append(message)
            return
        loop.call_soon_threadsafe(self.publish, message)

    async def subscribe(
        self,
    ) -> tuple[list[dict[str, Any]], asyncio.Queue[dict[str, Any]]]:
        self.bind_loop()
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._queues.add(queue)
        return self.history(), queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._queues.discard(queue)
