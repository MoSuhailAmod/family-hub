# Calendar domain and UI

## Event lifecycle

A calendar event has title, optional description/location/category, timezone-aware start and end values, an all-day flag, optional RRULE recurrence, zero or more household participants, and optional approved reminder offsets. The source-of-truth event is one `calendar_events` row; participants are stored in `event_participants`, and reminders in `calendar_event_reminders`.

`app/src/lib/validation.ts` requires a non-empty title of at most 200 characters, valid ISO date/time values, `endAt > startAt`, UUID participants/categories where supplied, unique approved reminder offsets, and valid daily/weekly/monthly/yearly RRULEs. It normalizes a leading `RRULE:` prefix away, deduplicates participant IDs, and sorts reminder offsets.

The implementation interprets timestamps and calendar presentation using `Africa/Johannesburg` in the calendar UI. Clients should provide unambiguous ISO date/time values; all-day events remain stored with timestamps and are rendered with FullCalendar's all-day semantics.

## Recurrence

`recurrence_rule` stores one RRULE against the base event; occurrences are not materialized as separate rows. `expandEventForRange` in `app/src/lib/recurrence.ts` attaches the stored start as `dtstart`, calculates the original duration, expands only the requested range, and creates a stable occurrence key of `event-id:start-iso` for recurring occurrences.

`getEventsForRange` in `app/src/lib/calendar-data.ts` fetches candidate non-recurring events that overlap the range and recurring base events that begin before the range end, then expands and sorts them in application code.

Current limitation: an update or delete targets the stored event, so it applies to the entire recurring series. The MVP has no recurrence exceptions, detached occurrences, or per-occurrence edit/delete overrides. UI text deliberately tells users that edits apply to the whole series.

## Transactional writes

`createEvent` starts a PostgreSQL transaction, inserts the event, inserts participant rows and reminders, then commits. On an error it rolls back and releases the client.

`updateEvent` starts a transaction, updates the event, replaces participant rows, removes reminders no longer selected, inserts missing reminders with conflict protection, and commits. A missing event returns `null` after rollback. This prevents a partial event/participant/reminder state. `deleteEvent` deletes the event; cascading foreign keys remove its participants and reminders.

## HTTP-to-UI path

The client calendar (`app/src/app/calendar/page.tsx`) loads active family members and categories, asks `/api/events?start=<ISO>&end=<ISO>` for the visible FullCalendar range, and transforms `CalendarOccurrence` objects to FullCalendar events. It supports Month (`dayGridMonth`), Week (`timeGridWeek`), and Agenda (`listMonth`) views, navigation, an active-member filter, and create/details/edit/delete modal flows.

Event colour is the first participant colour when available, otherwise category colour, otherwise a neutral fallback. The UI preserves category metadata but intentionally does not use category colour when a participant colour exists. At the 760px mobile breakpoint, `globals.css` hides the sidebar, provides fixed bottom navigation, makes toolbar/view controls span their available width, and condenses FullCalendar event content by hiding time/owner/repeat details. These rules preserve interaction contracts without making this document a pixel specification.

The dashboard and calendar use the same calendar data/domain shape. For public request/response contracts and shared service functions, see [APIs and services](api-and-services.md).