# FastAPI Project - Deployment

You can deploy the project using Docker Compose to a remote server.

This project expects you to have a Traefik proxy handling communication to the outside world and HTTPS certificates.

You can use CI/CD (continuous integration and continuous deployment) systems to deploy automatically, there are already configurations to do it with GitHub Actions.

But you have to configure a couple things first. 🤓

## Preparation

* Have a remote server ready and available.
* Configure the DNS records of your domain to point to the IP of the server you just created.
* Configure a wildcard subdomain for your domain, so that you can have multiple subdomains for different services, e.g. `*.fastapi-project.example.com`. This will be useful for accessing different components, like `dashboard.fastapi-project.example.com`, `api.fastapi-project.example.com`, `traefik.fastapi-project.example.com`, `adminer.fastapi-project.example.com`, etc. And also for `staging`, like `dashboard.staging.fastapi-project.example.com`, `adminer.staging.fastapi-project.example.com`, etc.
* Install and configure [Docker](https://docs.docker.com/engine/install/) on the remote server (Docker Engine, not Docker Desktop).

## Public Traefik

We need a Traefik proxy to handle incoming connections and HTTPS certificates.

You need to do these next steps only once.

### Traefik Docker Compose

* Create a remote directory to store your Traefik Docker Compose file:

```bash
mkdir -p /root/code/traefik-public/
```

Copy the Traefik Docker Compose file to your server. You could do it by running the command `rsync` in your local terminal:

```bash
rsync -a compose.traefik.yml root@your-server.example.com:/root/code/traefik-public/
```

### Traefik Public Network

This Traefik will expect a Docker "public network" named `traefik-public` to communicate with your stack(s).

This way, there will be a single public Traefik proxy that handles the communication (HTTP and HTTPS) with the outside world, and then behind that, you could have one or more stacks with different domains, even if they are on the same single server.

To create a Docker "public network" named `traefik-public` run the following command in your remote server:

```bash
docker network create traefik-public
```

### Traefik Environment Variables

The Traefik Docker Compose file expects some environment variables to be set in your terminal before starting it. You can do it by running the following commands in your remote server.

* Create the username for HTTP Basic Auth, e.g.:

```bash
export USERNAME=admin
```

* Create an environment variable with the password for HTTP Basic Auth, e.g.:

```bash
export PASSWORD=changethis
```

* Use openssl to generate the "hashed" version of the password for HTTP Basic Auth and store it in an environment variable:

```bash
export HASHED_PASSWORD=$(openssl passwd -apr1 $PASSWORD)
```

To verify that the hashed password is correct, you can print it:

```bash
echo $HASHED_PASSWORD
```

* Create an environment variable with the domain name for your server, e.g.:

```bash
export DOMAIN=fastapi-project.example.com
```

* Create an environment variable with the email for Let's Encrypt, e.g.:

```bash
export EMAIL=admin@example.com
```

**Note**: you need to set a different email, an email `@example.com` won't work.

### Start the Traefik Docker Compose

Go to the directory where you copied the Traefik Docker Compose file in your remote server:

```bash
cd /root/code/traefik-public/
```

Now with the environment variables set and the `compose.traefik.yml` in place, you can start the Traefik Docker Compose running the following command:

```bash
docker compose -f compose.traefik.yml up -d
```

## Deploy the FastAPI Project

Now that you have Traefik in place you can deploy your FastAPI project with Docker Compose.

**Note**: You might want to jump ahead to the section about Continuous Deployment with GitHub Actions.

## Copy the Code

```bash
rsync -av --filter=":- .gitignore" ./ root@your-server.example.com:/root/code/app/
```

Note: `--filter=":- .gitignore"` tells `rsync` to use the same rules as git, ignore files ignored by git, like the Python virtual environment.

## Environment Variables

You need to set some environment variables first.

### Generate secret keys

Some environment variables in the `.env` file have a default value of `changethis`.

You have to change them with a secret key, to generate secret keys you can run the following command:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the content and use that as password / secret key. And run that again to generate another secure key.

### Required Environment Variables

Set the `ENVIRONMENT`, by default `local` (for development), but when deploying to a server you would put something like `staging` or `production`:

```bash
export ENVIRONMENT=production
```

Set the `DOMAIN`, by default `localhost` (for development), but when deploying you would use your own domain, for example:

```bash
export DOMAIN=fastapi-project.example.com
```

Set the `POSTGRES_PASSWORD` to something different than `changethis`:

```bash
export POSTGRES_PASSWORD="changethis"
```

Set the `SECRET_KEY`, used to sign tokens:

```bash
export SECRET_KEY="changethis"
```

Note: you can use the Python command above to generate a secure secret key.

Set the `FIRST_SUPER_USER_PASSWORD` to something different than `changethis`:

```bash
export FIRST_SUPERUSER_PASSWORD="changethis"
```

Set the `BACKEND_CORS_ORIGINS` to include your domain:

```bash
export BACKEND_CORS_ORIGINS="https://dashboard.${DOMAIN?Variable not set},https://api.${DOMAIN?Variable not set}"
```

Set the credentials of Redis and NATS, which carry the task queue and the live
output of runs. Anything on the Docker network can reach those ports, so a
compromised tool run could otherwise read them (see the tool sandbox section):

```bash
export NATS_USER=portal
export REDIS_PASSWORD="changethis"
export NATS_PASSWORD="changethis"
```

Docker Compose builds `REDIS_URI` and `NATS_URIS` from these, so the services and
the backend always use the same credentials. Use the `python` command above to
generate secure values.

You can set several other environment variables:

* `PROJECT_NAME`: The name of the project, used in the API for the docs and emails.
* `STACK_NAME`: The name of the stack used for Docker Compose labels and project name, this should be different for `staging`, `production`, etc. You could use the same domain replacing dots with dashes, e.g. `fastapi-project-example-com` and `staging-fastapi-project-example-com`.
* `BACKEND_CORS_ORIGINS`: A list of allowed CORS origins separated by commas.
* `FIRST_SUPERUSER`: The email of the first superuser, this superuser will be the one that can create new users.
* `SMTP_HOST`: The SMTP server host to send emails, this would come from your email provider (E.g. Mailgun, Sparkpost, Sendgrid, etc).
* `SMTP_USER`: The SMTP server user to send emails.
* `SMTP_PASSWORD`: The SMTP server password to send emails.
* `EMAILS_FROM_EMAIL`: The email account to send emails from.
* `POSTGRES_SERVER`: The hostname of the PostgreSQL server. You can leave the default of `db`, provided by the same Docker Compose. You normally wouldn't need to change this unless you are using a third-party provider.
* `POSTGRES_PORT`: The port of the PostgreSQL server. You can leave the default. You normally wouldn't need to change this unless you are using a third-party provider.
* `POSTGRES_USER`: The Postgres user, you can leave the default.
* `POSTGRES_DB`: The database name to use for this application. You can leave the default of `app`.
* `REDIS_PASSWORD`: Password of the Redis service, compose uses it to build `REDIS_URI`.
* `NATS_USER`, `NATS_PASSWORD`: Credentials of the NATS service, compose uses them to build `NATS_URIS`.
* `SANDBOX_ENABLED`, `SANDBOX_IMAGE`, `SANDBOX_NETWORK`, `SANDBOX_DNS`, `SANDBOX_DATA_PATH`: See the tool sandbox section.
* `TOTAL_CPUS`: CPUs the worker hands out to runs, `0` detects them. See the threads section.
* `SENTRY_DSN`: The DSN for Sentry, if you are using it.

## GitHub Actions Environment Variables

There are some environment variables only used by GitHub Actions that you can configure:

* `LATEST_CHANGES`: Used by the GitHub Action [latest-changes](https://github.com/tiangolo/latest-changes) to automatically add release notes based on the PRs merged. It's a personal access token, read the docs for details.
* `SMOKESHOW_AUTH_KEY`: Used to handle and publish the code coverage using [Smokeshow](https://github.com/samuelcolvin/smokeshow), follow their instructions to create a (free) Smokeshow key.

### Deploy with Docker Compose

With the environment variables in place, you can deploy with Docker Compose:

```bash
cd /root/code/app/
docker compose -f compose.yml build
docker compose -f compose.yml up -d
```

For production you wouldn't want to have the overrides in `compose.override.yml`, that's why we explicitly specify `compose.yml` as the file to use.

## Tool Sandbox (Apptainer)

Tool commands are arbitrary pipelines defined by tool authors, so the worker
does not execute them directly. Every run is executed inside an
[Apptainer](https://apptainer.org/) container that only sees the run's working
directory (read-write), its input files (read-only), a scratch directory
(read-write, used as `/tmp`) and the tool's conda environment (read-only). See
`backend/app/sandbox.py`.

The reference data directory (`SANDBOX_DATA_PATH`, `/DB` by default, i.e. the
`./DB` directory of the httpOnly stack) is mounted read-only into every run at
the same path, so tools can read curated databases without copying them. Keep
secrets out of it.

Nothing else is visible: a tool command has to work with its inputs, the
reference data, files it creates in the working directory, and its conda
environment. Tools that reach for other paths fail at runtime.

`SANDBOX_NETWORK` in `.env` decides what a run can reach:

* `none` (default): its own network namespace with a loopback interface only, so
  it cannot reach the database, redis, nats, other containers or the internet.
* `internet`: its own network namespace, masqueraded out of the worker so it can
  download from the internet, while every private address is dropped. Tools like
  "Download Genome" (NCBI Datasets) work; the database, redis and nats stay out
  of reach. `SANDBOX_DNS` (default `1.1.1.1`) is the resolver runs use, and it
  stays reachable even when it lives on a private address.
* `host`: the worker's network namespace, i.e. everything the worker can reach.
  Only useful for debugging a tool.

The worker applies the `internet` rules before it starts, from
`scripts/sandbox_setup.sh` in its command. They match traffic from the
sandbox subnet only, so the worker keeps its own access to the database, redis
and nats while a run is in progress.

Whichever mode you use, the neighbouring services are the next line of defence:
Postgres, Redis and NATS all require credentials that are not part of a run's
environment (see [Required Environment Variables](#required-environment-variables)).
Prefer fetching reference data while a tool is installed, or placing it in a
read-only volume, over giving runs network access.

This requires:

* The `worker` service to be privileged (`privileged: true` in `compose.yml`):
  Apptainer needs `SYS_ADMIN` and the loop devices of the host to create the
  container. The container it creates runs without privileges, with a read-only
  root filesystem, private namespaces and a cleaned environment, so it cannot
  see the worker's filesystem, `/storage`, or the worker's environment variables.
* A sandbox image in the `app-sandbox-data` volume. The `prestart` service builds
  it on the first `docker compose up` if it is missing. Rebuild it after changing
  `backend/container/runtime.def`:

```bash
docker compose -f compose.yml exec worker bash scripts/build_sandbox_image.sh
```

Until the image exists, runs fail with `Sandbox image '/apptainer/runtime.sif'
was not found`. `SANDBOX_ENABLED=false` in `.env` runs tool commands directly on
the worker again (not recommended), and `SANDBOX_IMAGE` points the worker at a
different image, e.g. one pulled from a registry with `apptainer pull`.

The build runs its `%post` section inside a user namespace, so the host has to
allow unprivileged user namespaces. On hosts where AppArmor restricts them, e.g.
Ubuntu 24.04 and later, add `apparmor=unconfined` to `security_opt` of the
`prestart` service.

Tools that need system packages which are neither in the sandbox image nor in
their conda environment fail at runtime; add them to
`backend/container/runtime.def` and rebuild.

## Public Tool Pages (Prerendering)

Tool pages (`/tools/<name>`) are prerendered into the directory nginx serves, so
crawlers and social scrapers - which never run JavaScript - get each tool's own
title, description, image, canonical URL and a summary listing its versions,
tags, parameters and links (home page, documentation, GitHub repository, DOI,
license and citation). Each file
is the app's own shell, so a browser loads the SPA over it and hydrates: visitors
always read the live catalogue from the API, and adding or editing a tool needs
no rebuild.

The frontend container runs `frontend/scripts/prerender.py` at start and then
every `PRERENDER_INTERVAL_SECONDS` (default 21600, six hours). It writes
`/tools/<name>.html` for every tool name, plus `sitemap.xml` and `robots.txt`,
into `/usr/share/nginx/html`; nginx serves `/tools/<name>` from the matching
`<name>.html` file and falls back to the app for everything else.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PRERENDER_ENABLED` | `true` | `false` skips prerendering altogether |
| `PRERENDER_API_URL` | `http://backend:8000/api/v1` | where the catalogue is read from |
| `PRERENDER_SITE_URL` | - | public origin, e.g. `https://dashboard.example.org`. Without it pages carry no canonical URL and no sitemap is written |
| `PRERENDER_INTERVAL_SECONDS` | `21600` | refresh interval; `0` prerenders once and exits |
| `PRERENDER_SITE_DIR` | `/usr/share/nginx/html` | the served directory |

`compose.yml`, `docker-compose.httpOnly.yml` and `compose.override.yml` set
`PRERENDER_SITE_URL` already. To refresh sooner than the interval, restart the
container or run a single pass:

```bash
docker compose restart frontend
docker compose exec -e PRERENDER_INTERVAL_SECONDS=0 frontend /usr/local/bin/prerender.py
```

## Threads and CPU Scheduling

Every run reserves a number of CPUs (threads), and the worker only hands out
`TOTAL_CPUS` of them (`0` detects the CPUs available to the worker):

* each tool has `max_cpus` (the most a run of that tool may use) and
  `default_cpus` (used when the user picks nothing),
* each user has `max_cpus`, a limit per job,
* a run may ask for 1 up to `min(tool.max_cpus, user.max_cpus)` threads, and gets
  `min(tool.default_cpus, that maximum)` when it asks for nothing,
* runs stay `pending` until the CPUs they asked for are free: three runs of 5
  threads on a 10 CPU worker start two and leave the third queued until one of
  them finishes,
* each container gets exactly those CPUs through `apptainer exec --cpus N`.

`scripts/sandbox_setup.sh`, which the worker runs before it starts, delegates
the container's cgroup controllers so apptainer can apply that limit (the worker
container has no systemd, and the image sets `systemd cgroups = no`). A worker
started without it fails runs with "This worker cannot limit runs to their CPUs"
instead of running them unlimited.

Existing tools and users start at one and four threads; raise them per tool and
per user, for example with `PATCH /api/v1/tools/{id}` and
`PATCH /api/v1/users/{id}`.

## Continuous Deployment (CD)

You can use GitHub Actions to deploy your project automatically. 😎

You can have multiple environment deployments.

There are already two environments configured, `staging` and `production`. 🚀

### Install GitHub Actions Runner

* On your remote server, create a user for your GitHub Actions:

```bash
sudo adduser github
```

* Add Docker permissions to the `github` user:

```bash
sudo usermod -aG docker github
```

* Temporarily switch to the `github` user:

```bash
sudo su - github
```

* Go to the `github` user's home directory:

```bash
cd
```

* [Install a GitHub Action self-hosted runner following the official guide](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/adding-self-hosted-runners#adding-a-self-hosted-runner-to-a-repository).

* When asked about labels, add a label for the environment, e.g. `production`. You can also add labels later.

After installing, the guide would tell you to run a command to start the runner. Nevertheless, it would stop once you terminate that process or if your local connection to your server is lost.

To make sure it runs on startup and continues running, you can install it as a service. To do that, exit the `github` user and go back to the `root` user:

```bash
exit
```

After you do it, you will be on the previous user again. And you will be on the previous directory, belonging to that user.

Before being able to go the `github` user directory, you need to become the `root` user (you might already be):

```bash
sudo su
```

* As the `root` user, go to the `actions-runner` directory inside of the `github` user's home directory:

```bash
cd /home/github/actions-runner
```

* Install the self-hosted runner as a service with the user `github`:

```bash
./svc.sh install github
```

* Start the service:

```bash
./svc.sh start
```

* Check the status of the service:

```bash
./svc.sh status
```

You can read more about it in the official guide: [Configuring the self-hosted runner application as a service](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/configuring-the-self-hosted-runner-application-as-a-service).

### Configure GitHub Environments

The deployment workflows use [GitHub Environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) for `staging` and `production`. This enables environment-specific secrets, deployment protection rules (e.g. required reviewers, wait timers), and deployment status tracking.

To configure them, go to your repository's **Settings** > **Environments** and create the `staging` and `production` environments.

### Set Secrets

For each GitHub Environment (`staging` and `production`), configure the required secrets as [environment secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#creating-secrets-for-an-environment). Environment secrets are preferred over [repository secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#creating-secrets-for-a-repository) because they are scoped to the specific environment, reducing exposure and aligning with any protection rules you configure.

The current Github Actions workflows expect these secrets:

* `DOMAIN_PRODUCTION`
* `DOMAIN_STAGING`
* `STACK_NAME_PRODUCTION`
* `STACK_NAME_STAGING`
* `EMAILS_FROM_EMAIL`
* `FIRST_SUPERUSER`
* `FIRST_SUPERUSER_PASSWORD`
* `POSTGRES_PASSWORD`
* `REDIS_PASSWORD`
* `NATS_PASSWORD`
* `SECRET_KEY`
* `LATEST_CHANGES`
* `SMOKESHOW_AUTH_KEY`

## GitHub Action Deployment Workflows

There are GitHub Action workflows in the `.github/workflows` directory already configured for deploying to the environments (GitHub Actions runners with the labels):

* `staging`: after pushing (or merging) to the branch `master`.
* `production`: after publishing a release.

Both workflows are associated with their respective GitHub Environments, so deployments will be visible in the repository's **Environments** section and will respect any protection rules you configure.

If you need to add extra environments you could use those as a starting point.

## URLs

Replace `fastapi-project.example.com` with your domain.

### Main Traefik Dashboard

Traefik UI: `https://traefik.fastapi-project.example.com`

### Production

Frontend: `https://dashboard.fastapi-project.example.com`

Backend API docs: `https://api.fastapi-project.example.com/docs`

Backend API base URL: `https://api.fastapi-project.example.com`

Adminer: `https://adminer.fastapi-project.example.com`

### Staging

Frontend: `https://dashboard.staging.fastapi-project.example.com`

Backend API docs: `https://api.staging.fastapi-project.example.com/docs`

Backend API base URL: `https://api.staging.fastapi-project.example.com`

Adminer: `https://adminer.staging.fastapi-project.example.com`
