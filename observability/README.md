# Observability (Loki + Grafana + Apache/Traefik)

Three complementary observation points:

| Layer   | What it logs                                                | Captures                        |
| ------- | ----------------------------------------------------------- | ------------------------------- |
| Apache  | Every inbound request, real client IP (first hop)           | Scanning Apache rejects         |
| Traefik | Router/service/status/duration, JSON, sanitised             | Which tool/backend is targeted  |
| Python  | JSON access lines + `cpg.security` audit events             | Auth, permissions, uploads/runs |

Apache and Traefik are complementary, neither is complete on its own.

## 1. Fix the client IP chain first

```mermaid
Visitor -> Apache -> Traefik -> FastAPI(backend)
```

1. **Apache** (`apache-cpg-vhost.conf.example`): strip client-supplied
   forwarding headers, proxy to Traefik, log `%a` (the real visitor, since
   Apache is first). If a load balancer/CDN sits ahead, use `mod_remoteip` with
   only the trusted upstream.
2. **Traefik** (`compose.traefik.yml`): accept `X-Forwarded-*` only from Apache
   via `--entrypoints.*.forwardedheaders.trustedips=${APACHE_TRUSTED_IP}`.
   **Never** `forwardedheaders.insecure=true`.
3. **Backend**: `TRUSTED_PROXIES` (the Traefik container address/subnet) lets
   `ProxyHeaderMiddleware` resolve the real client into `request.client`.

Verify before trusting any dashboard: a controlled request must show the *same*
real IP in Apache's access log, Traefik's `ClientHost`, and the `client_ip`
field in the Python access/audit logs.

## 2. Run the stack

```bash
GRAFANA_ADMIN_PASSWORD=changethis \
docker compose -f observability/compose.obs.yml up -d
```

Promtail reads every container JSON log on the Docker engine and pushes to
Loki. Grafana is provisioned (datasource + dashboards) at `http://<host>:3000`.

Add to `.env`:

```ini
# Backend: peers allowed to set X-Forwarded-For (Traefik container/subnet).
TRUSTED_PROXIES=172.18.0.0/16
# Traefik static config: Apache's address, the peer that sets forwarded headers.
APACHE_TRUSTED_IP=10.0.0.5
# Grafana admin.
GRAFANA_ADMIN_PASSWORD=<generate>
```

## 3. Security events

The backend emits JSON events (logger `cpg.security`), parsed by Promtail into
`event`/`client_ip`/`user_id`/`reason` labels:

| Event                    | Meaning                              |
| ------------------------ | ------------------------------------ |
| `login.failed` / `login.success` | Authentication attempts        |
| `auth.token_rejected`    | Bad/stale/revoked token              |
| `auth.permission_denied` | RBAC permission denied               |
| `access.file_denied` / `access.run_denied` | Cross-user access attempt |
| `file.upload`            | File uploaded (size, type)           |
| `run.submit`             | Job submitted (tool, file count)     |

Alert-friendly patterns: a burst of `login.failed` from one `client_ip`,
`login.failed` immediately followed by `login.success` for the same `account`,
any `access.*_denied` chasing another user's `run_id`/`file_id`, or anomalous
`run.submit` / `file.upload` volume.

## 4. Logs and privacy

- Logs are bounded (`max-size`/`max-file` in `compose.yml`,
  `compose.traefik.yml`).
- Raw paths, query strings and headers (auth tokens) are **not** logged by the
  backend access log or Traefik; only coarse path (`/runs`) and routes.
- Do not enable `forwardedheaders.insecure`.