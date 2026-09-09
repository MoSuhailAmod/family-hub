# Security and trust model

## Current state

Family Hub began as a LAN-only household application. The original MVP does not implement general browser-user authentication or public web exposure. PostgreSQL is private to the Compose network and is not a supported client integration surface. This is a deployment assumption, not an authentication substitute for an internet-facing service.

Secrets are supplied through environment variables. Real `.env` files, passwords, API tokens, private endpoints with credentials, and keys must stay out of Git. Application logging must avoid emitting these values.

## MCP and external access

An MCP endpoint, including narrow Spending reconciliation tools, and calendar tools are present at `/mcp`; `POST /api/spending/reconcile` provides the equivalent trusted-LAN HTTP adapter. They call shared service layers and are not direct database interfaces. The presence of either adapter does **not** mean a general authenticated external-access boundary is complete. Before exposing MCP or the reconciliation HTTP route beyond the trusted LAN/private network, add and operate an explicit authenticated and authorized boundary.

That future boundary should provide, at minimum:

- authenticated client or machine identity distinct from `family_members`;
- least-privilege tool authorization and auditable access;
- transport protection and controlled network exposure;
- secret rotation and revocation procedures; and
- rate/error handling that does not disclose private household data.

Do not weaken LAN assumptions, expose PostgreSQL, or bypass service validation to connect ChatGPT or another external system. HTTP routes and MCP tools are adapters over the same domain logic.

## Operational principles

- Keep the app and database off the public internet unless a separately designed security boundary is deployed.
- Apply dependency and base-image updates deliberately, with normal validation and rollback readiness.
- Take a database backup before schema changes and protect backup contents like production data.
- Use least privilege for Home Assistant and future provider credentials.
- Treat household schedules, participant identities, notification destinations, shopping data, and spending data as private.

See [Deployment](deployment.md), [Backups and recovery](backups-and-recovery.md), and [Integrations](integrations.md).
