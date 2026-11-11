"""The sidecar's HTTP and WebSocket API."""

import json
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from fastapi import (
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.core.file_types import FileTypes

from .config import RunnerConfig, ToolConfig
from .docker_cli import Docker
from .doctor import Doctor
from .events import EventChannel
from .installer import InstallBlocked, InstallAlreadyRunning, Installer
from .runs import (
    MAX_CPUS,
    RunConflict,
    RunManager,
    RunNotFound,
    TERMINAL_STATUSES,
)
from .state import Settings, StateStore


class SettingsUpdate(BaseModel):
    cpus: int
    output_dir: str
    network: bool = True


class RunRequest(BaseModel):
    params: dict[str, Any] = Field(default_factory=dict)
    cpus: int = 1
    name: str | None = None


def create_app(
    *,
    token: str,
    tool: ToolConfig,
    runner: RunnerConfig,
    docker: Docker,
    doctor: Doctor,
    installer: Installer,
    runs: RunManager,
    store: StateStore,
    environment_yml: str | None = None,
    ui_dir: Path | None = None,
    file_types: FileTypes | None = None,
) -> FastAPI:
    app = FastAPI(title="CPG Runner", docs_url=None, redoc_url=None, openapi_url=None)
    # Development serves the UI from vite on another local port; every request
    # still carries the token, so a localhost origin is enough to allow.
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^http://(127\.0\.0\.1|localhost)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
    file_types = file_types or FileTypes()
    doctor_channel = EventChannel()
    action_state = {"running": False}

    def require_token(x_cpg_token: str | None = Header(default=None)) -> None:
        if x_cpg_token != token:
            raise HTTPException(status_code=401, detail="Unauthorized")

    auth = Depends(require_token)

    def _authorized(header_token: str | None, query_token: str | None) -> bool:
        return header_token == token or query_token == token

    # -- basics ------------------------------------------------------------

    @app.get("/api/health", dependencies=[auth])
    def health() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/api/doctor", dependencies=[auth])
    def read_doctor() -> dict[str, Any]:
        return doctor.diagnose()

    @app.post("/api/doctor/actions/{action_id}", dependencies=[auth])
    def start_doctor_action(action_id: str) -> JSONResponse:
        report = doctor.diagnose()
        allowed = {action["id"] for action in report["actions"]}
        if action_id not in allowed:
            raise HTTPException(status_code=404, detail=f"Unknown action: {action_id}")
        if action_state["running"]:
            raise HTTPException(status_code=409, detail="An action is already running")
        action_state["running"] = True
        doctor_channel.reset()

        def emit(line: str) -> None:
            doctor_channel.publish_threadsafe({"type": "line", "line": line})

        def work() -> None:
            try:
                doctor.run_action(action_id, emit)
            except Exception as exc:  # noqa: BLE001 - shown in the stream
                emit(str(exc))
            try:
                final = doctor.diagnose()
            except Exception:  # noqa: BLE001
                final = {}
            doctor_channel.publish_threadsafe(
                {
                    "type": "done",
                    "payload": {"ok": bool(final.get("ready")), "doctor": final},
                }
            )
            action_state["running"] = False

        threading.Thread(target=work, daemon=True).start()
        return JSONResponse(status_code=202, content={"action": action_id})

    @app.get("/api/doctor/events")
    async def doctor_events(
        x_cpg_token: str | None = Header(default=None),
        token_query: str | None = Query(default=None, alias="token"),
    ) -> StreamingResponse:
        if not _authorized(x_cpg_token, token_query):
            raise HTTPException(status_code=401, detail="Unauthorized")

        async def generator():
            history, queue = await doctor_channel.subscribe()
            try:
                for message in history:
                    if message.get("type") == "done":
                        payload = json.dumps(message["payload"])
                        yield f"event: done\ndata: {payload}\n\n"
                        return
                    yield f"data: {message.get('line', '')}\n\n"
                while True:
                    message = await queue.get()
                    if message.get("type") == "done":
                        payload = json.dumps(message["payload"])
                        yield f"event: done\ndata: {payload}\n\n"
                        return
                    yield f"data: {message.get('line', '')}\n\n"
            finally:
                doctor_channel.unsubscribe(queue)

        return StreamingResponse(
            generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache"},
        )

    status_pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="status")

    @app.get("/api/status", dependencies=[auth])
    def read_status() -> dict[str, Any]:
        # Three independent docker probes of ~200 ms each: ask them at once.
        report_future = status_pool.submit(doctor.diagnose)
        image_future = status_pool.submit(
            docker.image_present, runner.runtime_image.tag
        )
        state_future = status_pool.submit(lambda: installer.state)
        report = report_future.result()
        settings = store.load_settings()
        image_present = image_future.result()
        return {
            "docker": {
                "available": bool(
                    report["docker"]["cli"] and report["docker"]["daemon"]
                ),
                "version": report["docker"]["version"],
            },
            "doctor": report,
            "image": {
                "present": image_present,
                "tag": runner.runtime_image.tag,
            },
            "env": {
                "needed": installer.needs_environment,
                "installed": installer.env_installed(),
            },
            "settings": settings.model_dump(),
            "installing": state_future.result() == "installing",
        }

    @app.get("/api/environment", dependencies=[auth])
    def read_environment() -> dict[str, str | None]:
        """The pack's environment.yml, for the run page's Environment section."""
        return {"yml": environment_yml}

    @app.get("/api/tool", dependencies=[auth])
    def read_tool() -> dict[str, Any]:
        return tool.model_dump()

    @app.get("/api/file-types", dependencies=[auth])
    def read_file_types() -> dict[str, Any]:
        return {
            name: metadata.model_dump() for name, metadata in file_types.allowed.items()
        }

    # -- install -----------------------------------------------------------

    @app.post("/api/install", dependencies=[auth])
    def start_install() -> JSONResponse:
        try:
            state = installer.start()
        except InstallAlreadyRunning as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except InstallBlocked as exc:
            return JSONResponse(
                status_code=409,
                content={
                    "detail": "Docker is not ready",
                    "doctor": exc.report,
                },
            )
        return JSONResponse(status_code=202, content={"state": state})

    @app.delete("/api/install", dependencies=[auth])
    def remove_install() -> JSONResponse:
        try:
            state = installer.remove()
        except InstallAlreadyRunning as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return JSONResponse(status_code=202, content={"state": state})

    @app.websocket("/api/install/logs")
    async def install_logs(websocket: WebSocket) -> None:
        if not _authorized(
            websocket.headers.get("x-cpg-token"),
            websocket.query_params.get("token"),
        ):
            await websocket.close(code=4401)
            return
        await websocket.accept()
        history, queue = await installer.channel.subscribe()
        try:
            for message in history:
                await websocket.send_json(message)
            await websocket.send_json({"type": "state", "state": installer.state})
            while True:
                message = await queue.get()
                await websocket.send_json(message)
        except WebSocketDisconnect:
            pass
        finally:
            installer.channel.unsubscribe(queue)

    # -- settings ----------------------------------------------------------

    @app.get("/api/settings", dependencies=[auth])
    def read_settings() -> dict[str, Any]:
        return store.load_settings().model_dump()

    @app.put("/api/settings", dependencies=[auth])
    def update_settings(payload: SettingsUpdate) -> dict[str, Any]:
        maximum = tool.max_cpus if tool.max_cpus is not None else MAX_CPUS
        if payload.cpus < 1 or payload.cpus > maximum:
            raise HTTPException(
                status_code=400,
                detail=f"CPUs must be between 1 and {maximum}",
            )
        if not Path(payload.output_dir).is_absolute():
            raise HTTPException(
                status_code=400, detail="Output folder must be an absolute path"
            )
        settings = Settings(
            cpus=payload.cpus,
            output_dir=payload.output_dir,
            network=payload.network,
        )
        store.save_settings(settings)
        return settings.model_dump()

    # -- runs --------------------------------------------------------------

    @app.post("/api/runs", status_code=201, dependencies=[auth])
    def create_run(payload: RunRequest) -> dict[str, Any]:
        report = doctor.diagnose()
        if not report["ready"]:
            raise HTTPException(status_code=409, detail="Docker is not ready")
        state = installer.status()
        if state == "docker_missing":
            raise HTTPException(status_code=409, detail="Docker is not installed")
        if state == "image_missing":
            raise HTTPException(
                status_code=409, detail="The runtime image is not installed"
            )
        if state == "env_missing":
            raise HTTPException(
                status_code=409, detail="The tool environment is not installed"
            )
        try:
            record = runs.start(payload.params, payload.cpus, name=payload.name or "")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return record.model_dump()

    def _get_run(run_id: str):
        try:
            return runs.get(run_id)
        except RunNotFound as exc:
            raise HTTPException(status_code=404, detail="Run not found") from exc

    @app.get("/api/runs/{run_id}", dependencies=[auth])
    def read_run(run_id: str) -> dict[str, Any]:
        return _get_run(run_id).model_dump()

    @app.post("/api/runs/{run_id}/cancel", dependencies=[auth])
    def cancel_run(run_id: str) -> JSONResponse:
        try:
            record = runs.cancel(run_id)
        except RunNotFound as exc:
            raise HTTPException(status_code=404, detail="Run not found") from exc
        except RunConflict as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        return JSONResponse(status_code=202, content=record.model_dump())

    @app.websocket("/api/runs/{run_id}/logs")
    async def run_logs(websocket: WebSocket, run_id: str) -> None:
        if not _authorized(
            websocket.headers.get("x-cpg-token"),
            websocket.query_params.get("token"),
        ):
            await websocket.close(code=4401)
            return
        try:
            record = runs.get(run_id)
        except RunNotFound:
            await websocket.close(code=4404)
            return
        await websocket.accept()
        _, channel = runs.subscribe(run_id)
        history, queue = await channel.subscribe()
        try:
            for message in history:
                await websocket.send_json(message)
            if record.status in TERMINAL_STATUSES:
                await websocket.send_json(
                    {
                        "type": "status",
                        "status": record.status,
                        "exit_code": record.exit_code,
                    }
                )
            while True:
                message = await queue.get()
                await websocket.send_json(message)
        except WebSocketDisconnect:
            pass
        finally:
            channel.unsubscribe(queue)

    @app.get("/api/runs/{run_id}/files/{index}", dependencies=[auth])
    def read_run_file(run_id: str, index: int) -> FileResponse:
        record = _get_run(run_id)
        if index < 0 or index >= len(record.files):
            raise HTTPException(status_code=404, detail="File not found")
        entry = record.files[index]
        path = Path(entry.path)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(path, filename=entry.name)

    # -- static UI ---------------------------------------------------------

    if ui_dir is not None:
        ui_root = Path(ui_dir)
        assets = ui_root / "assets"
        if assets.is_dir():
            app.mount(
                "/assets",
                StaticFiles(directory=str(assets)),
                name="assets",
            )
        index = ui_root / "index.html"

        @app.get("/{full_path:path}", include_in_schema=False)
        def spa(full_path: str) -> FileResponse:
            if full_path == "api" or full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not Found")
            if full_path:
                candidate = (ui_root / full_path).resolve()
                if candidate.is_relative_to(ui_root.resolve()) and candidate.is_file():
                    return FileResponse(candidate)
            if index.is_file():
                return FileResponse(index)
            raise HTTPException(status_code=404, detail="Not Found")

    return app
