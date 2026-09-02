# Shopping list v1 data model

**Status:** Approved design for Issue #7. This document is intentionally design-only: it does not add a Drizzle table, migration, API route, or UI.

## Purpose and boundaries

Shopping list v1 is a single-household checklist. The same domain/service layer will serve both the browser UI and future ChatGPT/MCP callers. It has stable item IDs because names are display data and duplicate names are valid.

This is the smallest coherent persisted model. Issue #8 will create the table and migration from this design; Issue #9 will implement the service/domain behavior. Neither later implementation should reopen the approved v1 field decisions without a new design decision.

## Approved persisted schema

The forthcoming PostgreSQL table is named `shopping_items`.

| Database column | Type and constraint | v1 meaning |
| --- | --- | --- |
| `id` | `uuid`, primary key, default random UUID | Stable identifier for every item. Mutations target this ID, never a name. |
| `name` | `text`, not null | Required item label. Inputs trim surrounding whitespace and reject an empty result. Duplicate values are allowed. |
| `quantity` | nullable `text` | Optional free text such as `2`, `2 x 2L`, or `500g`. It is not split into numeric and unit columns. |
| `notes` | nullable `text` | Optional free text. |
| `is_completed` | `boolean`, not null, default `false` | Whether the item is currently completed. |
| `created_at` | `timestamp with time zone`, not null, default now | Creation timestamp. |
| `updated_at` | `timestamp with time zone`, not null, default now | Last mutation timestamp. |
| `completed_at` | nullable `timestamp with time zone` | Completion timestamp while complete; `null` while incomplete. |

### Existing repository convention check

This design matches `app/src/db/schema.ts`:

- IDs use `uuid("id").defaultRandom().primaryKey()`.
- Timestamps use `timestamp("…", { withTimezone: true }).defaultNow().notNull()`.
- Drizzle migrations are generated from `app/src/db/schema.ts` into `app/drizzle` (`app/drizzle.config.ts`).

Issue #8 must follow those conventions and add only the approved `shopping_items` table/migration. No shopping migration is part of this issue.

## Expected TypeScript domain shape

The later service layer should use one canonical domain shape for API, browser, and MCP adapters:

```ts
export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  notes: string | null;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type CreateShoppingItemInput = {
  name: string;
  quantity?: string | null;
  notes?: string | null;
};

export type UpdateShoppingItemInput = {
  name?: string;
  quantity?: string | null;
  notes?: string | null;
};
```

Boundary adapters may serialize the three timestamps as ISO strings, but the service/domain layer retains the stable ID and completion fields above. Validation should follow the project’s existing `zod` convention: `name` is trimmed and must contain at least one non-whitespace character; optional text fields normalize omitted, `null`, and empty values to `null` where appropriate.

## Required behavior

### Create and duplicates

- Each create operation inserts one row and returns its newly generated stable UUID.
- Duplicate and similar names are allowed.
- v1 never auto-merges rows, increments a prior quantity, or otherwise mutates an existing row based on display text.

### Completion and restore

- Completion is not deletion.
- Marking an incomplete item complete sets `is_completed` to `true`, sets `completed_at` to the completion time, and updates `updated_at`.
- Restoring a completed item sets `is_completed` to `false`, clears `completed_at` to `null`, and updates `updated_at`.
- Completed rows stay persisted and may be rendered separately from active rows.

### Explicit delete

- Explicit remove/delete is a hard delete in v1.
- The browser UI should use a lightweight accidental-deletion safeguard, but the service deletes the row rather than adding a soft-delete/archive state.

### Deterministic list order

With no manual position column, list results are ordered exactly as follows:

1. Active items precede completed items.
2. Active items sort by `created_at ASC`, then `id ASC`.
3. Completed items sort by `completed_at DESC`, then `id ASC`.

The `id` tie-breaker makes ordering stable even when timestamps are equal.

## Explicitly deferred from v1

The following are intentionally absent from `shopping_items` and its domain model:

| Deferred candidate | Reason / v1 decision |
| --- | --- |
| `added_by_member_id` | Family members are household participants, not authenticated users; system/ChatGPT additions make attribution semantics unclear. |
| Category | Deferred. |
| Store | Deferred. |
| Normalized category or store tables | Deferred with category/store. |
| Price or budgeting | Out of scope. |
| Pantry or inventory tracking | Out of scope. |
| Barcode or product catalogue concepts | Out of scope. |
| Manual drag/reorder position | Deferred until real usage demonstrates a need. |
| Users, roles, household tenancy | Not part of the existing one-household architecture. |

## Implementation guardrails for Issues #8 and #9

- Preserve the one-household model.
- Do not create inventory, pantry, price, store, category, barcode, user, role, or tenancy structures as part of shopping v1.
- Do not add a soft-delete/archive column.
- Do not derive identity from `name`; use `id` for reads and all mutations.
- Do not create a shopping migration until Issue #8.
- Keep browser and future ChatGPT/MCP behavior behind the same service/domain layer rather than giving callers different persistence semantics.
