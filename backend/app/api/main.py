from fastapi import APIRouter

from app.api.routes import files, login, tasks, users, utils, tools

api_router = APIRouter()
api_router.include_router(login.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(utils.router, prefix="/utils", tags=["utils"])
api_router.include_router(tools.router, prefix="/tools", tags=["tools"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
