# Stage 0, "build-stage", based on Bun, to build and compile the frontend
FROM oven/bun:1 AS build-stage

WORKDIR /app

COPY package.json bun.lock /app/

COPY frontend/package.json /app/frontend/

WORKDIR /app/frontend

RUN bun install

COPY ./frontend /app/frontend
ARG VITE_API_URL
ARG VITE_MAX_FILE_UPLOAD_SIZE

RUN bun run build


# Stage 1, build the JupyterLite static app from source.
FROM python:3.10-slim AS jupyterlite-build

WORKDIR /app/frontend/jupyterlite

COPY ./frontend/jupyterlite/requirements.txt /app/frontend/jupyterlite/requirements.txt
# Patched jupyterlite-webr wheel referenced (relative to cwd) from requirements.txt
COPY ./frontend/jupyterlite/vendor/ /app/frontend/jupyterlite/vendor/

RUN pip install --default-timeout=100 --no-cache-dir -r requirements.txt

COPY ./frontend/jupyterlite/ /app/frontend/jupyterlite/

RUN jupyter lite build --output-dir /app/dist/


# Stage 2, based on Nginx, to have only the compiled app, ready for production with Nginx
FROM nginx:1

COPY --from=build-stage /app/frontend/dist/ /usr/share/nginx/html
COPY --from=jupyterlite-build /app/dist/ /usr/share/nginx/html/wasm/jupyterlite/

COPY ./frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY ./frontend/nginx-backend-not-found.conf /etc/nginx/extra-conf.d/backend-not-found.conf

# Prerender the public tool pages, so crawlers and social scrapers get the
# tool's own title, description and image. The script writes into the served
# directory, and the container runs it on start and on a timer.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*
COPY ./frontend/scripts/prerender.py /usr/local/bin/prerender.py
COPY ./frontend/docker-entrypoint.d/40-prerender.sh /docker-entrypoint.d/40-prerender.sh
RUN chmod +x /usr/local/bin/prerender.py /docker-entrypoint.d/40-prerender.sh
