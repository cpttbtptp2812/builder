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

Before starting, place the customer's TLS certificate and private key at
`deploy/private/certs/fullchain.pem` and `deploy/private/certs/privkey.pem`.
Open `https://localhost:8443` (or the port selected by
`PRIVATE_HTTPS_PORT`). Verify the API:

```powershell
Invoke-RestMethod https://localhost:8443/api/health
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
4. The default private-deployment policy is operator BYOK: each operator's Key
   stays in that browser and is sent only for the current HTTPS model call.
   Leave shared provider keys empty unless the customer chooses a shared-key policy.
5. Set `PROBE_URL` to the externally reachable UI URL if release inspection
   must probe the installation.

OEM display values such as application name, logo, description, and theme are
managed through the existing admin configuration after deployment. This
overlay does not invent environment variables that the current runtime does
not consume.

## Production boundary

The bundled Nginx configuration serves TLS 1.2/1.3 and requires a customer
certificate. It adds HSTS, CSP and browser security headers. A trusted ingress
may still provide enterprise identity or an IP allow-list. Only the Nginx TLS
port is published; the app port remains on the Compose network.

OwnAgent includes local users, bearer sessions, environment RBAC and release
approvals. Bootstrap the first admin through `/api/team/bootstrap` with the
`x-bootstrap-token` header. This deployment does not claim OIDC/SSO or tenant
isolation; put enterprise identity enforcement at the trusted ingress until an
OIDC adapter is configured.

## Persistence and upgrades

SQLite is stored in the Compose-managed `ownagent-data` volume at
`/data/builder.db`. The `backup` service creates an integrity-checked online
backup every 24 hours and keeps 14 days by default. `BACKUP_HOST_PATH` is
mandatory and must point to a separately replicated disk, NAS, or
object-storage mount; a directory on the application data disk is not
disaster recovery.

Before every upgrade, run an extra backup:

```powershell
docker compose --env-file deploy/private/.env `
  -f deploy/private/docker-compose.private.yml exec app `
  npx tsx server/backup.ts /backups/pre-upgrade.db
```

Restore drill: stop the stack, copy a selected backup to a new volume as
`builder.db`, start the stack, then verify `/api/ready`, login, the live skill
versions, and one completed process. Target RPO is 24 hours and target RTO is
4 hours. Record each drill date and result outside this repository.

`frontend-assets` is disposable and is refreshed from `/app/dist` each time
the one-shot asset service runs. Rebuild after source changes:

```powershell
docker compose --env-file deploy/private/.env `
  -f deploy/private/docker-compose.private.yml up -d --build
```

The local image tag is controlled by `OWNAGENT_IMAGE_TAG`; no registry push is
performed by these commands.

## Data lifecycle and pilot

- Keep process records and audit logs only for the period agreed with the
  customer. Before deletion, export any records subject to legal retention.
- Use the authenticated product APIs for business exports. Never copy the live
  SQLite or WAL files while the service is running; use an integrity-checked
  backup.
- A deletion request must cover the process, uploaded datasets, session
  ownership, and associated audit identifier, and must itself be audit logged.
- Rotate or remove browser-stored personal Keys when an operator leaves; they
  are not included in server backups.

Before production status is claimed, complete
[`docs/PILOT-RUNBOOK.md`](../../docs/PILOT-RUNBOOK.md) with one customer for 14
days. A deployment that has only passed automation is pilot-ready, not yet
customer-proven.
