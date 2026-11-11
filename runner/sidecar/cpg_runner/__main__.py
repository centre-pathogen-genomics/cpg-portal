"""Start the sidecar: uvicorn on loopback, one READY line on stdout."""

import argparse
import json
import os
import sys
import threading
import time
from pathlib import Path

import uvicorn

from .api import create_app
from .config import load_resources
from .docker_cli import Docker
from .doctor import Doctor
from .installer import Installer
from .runs import RunManager
from .state import StateStore


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="cpg-runner")
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--documents-dir", required=True)
    parser.add_argument("--resources-dir", required=True)
    parser.add_argument("--ui-dir", default=None)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    token = os.environ.get("CPG_RUNNER_TOKEN")
    if not token:
        print("CPG_RUNNER_TOKEN is required", file=sys.stderr)
        return 2

    resources_dir = Path(args.resources_dir)
    resources = load_resources(resources_dir)
    store = StateStore(
        Path(args.data_dir),
        tool_name=resources.tool.name,
        documents_dir=Path(args.documents_dir),
        default_cpus=resources.tool.default_cpus or resources.tool.min_cpus,
    )
    store.ensure_dirs()

    docker = Docker()
    doctor = Doctor()
    installer = Installer(
        resources=resources, docker=docker, doctor=doctor, store=store
    )
    runs = RunManager(
        tool=resources.tool,
        runner=resources.runner,
        docker=docker,
        store=store,
        resources_dir=resources_dir,
    )
    app = create_app(
        token=token,
        tool=resources.tool,
        runner=resources.runner,
        docker=docker,
        doctor=doctor,
        installer=installer,
        runs=runs,
        store=store,
        environment_yml=(
            resources.environment_yml.read_text()
            if resources.environment_yml is not None
            else None
        ),
        ui_dir=Path(args.ui_dir) if args.ui_dir else None,
    )

    config = uvicorn.Config(app, host="127.0.0.1", port=args.port, log_level="info")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    while not server.started and thread.is_alive():
        time.sleep(0.02)
    if not server.started:
        print("CPG Runner sidecar failed to start", file=sys.stderr)
        return 1

    sockets = server.servers[0].sockets
    port = sockets[0].getsockname()[1]
    print(f"CPG_RUNNER_READY {json.dumps({'port': port})}", flush=True)
    try:
        while thread.is_alive():
            thread.join(0.5)
    except KeyboardInterrupt:
        server.should_exit = True
        thread.join()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
