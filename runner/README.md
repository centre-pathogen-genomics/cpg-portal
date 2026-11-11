# CPG Runner (desktop app)

The desktop app that runs a tool on the visitor's own machine. It is an
Electron shell around two things: a Python sidecar that serves the local API and
drives Docker, and a renderer that reuses the portal's components.

## Run it in development

```bash
bun install                     # workspace root, once
bash runner/scripts/dev.sh      # or: bun run --cwd runner dev
```

That starts three processes:

| Process | What it does |
|---|---|
| vite (`127.0.0.1:5174`) | serves the renderer with hot reload |
| Electron | the window, pointed at vite |
| the sidecar | launched by Electron itself, on its own port, serving the API |

The window is loaded from vite but talks to the sidecar, which is why the app
passes the API origin to the renderer in development (`?api=`); the sidecar
allows `http://localhost:*` and `http://127.0.0.1:*` origins for that. In a
packaged app both are the same origin.

State lives in `runner/.dev/userdata`, so a dev session never sees or touches the
tools installed in the real app (`~/Library/Application Support/cpg-runner`).
The first run writes a small dev tool pack to `runner/.dev/dev.cpgpack` (an echo
tool with a text parameter and a file parameter) and opens it. Import a real
pack by downloading one from a tool page, or point at one:

```bash
CPG_RUNNER_DEV_PACK=/path/to/tool.cpgpack bash runner/scripts/dev.sh
```

Useful overrides:

| Variable | Default | Meaning |
|---|---|---|
| `CPG_RUNNER_DEV_UI_PORT` | `5174` | vite port |
| `CPG_RUNNER_DEV_PACK` | `runner/.dev/dev.cpgpack` | pack to open |
| `CPG_RUNNER_PORTAL_URL` | `http://127.0.0.1:8000` | where the runtime image comes from |

Electron's binary is downloaded the first time (`bunx electron --version` does
it), and the sidecar is built with PyInstaller when `sidecar/dist/cpg-runner`
is missing. Both are cached afterwards.

## Layout

```
electron/          main.ts (window, pack import, one sidecar per tool) and preload.ts
renderer/          the UI: tool list, tool page, run page; `@` points at frontend/src
sidecar/           FastAPI app (cpg_runner/), PyInstaller spec, tests
runtime/           Dockerfile and build.sh for the shared runtime image
scripts/           dev.sh, build-apps.sh
```

The renderer deliberately reuses portal code — `ToolRunForm`, `StatusBadge`,
`RunTime`, `OutputAccordion`, `Common/Markdown`, `Common/CodeBlock` — so the two
stay one product. Anything the desktop app needs that the portal also has should
be fixed in `frontend/src`, not copied into `renderer/src`.

## Test and build

```bash
cd runner/sidecar && uv run pytest -q          # sidecar
cd runner && bunx tsc --noEmit -p tsconfig.json
bash runner/scripts/build-apps.sh mac-arm64    # needs signing secrets; --unsigned for a local check
bash runner/runtime/build.sh                   # Docker runtime images
```

`deployment.md` in the repository root covers the release artifacts, signing
secrets and the endpoints that serve them.
