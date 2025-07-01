from fastapi import APIRouter

from app.api.routes import (
    files,
    llm,
    login,
    runs,
    stats,
    tools,
    users,
    utils,
    websockets,
)

api_router = APIRouter()
api_router.include_router(login.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(utils.router, prefix="/utils", tags=["utils"])
api_router.include_router(tools.router, prefix="/tools", tags=["tools"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])
api_router.include_router(websockets.router, prefix="/websockets", tags=["websockets"])
api_router.include_router(llm.router, prefix="/llm", tags=["llm"])
api_router.include_router(stats.router, prefix="/stats", tags=["stats"])
