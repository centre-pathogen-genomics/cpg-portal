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

