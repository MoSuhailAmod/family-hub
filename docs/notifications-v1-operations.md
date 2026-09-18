# Family Hub v1 notifications: architecture and operations

## Scope and ownership

Family Hub owns calendar reminder intent, scheduling, retry decisions, durable delivery state, and recipient routing. Home Assistant is the only v1 transport provider. This implementation does not add Web Push, APNs/FCM, SMS, email, WhatsApp, quiet hours, snooze, escalation chains, recipient overrides, recurrence exceptions, or Google Calendar reminder sync.

Only persisted Family Hub `calendar_events` can have reminder rules. Google/ICS events remain display-only and cannot create Family Hub deliveries.

## Persistence model

- `calendar_event_reminders` stores approved event-scoped offsets: `10`, `30`, `60`, `1440`, and `10080` minutes. `(event_id, offset_minutes)` is unique.
- `notification_destinations` stores Home Assistant `mobile_app_<device_id>` service suffixes, an optional label, and enabled state. A member can have multiple destinations; the same provider/target cannot be assigned twice.
- `notification_deliveries` is the durable per-reminder, per-occurrence, per-destination record. Its unique `(reminder_id, occurrence_key, destination_id)` index is the idempotency boundary. It records `status`, `attempt_count`, `last_attempted_at`, `next_attempt_at`, `delivered_at`, and a secret-safe `last_error`.

Deleting a persisted event or reminder cascades its delivery rows. Destination changes or disablement are checked again atomically while a delivery is claimed, so stale discovery data is not dispatched.

## Scheduling, identity, and routing

The worker runs as the Docker Compose `notification-worker` service and starts a cycle immediately, then every minute. It discovers due persisted reminders, expands recurring events, and computes an occurrence key as either the event ID (non-recurring) or `event-id:ISO-occurrence-start` (recurring). Each recurrence occurrence is therefore independent, while repeated scans of the same occurrence share one durable delivery identity.

The current event, reminder, participant mapping, destination enabled flag, target, and schedule are revalidated inside the claim transaction. If a time, offset, recurrence, participant, destination, event, or reminder changes after discovery, obsolete work is not sent. Empty participant lists and participants without enabled destinations produce no household notification.

Every enabled destination of every current participant receives its own delivery identity. A successful destination is marked `delivered` independently, so another destination's retry cannot resend it.

All user-visible time calculations use `Africa/Johannesburg`. Timed events use their actual start instant. All-day events use an 08:00 Africa/Johannesburg anchor (06:00 UTC); their date-only storage representation is never treated as a midnight notification time. Reminder offsets may cross midnight, month, or year boundaries because scheduling subtracts the offset from the calculated occurrence anchor.

## Retry, recovery, and expiry

The catch-up/usefulness window is 15 minutes. A reminder older than that window is persisted as `expired` and is never sent stale.

On provider acceptance, the delivery becomes `delivered` and retries stop. `network`, `timeout`, and generic provider failures are transient: the same delivery record changes to `retrying` with `next_attempt_at` one minute later, matching the worker cadence. Authentication, configuration, invalid-target, and unsupported-provider failures become `failed` and are not retried.

A retry may be claimed only when its one-minute deterministic backoff is due and the scheduled time is still inside the 15-minute window. A `sending` record becomes recoverable only when its last attempt is at least two minutes old; this prevents overlapping worker cycles or a short restart from duplicating an in-flight delivery while permitting recovery after an interrupted worker/container/Compose restart.

## Home Assistant configuration and destination setup

The `notification-worker` Compose service requires these runtime environment variables; keep their values out of source control, logs, fixtures, and PRs:

```dotenv
HOME_ASSISTANT_URL=https://home-assistant.example.invalid
HOME_ASSISTANT_TOKEN=replace-with-a-dedicated-long-lived-token
```

Create a dedicated long-lived Home Assistant token and configure a current Companion App notify service suffix such as `mobile_app_example_phone` as the destination target for the correct Family Hub member. The service validates that target format before sending. Family Hub POSTs to Home Assistant's `notify.mobile_app_<device>` service and logs only safe delivery metadata (correlation ID, provider, target, result, failure kind, and HTTP status); tokens, headers, and bodies are not logged.

## Runtime checks and troubleshooting

Run these commands from the deployed repository directory:

```bash
# Worker/app/database status
docker compose ps

# Recent worker state transitions and safe error summaries
docker compose logs --tail=200 notification-worker

# Database health through the application
curl -fsS http://localhost:3000/api/health/db

# Recent durable delivery state (run in the database container)
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT status, attempt_count, scheduled_for, last_attempted_at, next_attempt_at, delivered_at, last_error
   FROM notification_deliveries
   ORDER BY updated_at DESC
   LIMIT 25;"
```

For an expected phone notification, verify in order: the calendar event is Family Hub-owned; it has one or more approved reminder offsets; its intended participants have enabled current destinations; both Home Assistant environment variables are configured in the running worker; the worker logs a due/complete cycle; and the matching delivery record has the expected status. A `failed` record identifies a permanent configuration/authentication/target condition. A `retrying` record identifies a transient failure and its next eligible attempt. An `expired` record means the reminder was intentionally not sent after the 15-minute catch-up window.

## Automated validation

Run all repository tests with:

```bash
cd app
npm test
```

The suite covers reminder persistence, approved presets, timed and all-day Johannesburg calculations, recurring occurrence identity, idempotent claims, stale expiry, catch-up recovery, transient retry identity, current schedule and destination revalidation, participant routing, Home Assistant result classification, and secret-safe provider behavior. Also run `npm run lint` and `npm run build` before deployment.

## Release verification boundary

Repository tests prove the repeatable behavior above. A production end-to-end release check additionally requires a safe real Family Hub event, a configured real household destination, and Home Assistant credentials in the running worker. Record the test event, destination member/device (without secrets), durable delivery state, worker logs, and observed phone result in the release evidence; do not claim phone delivery from a development environment alone.
