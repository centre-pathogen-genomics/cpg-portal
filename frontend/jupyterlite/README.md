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

# Hosting

You need to set HEADERS to allow jupyterlite to load files. This is an example of how to do it in Apache (our reverse proxy):
```
<IfModule mod_headers.c>
    <Location /wasm/jupyterlite>
        Header always set Cross-Origin-Opener-Policy "same-origin"
        Header always set Cross-Origin-Embedder-Policy "require-corp"
        Header always set Cross-Origin-Resource-Policy "same-origin"
    </Location>
</IfModule>
```
