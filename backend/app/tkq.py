import taskiq_fastapi
from taskiq import InMemoryBroker
from taskiq_nats import NatsBroker
from taskiq_redis import RedisAsyncResultBackend

from app.core.config import settings

broker = NatsBroker(
    settings.NATS_URIS.split(","),
    queue="cpg_queue",
).with_result_backend(
    RedisAsyncResultBackend(settings.REDIS_URI),
)

# Actually, you can remove this line and test agains real
# broker. Which is more preferable in some cases.
# if settings.env.lower() == "pytest":
#     broker = InMemoryBroker()


taskiq_fastapi.init(broker, "app.main:app")
