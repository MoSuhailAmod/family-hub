import { pool } from "@/lib/db";
import { expandEventForRange } from "@/lib/recurrence";
import type { DueReminder, NotificationWorkerDependencies } from "@/lib/notification-worker";

type ReminderRow = { reminder_id: string; event_id: string; title: string; location: string | null; all_day: boolean; start_at: Date; end_at: Date; recurrence_rule: string | null; offset_minutes: number; participant_ids: string[] };
function johannesburgDate(date: Date) { const values = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Johannesburg" }).formatToParts(date).reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {}); return `${values.year}-${values.month}-${values.day}`; }
function scheduledFor(reminder: Pick<DueReminder, "allDay" | "startAt" | "offsetMinutes">) {
  const anchor = reminder.allDay
    ? new Date(`${johannesburgDate(reminder.startAt)}T06:00:00.000Z`)
    : reminder.startAt;
  return new Date(anchor.getTime() - reminder.offsetMinutes * 60_000);
}
function dueEvents(rows: ReminderRow[], start: Date, end: Date): DueReminder[] {
  return rows.flatMap((row) => expandEventForRange({ id: row.event_id, startAt: row.start_at, endAt: row.end_at, recurrenceRule: row.recurrence_rule }, new Date(start.getTime() - row.offset_minutes * 60_000), new Date(end.getTime() + row.offset_minutes * 60_000)).map((occurrence) => ({ id: row.reminder_id, eventId: row.event_id, title: row.title, location: row.location, allDay: row.all_day, startAt: occurrence.occurrenceStartAt, endAt: occurrence.occurrenceEndAt, recurrenceRule: row.recurrence_rule, offsetMinutes: row.offset_minutes, participantIds: row.participant_ids })).filter((reminder) => { const scheduled = scheduledFor(reminder); return scheduled.getTime() >= start.getTime() && scheduled.getTime() <= end.getTime(); }));
}

export function createPostgresNotificationWorkerDependencies(dependencies: Pick<NotificationWorkerDependencies, "resolveRecipients" | "send">): NotificationWorkerDependencies {
  return {
    ...dependencies,
    async remindersDueBetween(start, end) {
      const result = await pool.query<ReminderRow>(
        `SELECT r.id AS reminder_id, e.id AS event_id, e.title, e.location, e.all_day,
                e.start_at, e.end_at, e.recurrence_rule, r.offset_minutes,
                COALESCE(array_agg(ep.family_member_id) FILTER (WHERE ep.family_member_id IS NOT NULL), '{}') AS participant_ids
         FROM calendar_event_reminders r
         INNER JOIN calendar_events e ON e.id = r.event_id
         LEFT JOIN event_participants ep ON ep.event_id = e.id
         WHERE e.recurrence_rule IS NOT NULL OR (e.start_at >= $1 - INTERVAL '8 days' AND e.start_at <= $2 + INTERVAL '8 days')
         GROUP BY r.id, e.id`,
        [start, end],
      );
      return dueEvents(result.rows, start, end);
    },
    async claim(intent) {
      const result = await pool.query<{ id: string; provider: string; target: string }>(
        `WITH claimable AS (
           SELECT r.id AS reminder_id, nd.id AS destination_id, nd.provider, nd.target
           FROM calendar_event_reminders r
           INNER JOIN event_participants ep ON ep.event_id = r.event_id
           INNER JOIN notification_destinations nd
             ON nd.family_member_id = ep.family_member_id
           WHERE r.id = $1 AND nd.id = $2 AND nd.enabled = TRUE
         ), claimed AS (
           INSERT INTO notification_deliveries
             (reminder_id, destination_id, occurrence_key, scheduled_for, status, attempt_count, last_attempted_at)
           SELECT reminder_id, destination_id, $3, $4, 'sending', 1, NOW()
           FROM claimable
           ON CONFLICT (reminder_id, occurrence_key, destination_id) DO UPDATE
             SET status = 'sending', attempt_count = notification_deliveries.attempt_count + 1,
                 last_attempted_at = NOW(), next_attempt_at = NULL, updated_at = NOW()
           WHERE notification_deliveries.scheduled_for >= NOW() - INTERVAL '15 minutes'
             AND (
               (notification_deliveries.status = 'retrying'
                AND (notification_deliveries.next_attempt_at IS NULL OR notification_deliveries.next_attempt_at <= NOW()))
               OR (notification_deliveries.status = 'sending'
                   AND notification_deliveries.last_attempted_at <= NOW() - INTERVAL '2 minutes')
             )
           RETURNING destination_id
         )
         SELECT claimed.destination_id AS id, claimable.provider, claimable.target
         FROM claimed
         INNER JOIN claimable ON claimable.destination_id = claimed.destination_id`,
        [intent.reminderId, intent.destinationId, intent.occurrenceKey, intent.scheduledFor],
      );
      return result.rows[0] ?? null;
    },
    async complete(intent, result) {
      const retryable = !result.success && ["network", "timeout", "provider"].includes(result.kind);
      await pool.query(
        `UPDATE notification_deliveries
         SET status = $5,
             delivered_at = CASE WHEN $5 = 'delivered' THEN NOW() ELSE NULL END,
             next_attempt_at = CASE WHEN $5 = 'retrying' THEN NOW() + INTERVAL '1 minute' ELSE NULL END,
             last_error = $6, updated_at = NOW()
         WHERE reminder_id = $1 AND destination_id = $2 AND occurrence_key = $3 AND scheduled_for = $4`,
        [intent.reminderId, intent.destinationId, intent.occurrenceKey, intent.scheduledFor, result.success ? "delivered" : retryable ? "retrying" : "failed", result.success ? null : result.message],
      );
    },
    async expire(intent) {
      await pool.query(
        `INSERT INTO notification_deliveries (reminder_id, destination_id, occurrence_key, scheduled_for, status, attempt_count, last_error)
         VALUES ($1, $2, $3, $4, 'expired', 0, 'Reminder exceeded 15-minute catch-up window')
         ON CONFLICT (reminder_id, occurrence_key, destination_id) DO NOTHING`,
        [intent.reminderId, intent.destinationId, intent.occurrenceKey, intent.scheduledFor],
      );
    },
  };
}
