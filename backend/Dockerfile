FROM python:3.14

ENV PYTHONUNBUFFERED=1

# Install uv
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#installing-uv
COPY --from=ghcr.io/astral-sh/uv:0.9.26 /uv /uvx /bin/

# Compile bytecode
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#compiling-bytecode
ENV UV_COMPILE_BYTECODE=1

# uv Cache
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#caching
ENV UV_LINK_MODE=copy

WORKDIR /app/

ENV CONDA_DIR=/opt/conda
ENV PATH="${CONDA_DIR}/bin:${PATH}"
ENV UV_PYTHON=/usr/local/bin/python3.14

# Tool environments are persisted separately from the application environment.
RUN curl -fsSLO "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-$(uname)-$(uname -m).sh" && \
    bash "Miniforge3-$(uname)-$(uname -m).sh" -b -p "${CONDA_DIR}" && \
    rm "Miniforge3-$(uname)-$(uname -m).sh" && \
    conda clean --all --yes && \
    conda config --set auto_activate_base false

# Apptainer is used by the worker to run tool commands inside a container, see
# app/sandbox.py. The unprivileged installation is relocatable and available for
# every architecture, unlike the .deb packages.
ARG APPTAINER_VERSION=1.5.4
RUN apt-get update && \
    apt-get install -y --no-install-recommends cpio iptables rpm2cpio && \
    rm -rf /var/lib/apt/lists/* && \
    curl -fsSL "https://raw.githubusercontent.com/apptainer/apptainer/v${APPTAINER_VERSION}/tools/install-unprivileged.sh" -o /tmp/install-unprivileged.sh && \
    bash /tmp/install-unprivileged.sh -v "${APPTAINER_VERSION}" /opt/apptainer && \
    rm /tmp/install-unprivileged.sh

# Tool runs are limited to the CPUs they reserved, which apptainer applies with
# cgroups. The worker container has no systemd, so apptainer manages them
# through cgroupfs instead (see scripts/sandbox_setup.sh).
RUN /opt/apptainer/bin/apptainer config global --set "systemd cgroups" no && \
    /opt/apptainer/bin/apptainer config global --get "systemd cgroups"

# Tool runs get their own network namespace; apptainer sets it up from the CNI
# configurations in this directory. "loopback" is the default, "internet" is
# masqueraded and restricted to public addresses by scripts/sandbox_network_setup.sh.
COPY ./backend/container/loopback.conf ./backend/container/internet.conf /etc/apptainer/network/

# Place executables in the environment at the front of the path
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#using-the-environment
ENV PATH="/opt/apptainer/bin:/app/.venv/bin:$PATH"

# Install dependencies
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#intermediate-layers
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-workspace --package app

COPY ./backend/scripts /app/backend/scripts
COPY ./backend/container /app/backend/container

COPY ./backend/pyproject.toml ./backend/alembic.ini /app/backend/

COPY ./backend/app /app/backend/app
COPY ./backend/tests /app/backend/tests

# Sync the project
# Ref: https://docs.astral.sh/uv/guides/integration/docker/#intermediate-layers
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --package app

WORKDIR /app/backend/

CMD ["fastapi", "run", "--workers", "4"]
