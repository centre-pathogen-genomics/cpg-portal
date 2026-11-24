import sentry_sdk
from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import settings
from app.core.observability import AccessLogMiddleware
from app.core.observability import setup as setup_observability
from app.core.proxies import ProxyHeaderMiddleware
from app.lifetime import lifespan

setup_observability()


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    redirect_slashes=False,
    lifespan=lifespan,
)

# Resolve the real client address from trusted proxies (Apache, Traefik)
# before anything else reads request.client.
#
# Middleware ordering in Starlette: the LAST add_middleware call is outermost.
# AccessLogMiddleware is therefore added last: it runs outside
# ProxyHeaderMiddleware, and logs client_ip in its finally, after the proxy has
# resolved the real client. Both sit outside CORS.
app.add_middleware(ProxyHeaderMiddleware)
app.add_middleware(AccessLogMiddleware)

# Set all CORS enabled origins
if settings.all_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # The app archive names its build in ETag; a frontend on another origin
        # needs this to read it, and pins the download link to that build.
        expose_headers=["ETag"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)
