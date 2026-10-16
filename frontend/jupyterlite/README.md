# JupyterLite

JupyterLite is a JupyterLab distribution that runs entirely in the browser built on top of Pyodide, a port of the CPython runtime to WebAssembly. It is a standalone, zero-install distribution of JupyterLab that includes a Python kernel and the Pyodide Python environment.

## Installation

This only needs to be done once.

```bash
cd frontend/jupyterlite
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Testing

Remember you'll need to set the API URL to localhost:8000 for testing

```bash
source .venv/bin/activate
jupyter lite build
```

This writes the site to `frontend/public/wasm/jupyterlite` (see `output_dir` in
`jupyter_lite_config.json`). That directory is git-ignored and is what `bun run dev`
serves at `/wasm/jupyterlite/`, so run the build once before using JupyterLite in the dev
server (it returns 404 until then) and again after changing `requirements.txt` or the config.
Production images build JupyterLite in their own Docker stage and don't use this directory.

`requirements.txt` installs the R kernel from the patched wheel in `vendor/`. Run `pip`
from this directory so the relative path resolves.

# Hosting

You need to set HEADERS for jupyterlite to work the best. This is an example of how to do it in Apache (our reverse proxy):
```
<IfModule mod_headers.c>
    <Location /wasm/jupyterlite>
        Header always set Cross-Origin-Opener-Policy "same-origin"
        Header always set Cross-Origin-Embedder-Policy "require-corp"
        Header always set Cross-Origin-Resource-Policy "same-origin"
    </Location>
</IfModule>
```

## The DRIVEFS relay service worker

The R kernel (webR) mounts an Emscripten `DRIVEFS` at `/drive`. Every file
operation is a synchronous POST to `<origin>/api/drive`; a service worker is
supposed to intercept it and serve the file from the page's own JupyterLite
storage, so nothing ever hits the server. JupyterLite's own
`service-worker.js` does this, but it only works once it *controls* the page.
On a first ever visit to an origin (or after a JupyterLite upgrade, which
unregisters all workers), the page loads before any worker controls it and the
drive requests fall through to the server with a 404 until the page is
reloaded.

To make the first visit work, the portal registers a root-scoped relay worker,
`/drive-relay-sw.js` (see `frontend/src/main.tsx`), before the user opens the
JupyterLite tab. Because it is scoped to `/`, the tab is controlled from
document start and the relay forwards `/api/drive` requests to the JupyterLite
page over the same `sw-api.v1` BroadcastChannel protocol JupyterLite uses.

Service workers are only available on secure origins (`https://`, or
`localhost`). Serving the portal over plain `http` on a LAN hostname will make
every `/api/drive` request 404 — use TLS.

Opening the JupyterLite URL directly in a browser that has never loaded the
portal (no service workers registered for the origin at all) still has the
original first-visit gap: reload the page once and drive access works.
