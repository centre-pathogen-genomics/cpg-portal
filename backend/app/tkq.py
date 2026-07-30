from nats.js.api import RetentionPolicy, StorageType, StreamConfig
from taskiq import TaskiqEvents, TaskiqState
from taskiq_nats import PullBasedJetStreamBroker
from taskiq_redis import RedisAsyncResultBackend

from app.core.config import settings
from app.wsmanager import manager

broker = PullBasedJetStreamBroker(
    settings.NATS_URIS.split(","),
    durable="cpg_queue",
    stream_config=StreamConfig(
        retention=RetentionPolicy.WORK_QUEUE,
        storage=StorageType.FILE,
    ),
).with_result_backend(
    RedisAsyncResultBackend(settings.REDIS_URI),
)


async def startup_worker(_state: TaskiqState) -> None:
    await manager.startup()


async def shutdown_worker(_state: TaskiqState) -> None:
    await manager.shutdown()


broker.add_event_handler(TaskiqEvents.WORKER_STARTUP, startup_worker)
broker.add_event_handler(TaskiqEvents.WORKER_SHUTDOWN, shutdown_worker)
