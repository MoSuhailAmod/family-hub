# Architecture

## System shape

```mermaid
flowchart LR
  UI[Browser UI\nNext.js / React] --> HTTP[Next.js route handlers]
  HTTP --> Services[Family Hub services]
  MCP[ChatGPT-compatible client\nvia MCP] --> MCPRoute[/mcp adapter]
  MCPRoute --> Services
  Services --> Data[Data-access modules]
  Data --> PG[(PostgreSQL)]
  HTTP --> Google[Optional Google Calendar\nread integration]
  Worker[Notification worker] --> Services
  Worker --> PG
  Worker --> HA[Home Assistant\nnotification edge]
```

The browser uses Next.js App Router pages and route handlers. Calendar UI code is in `app/src/app/calendar/`; API adapters are in `app/src/app/api/`. The app is backed by PostgreSQL, with schema declarations in `app/src/db/schema.ts` and versioned Drizzle SQL in `app/drizzle/`.

The intended ownership rule is:

- **Adapters** (HTTP routes and MCP tools) translate transport input/output and choose status/error representation.
- **Services** validate and orchestrate reusable business operations. Calendar operations live in `app/src/lib/calendar-service.ts`.
- **Data access** owns SQL and persistence transactions. Calendar persistence is in `app/src/lib/calendar-data.ts`.
- **PostgreSQL** is a private implementation dependency, never a client or ChatGPT integration surface.

Calendar event CRUD and range MCP tools already follow this design: `app/src/lib/mcp/server.ts` calls the same calendar service functions used by the corresponding HTTP handlers. A few reference-data HTTP routes still call data access directly; new tools and routes should reuse the appropriate service-level behaviour rather than reimplement validation or transactions.

## One-household model

Family Hub is deliberately a single-household application. There are no `families`/`households` tenancy tables, application `users`, roles, per-household settings, or multi-tenant filters.

`family_members` are household entities used for scheduling, participation, display colours, and notification destinations. They are **not** login users or authentication identities. A future authenticated MCP connection will need distinct machine/client identities and authorization, not a reinterpretation of `family_members` as users.

This reduces tenancy and permission complexity for the current self-hosted deployment. Do not introduce multi-tenancy implicitly through new data models or APIs; that is a separate product and migration decision.

## Current modules and boundaries

- Calendar: events, participants, categories, recurrence, reminders, HTTP API, UI, and MCP tools.
- Notifications: persistent reminder delivery state, a worker process, and Home Assistant delivery at the edge.
- Shopping and spending: separate modules with their own service/data layers and tables.
- Google Calendar: optional read-side integration in the calendar API; it is not the Family Hub system of record.

Future modules such as gallery, voice, and broader tool adapters should attach at the same service boundary. External integrations belong at the edge and should not make external systems a mandatory intermediary for Family Hub core operations.
