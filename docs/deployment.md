# Deployment and operations

## Current deployment model

Family Hub is self-hosted in the home Proxmox environment, in the Debian 13 LXC named `family-hub`. The deployed repository path is `/opt/family-hub`. The expected local timezone for calendar presentation and household operations is `Africa/Johannesburg`.

The root `compose.yaml` defines four services:

| Service | Role |
| --- | --- |
| `postgres` | PostgreSQL 17 database with a named `postgres_data` volume and `pg_isready` health check. |
| `migrate` | One-shot application container that runs `npm run db:migrate` after PostgreSQL is healthy. |
| `app` | Next.js production server on container port 3000, published as host port 3000. |
| `notification-worker` | Long-running process running `npm run notifications:worker` after migrations succeed. |

The app and worker communicate with PostgreSQL on the Compose network. PostgreSQL is not published as a host port by this Compose file. LAN access to the web application is intentional; public exposure is not part of the original trust model. Do not put private addresses, tokens, or passwords in this documentation.

## Configuration and secrets

Copy the tracked `.env.example` only to create a local/deployment `.env`; never commit real values. Compose supplies database credentials through environment variables and constructs `DATABASE_URL` inside the application containers. The notification worker also receives Home Assistant configuration. Optional Google Calendar configuration is passed only to the app service.

Keep `.env`, tokens, passwords, URLs carrying credentials, and private certificates outside Git. See [Security](security.md).

## Startup, restart, update

Run these from `/opt/family-hub` on the deployment LXC after reviewing the change and taking the required backup:

```bash
docker compose up -d --build
docker compose ps
curl --fail http://localhost:3000/api/health/db
```

`migrate` must complete successfully before `app` and `notification-worker` start. For a source update, fetch the intended Git revision, review migration files and Compose changes, back up PostgreSQL first, then run the same `docker compose up -d --build` sequence. Use `docker compose logs --tail=100 migrate app notification-worker` when startup is not healthy.

## Runtime verification

1. `docker compose ps` shows PostgreSQL healthy, the migration task completed successfully, and app/worker running.
2. `curl --fail http://localhost:3000/api/health/db` returns `ok: true` without exposing a credential.
3. Open the LAN dashboard and load a calendar range.
4. If reminder delivery changed, inspect worker logs and exercise a non-production-safe test only according to the notification module's operational plan.

The health endpoint verifies database connectivity, not every dependency or business operation. Treat container status and application behaviour as separate checks.
