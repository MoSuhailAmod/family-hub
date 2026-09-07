# Issue #46: v1 notification persistence design

## Scope and ownership

This design persists Family Hub-owned reminder intent and delivery state. Home Assistant remains only a delivery provider; no Home Assistant URL, token, or transport configuration appears in these tables. Google/ICS events remain display-only because reminder rows can reference only persisted `calendar_events` records.

## Tables

### `calendar_event_reminders`

| Column | Decision |
| --- | --- |
| `id` | UUID primary key |
| `event_id` | non-null FK to `calendar_events`, `ON DELETE CASCADE` |
| `offset_minutes` | non-null integer restricted to 10, 30, 60, 1440, or 10080 |
| timestamps | `created_at`, `updated_at` |

A unique constraint on `(event_id, offset_minutes)` prevents duplicate reminder presets. Cascading event deletion removes reminder intent before a future worker can claim it.

### `notification_destinations`

| Column | Decision |
| --- | --- |
| `id` | UUID primary key |
| `family_member_id` | non-null FK to `family_members`, `ON DELETE CASCADE` |
| `provider` | non-null provider identifier; v1 uses `home_assistant` |
| `target` | non-null opaque provider target, for example a `mobile_app_<device_id>` service suffix |
| `label` | optional human-readable device label |
| `enabled` | non-null boolean, default `true` |
| timestamps | `created_at`, `updated_at` |

A unique constraint on `(provider, target)` prevents the same provider target from being assigned twice under different family members. `family_member_id` is intentionally not unique, allowing multiple devices per member.

### `notification_deliveries`

| Column | Decision |
| --- | --- |
| `id` | UUID primary key |
| `reminder_id` | non-null FK to `calendar_event_reminders`, `ON DELETE CASCADE` |
| `destination_id` | non-null FK to `notification_destinations`, `ON DELETE CASCADE` |
| `occurrence_key` | non-null Family Hub occurrence key: event ID for a non-recurring event, or `event-id:ISO-start` for recurring events |
| `scheduled_for` | non-null provider-eligible instant |
| `status` | non-null durable delivery state, default `pending` |
| `attempt_count` | non-null integer, default `0` |
| `next_attempt_at` | nullable retry eligibility time |
| `last_attempted_at` | nullable attempt timestamp |
| `delivered_at` | nullable provider-acceptance timestamp |
| `last_error` | nullable safe error summary—never a token/header/body dump |
| timestamps | `created_at`, `updated_at` |

The unique constraint `(reminder_id, occurrence_key, destination_id)` is the database idempotency boundary: one intended reminder occurrence for one destination can exist once, across worker retries and restarts. Deleting an event or reminder cascades pending delivery rows, so obsolete work cannot fire. A worker must still join reminders and events while claiming work, allowing it to ignore any work that has become invalid between selection and send.

## Indexes and migration discipline

The migration adds an index on delivery claim fields `(status, next_attempt_at, scheduled_for)` and an index on `calendar_event_reminders.event_id`. All changes are additive: three new tables, constraints, foreign keys, and indexes only. No existing Calendar or Shopping schema/data is altered.

Generate the migration through `drizzle-kit generate`, inspect the emitted SQL, and apply it only through the normal Family Hub backup/migration procedure. Host application and database verification remain outside this repository-side task.
