# APIs and shared services

## Adapter rule

HTTP route handlers and MCP tools are adapters. Reusable calendar validation and operation sequencing belong in `app/src/lib/calendar-service.ts`; persistence lives in `app/src/lib/calendar-data.ts`. Calendar event CRUD and range MCP tools invoke those same service functions as their corresponding browser routes, so those operations do not have separate business implementations. Some simple reference-data HTTP routes currently call data access directly.

## Calendar HTTP API

| Method/path | Purpose | Success response |
| --- | --- | --- |
| `GET /api/events?start=<ISO>&end=<ISO>` | List Family Hub occurrences overlapping the requested range; currently appends optional Google Calendar read-side events when configured. | `200 { "items": CalendarOccurrence[] }` |
| `POST /api/events` | Create a Family Hub event. | `201 { "event": CalendarEvent }` |
| `GET /api/events/:id` | Get a stored Family Hub event by UUID. | `200 { "event": CalendarEvent }` |
| `PATCH /api/events/:id` | Replace the event input and its participants/reminders. For recurring events this changes the whole series. | `200 { "event": CalendarEvent }` |
| `DELETE /api/events/:id` | Delete a stored event/series. | `204` |
| `GET /api/family-members` | List active household members. | `200 { "items": FamilyMember[] }` |
| `GET /api/event-categories` | List active event categories. | `200 { "items": EventCategory[] }` |
| `GET /api/health/db` | Verify database connectivity. | `200 { "ok": true, ... }` |
| `POST /api/spending/reconcile` | Validate and reconcile a structured cumulative Spending snapshot through the shared reconciliation service. | `200 { "success": true, "summary": ... }` |

The event input contract is defined by `eventInputSchema` in `app/src/lib/validation.ts`: `title`, `startAt`, and `endAt` are required; `description`, `location`, `categoryId`, and `recurrenceRule` are nullable/optional; `allDay`, `participantIds`, and `reminderOffsets` default when absent. Refer to [Calendar and recurrence](calendar-and-recurrence.md) for detailed validation and recurrence behaviour.

Validation failures are returned as HTTP 400 with `{ error, details }`; missing events return 404 where applicable; unexpected route failures return 500. `listCalendarEventsService` also rejects absent/invalid ranges and `end <= start`.

## Service operations

- `getFamilyMembersService()` and `getEventCategoriesService()` list active reference data.
- `listCalendarEventsService(start, end)` validates a range and returns expanded occurrences.
- `getCalendarEventService(id)` returns `NOT_FOUND` when absent.
- `createCalendarEventService(input)` and `updateCalendarEventService(id, input)` parse `EventInput` and return `VALIDATION_ERROR` rather than adapter-specific validation.
- `deleteCalendarEventService(id)` returns either a deletion acknowledgement or `NOT_FOUND`.

Service results use `{ success: true, data }` or `{ success: false, code, error, details? }`, allowing route handlers and MCP tools to translate the same domain result consistently.

## MCP adapter

`/mcp` is a Node runtime handler. The current server exposes health, family-member/category listing, calendar list/get/create/update/delete, and Spending tools. The Spending adapter provides `spending_reconcile_snapshot` (with a `{ snapshot }` argument), plus `spending_list_periods`, `spending_get_period`, and `spending_list_imports` for reconciliation review. It serializes service results as text content and marks failed service results as MCP errors. It does not duplicate calendar or Spending validation/persistence logic.

`POST /api/spending/reconcile` accepts the same `spending-reconciliation/v1` snapshot shape used by the shared service and returns machine-readable `{ success, summary }` outcomes. It returns `{ success: false, code, error }` with `400` for malformed/invalid payloads, `409` for invalid domain state transitions, `413` when the body exceeds 5 MB, and `500` for persistence failures. It is deliberately an adapter, not a direct database endpoint.

The endpoint must not be treated as a fully deployed external-access solution merely because the adapter exists. Any ChatGPT or remote client connectivity needs a separately designed authenticated boundary; see [Security](security.md) and [Integrations](integrations.md).