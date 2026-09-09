# Family Hub technical documentation

This is the implementation-level source of truth for Family Hub. The [root README](../README.md) remains the concise product overview.

## Read this first

- [Architecture](architecture.md) — component boundaries, one-household scope, and adapter/service direction.
- [Deployment](deployment.md) — self-hosted Compose topology, operational checks, and update flow.
- [Database](database.md) — Drizzle schema, relationships, migrations, and seed data.
- [Calendar and recurrence](calendar-and-recurrence.md) — event domain rules, expansion, transactions, and UI behaviour.
- [APIs and services](api-and-services.md) — HTTP/MCP adapters and calendar contracts.
- [Spending imports](spending-imports.md) — normal Markdown uploads, canonical import mapping, and validation rules.
- [Security](security.md) — current trust model and future authenticated integration boundary.
- [Backups and recovery](backups-and-recovery.md) — backup, restore, and migration recovery discipline.
- [Integrations](integrations.md) — implemented and proposed edge integrations.

## Documentation maintenance

Update the document that owns a decision in the same pull request as the affected implementation whenever practical. Prefer linking to that owner over repeating the same explanation. These documents describe committed behaviour; planned work is explicitly marked as such.

Repository paths in this guide are relative to the repository root unless stated otherwise.
