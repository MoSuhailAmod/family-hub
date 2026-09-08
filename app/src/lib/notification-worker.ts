import type {
  NotificationDeliveryResult,
  NotificationDestination,
  NotificationRequest,
} from "@/lib/notification-service";

export const REMINDER_CATCH_UP_MS = 15 * 60 * 1000;
export const REMINDER_DISCOVERY_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;

export type DueReminder = {
  id: string;
  eventId: string;
  title: string;
  location: string | null;
  allDay: boolean;
  startAt: Date;
  endAt: Date;
  recurrenceRule: string | null;
  offsetMinutes: number;
  participantIds: string[];
};

type WorkerDestination = NotificationDestination;
type DeliveryIntent = {
  reminderId: string;
  destinationId: string;
  occurrenceKey: string;
  scheduledFor: Date;
};

export type NotificationWorkerDependencies = {
  remindersDueBetween(start: Date, end: Date): Promise<DueReminder[]>;
  resolveRecipients(participantIds: string[]): Promise<WorkerDestination[]>;
  claim(intent: DeliveryIntent): Promise<boolean>;
  complete(intent: DeliveryIntent, result: NotificationDeliveryResult): Promise<void>;
  expire(intent: DeliveryIntent): Promise<void>;
  send(notification: NotificationRequest, destination: WorkerDestination): Promise<NotificationDeliveryResult>;
};

function occurrenceKey(reminder: DueReminder) {
  return reminder.recurrenceRule
    ? `${reminder.eventId}:${reminder.startAt.toISOString()}`
    : reminder.eventId;
}

function johannesburgDate(date: Date) {
  const values = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Johannesburg",
  }).formatToParts(date).reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  return `${values.year}-${values.month}-${values.day}`;
}

function scheduledFor(reminder: DueReminder) {
  const anchor = reminder.allDay
    ? new Date(`${johannesburgDate(reminder.startAt)}T06:00:00.000Z`)
    : reminder.startAt;
  return new Date(anchor.getTime() - reminder.offsetMinutes * 60_000);
}

function content(reminder: DueReminder): Pick<NotificationRequest, "title" | "body"> {
  const lead = reminder.offsetMinutes >= 1440
    ? `${reminder.offsetMinutes / 1440} day${reminder.offsetMinutes === 1440 ? "" : "s"}`
    : `${reminder.offsetMinutes} min`;
  return {
    title: `${reminder.title} in ${lead}`,
    body: reminder.location?.trim() || new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" }).format(reminder.startAt),
  };
}

export function createNotificationWorker(dependencies: NotificationWorkerDependencies) {
  return {
    async run(now = new Date()) {
      const reminders = await dependencies.remindersDueBetween(
        new Date(now.getTime() - REMINDER_DISCOVERY_WINDOW_MS),
        now,
      );
      const summary = { delivered: 0, expired: 0, skipped: 0, failed: 0 };
      for (const reminder of reminders) {
        const scheduled = scheduledFor(reminder);
        const destinations = await dependencies.resolveRecipients(reminder.participantIds);
        for (const destination of destinations) {
          const intent = { reminderId: reminder.id, destinationId: destination.id, occurrenceKey: occurrenceKey(reminder), scheduledFor: scheduled };
          if (now.getTime() - scheduled.getTime() > REMINDER_CATCH_UP_MS) {
            await dependencies.expire(intent); summary.expired += 1; continue;
          }
          if (!(await dependencies.claim(intent))) { summary.skipped += 1; continue; }
          const result = await dependencies.send({ ...content(reminder), correlationId: `${reminder.id}:${intent.occurrenceKey}`, metadata: { event_id: reminder.eventId, reminder_id: reminder.id } }, destination);
          await dependencies.complete(intent, result);
          if (result.success) summary.delivered += 1; else summary.failed += 1;
        }
      }
      return summary;
    },
  };
}
