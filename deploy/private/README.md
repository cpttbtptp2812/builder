# OwnAgent private deployment

This directory is an opt-in Compose overlay for a single-host private/OEM
installation. It uses the repository's existing `Dockerfile` without changing
the root `docker-compose.yml`.

The stack contains:

- `app`: OwnAgent API and SQLite runtime;
- `frontend-assets`: one-shot copy of the frontend already built into the app
  image;
- `nginx`: same-origin static UI and `/api/` reverse proxy;
- named volumes for SQLite data and generated frontend assets.

These files are deployment templates only. They do not publish an image,
package, release, or hosted service.

## Start

From the repository root:

```powershell
Copy-Item deploy/private/.env.example deploy/private/.env
# Edit deploy/private/.env before continuing.
docker compose --env-file deploy/private/.env `
  -f deploy/private/docker-compose.private.yml up -d --build
```

Open `http://localhost:8080` (or the port selected by
`PRIVATE_HTTP_PORT`). Verify the API:

```powershell
Invoke-RestMethod http://localhost:8080/api/health
```

Inspect status and logs:

```powershell
docker compose --env-file deploy/private/.env `
  -f deploy/private/docker-compose.private.yml ps
docker compose --env-file deploy/private/.env `
  -f deploy/private/docker-compose.private.yml logs -f app nginx
```

Stop the services without deleting data:

```powershell
docker compose --env-file deploy/private/.env `
  -f deploy/private/docker-compose.private.yml down
```

Do not add `--volumes` unless the persisted SQLite database is intentionally
being deleted.

## Configuration

Before first start:

1. Replace `ADMIN_PASSWORD` with a long unique value.
2. Set unique `OWNAGENT_BOOTSTRAP_TOKEN` and `OWNAGENT_INGEST_KEY` values.
3. Set `CORS_ORIGINS` to the exact externally visible UI origin. List multiple
   origins with commas.
4. Configure `DEEPSEEK_API_KEY` or `OPENAI_API_KEY` and align
   `LLM_BASE_URL`/`LLM_MODEL` with that provider.
5. Set `PROBE_URL` to the externally reachable UI URL if release inspection
   must probe the installation.

OEM display values such as application name, logo, description, and theme are
managed through the existing admin configuration after deployment. This
overlay does not invent environment variables that the current runtime does
not consume.

## Production boundary

The bundled Nginx configuration serves plain HTTP. For production, place it
behind a trusted ingress or reverse proxy that terminates TLS and applies the
organization's authentication, IP allow-list, request limits, and audit
controls. Only the Nginx port is published; the app port remains on the
Compose network.

OwnAgent includes local users, bearer sessions, environment RBAC and release
approvals. Bootstrap the first admin through `/api/team/bootstrap` with the
`x-bootstrap-token` header. This deployment does not claim OIDC/SSO or tenant
isolation; put enterprise identity enforcement at the trusted ingress until an
OIDC adapter is configured.

## Persistence and upgrades

SQLite is stored in the Compose-managed `ownagent-data` volume at
`/data/builder.db`. Back up that volume before rebuilding or upgrading.

`frontend-assets` is disposable and is refreshed from `/app/dist` each time
the one-shot asset service runs. Rebuild after source changes:

```powershell
docker compose --env-file deploy/private/.env `
  -f deploy/private/docker-compose.private.yml up -d --build
```

The local image tag is controlled by `OWNAGENT_IMAGE_TAG`; no registry push is
performed by these commands.
