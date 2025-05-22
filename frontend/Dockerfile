###########################
# Stage 0: Build the React App
###########################
FROM node:20 AS react-build

WORKDIR /app

# Copy all files to /app. This brings in your React app and any other files.
COPY ./ /app/

# Set environment variables for the React app
ARG VITE_API_URL=${VITE_API_URL}
ARG VITE_MAX_FILE_UPLOAD_SIZE=${VITE_MAX_FILE_UPLOAD_SIZE}


# Install dependencies for the React app
RUN npm install

# Build the React app; output is in /app/dist
RUN npm run build


###########################
# Stage 1: Build the JupyterLite Static Asset
###########################
FROM python:3.10-slim AS jupyterlite-build

WORKDIR /app

# Copy all files into /app (again, this includes your jupyterlite folder)
COPY ./ /app/

# Change directory to /app/jupyterlite
WORKDIR /app/jupyterlite

# Install Python dependencies from the JupyterLite requirements file
RUN pip install --default-timeout=100 -r requirements.txt

# Build JupyterLite.
# Ensure your jupyterlite/jupyter_lite_config.json has "output_dir": "dist"
RUN jupyter lite build --output-dir /app/dist/


###########################
# Stage 2: Final Image with Nginx
###########################
FROM nginx:1

# Copy the React build output to the default Nginx directory
COPY --from=react-build /app/dist/ /usr/share/nginx/html/

# Copy the JupyterLite build output to a subdirectory (e.g., /wasm/jupyterlite)
# This assumes your JupyterLite build puts its files into /app/dist/
COPY --from=jupyterlite-build /app/dist/ /usr/share/nginx/html/wasm/jupyterlite/

# Copy custom Nginx configuration files if needed
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-backend-not-found.conf /etc/nginx/extra-conf.d/backend-not-found.conf
