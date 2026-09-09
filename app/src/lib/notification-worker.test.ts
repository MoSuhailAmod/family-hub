import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationWorker } from "./notification-worker";
import { isCurrentSchedule, remindersDueQuery } from "./notification-worker-data";

const now = new Date("2026-09-08T08:00:00.000Z");
const reminder = {
  id: "reminder-1", eventId: "event-1", title: "Dentist", location: "Sandton", allDay: false,
  startAt: new Date("2026-09-08T08:10:00.000Z"), endAt: new Date("2026-09-08T09:00:00.000Z"),
  recurrenceRule: null, offsetMinutes: 10, participantIds: ["member-1"],
};

test("casts due-reminder timestamp parameters before subtracting intervals", () => {
  assert.match(remindersDueQuery, /e\.start_at >= \$1::timestamptz - INTERVAL '8 days'/);
  assert.match(remindersDueQuery, /e\.start_at <= \$2::timestamptz \+ INTERVAL '8 days'/);
});

test("dispatches a due timed reminder to each current enabled destination", async () => {
  const sent: string[] = [];
  const worker = createNotificationWorker({
    remindersDueBetween: async () => [reminder],
    claim: async () => true,
    complete: async () => undefined,
    expire: async () => undefined,
    resolveRecipients: async () => [
      { id: "destination-1", provider: "home_assistant", target: "mobile_app_phone" },
      { id: "destination-2", provider: "home_assistant", target: "mobile_app_tablet" },
    ],
    send: async (notification, destination) => { sent.push(`${destination.id}:${notification.correlationId}`); return { success: true, provider: destination.provider, status: 200 }; },
  });
  const result = await worker.run(now);
  assert.deepEqual(sent, ["destination-1:reminder-1:event-1", "destination-2:reminder-1:event-1"]);
  assert.deepEqual(result, { delivered: 2, expired: 0, skipped: 0, failed: 0 });
});

test("does not send a stale reminder outside the fifteen-minute catch-up window", async () => {
  const expired: string[] = [];
  const worker = createNotificationWorker({
    remindersDueBetween: async () => [{ ...reminder, startAt: new Date("2026-09-08T07:30:00.000Z") }],
    claim: async () => { throw new Error("stale reminders must not claim"); },
    complete: async () => undefined,
    expire: async (delivery) => { expired.push(delivery.destinationId); },
    resolveRecipients: async () => [{ id: "destination-1", provider: "home_assistant", target: "mobile_app_phone" }],
    send: async () => { throw new Error("stale reminders must not send"); },
  });
  assert.deepEqual(await worker.run(now), { delivered: 0, expired: 1, skipped: 0, failed: 0 });
  assert.deepEqual(expired, ["destination-1"]);
});

test("anchors all-day reminders at 08:00 Africa/Johannesburg rather than midnight", async () => {
  let observed: Date | undefined;
  const worker = createNotificationWorker({
    remindersDueBetween: async () => [{ ...reminder, allDay: true, startAt: new Date("2026-09-08T00:00:00.000Z"), endAt: new Date("2026-09-09T00:00:00.000Z"), offsetMinutes: 60 }],
    claim: async (delivery) => { observed = delivery.scheduledFor; return true; }, complete: async () => undefined, expire: async () => undefined,
    resolveRecipients: async () => [{ id: "destination-1", provider: "home_assistant", target: "mobile_app_phone" }],
    send: async () => ({ success: true, provider: "home_assistant", status: 200 }),
  });
  await worker.run(new Date("2026-09-08T05:00:00.000Z"));
  assert.equal(observed?.toISOString(), "2026-09-08T05:00:00.000Z");
});

test("does not resend an occurrence when its durable delivery cannot be claimed", async () => {
  let sent = false;
  const worker = createNotificationWorker({
    remindersDueBetween: async () => [reminder], claim: async () => false, complete: async () => undefined, expire: async () => undefined,
    resolveRecipients: async () => [{ id: "destination-1", provider: "home_assistant", target: "mobile_app_phone" }],
    send: async () => { sent = true; return { success: true, provider: "home_assistant", status: 200 }; },
  });
  assert.deepEqual(await worker.run(now), { delivered: 0, expired: 0, skipped: 1, failed: 0 });
  assert.equal(sent, false);
});

test("retries a transient provider failure using the same durable occurrence identity", async () => {
  const claims: string[] = []; let sends = 0;
  const worker = createNotificationWorker({
    remindersDueBetween: async () => [reminder], claim: async (intent) => { claims.push(`${intent.reminderId}:${intent.occurrenceKey}:${intent.destinationId}`); return true; }, complete: async () => undefined, expire: async () => undefined,
    resolveRecipients: async () => [{ id: "destination-1", provider: "home_assistant", target: "mobile_app_phone" }],
    send: async () => ++sends === 1 ? { success: false, provider: "home_assistant", kind: "network", message: "unavailable" } : { success: true, provider: "home_assistant", status: 200 },
  });
  assert.equal((await worker.run(now)).failed, 1);
  assert.equal((await worker.run(now)).delivered, 1);
  assert.deepEqual(claims, ["reminder-1:event-1:destination-1", "reminder-1:event-1:destination-1"]);
});

test("uses a distinct stable identity for recurring occurrences", async () => {
  const claims: string[] = [];
  const worker = createNotificationWorker({
    remindersDueBetween: async () => [{ ...reminder, recurrenceRule: "FREQ=DAILY", startAt: new Date("2026-09-08T08:10:00.000Z") }, { ...reminder, recurrenceRule: "FREQ=DAILY", startAt: new Date("2026-09-08T08:11:00.000Z") }],
    claim: async (intent) => { claims.push(intent.occurrenceKey); return true; }, complete: async () => undefined, expire: async () => undefined,
    resolveRecipients: async () => [{ id: "destination-1", provider: "home_assistant", target: "mobile_app_phone" }], send: async () => ({ success: true, provider: "home_assistant", status: 200 }),
  });
  await worker.run(new Date("2026-09-08T08:15:00.000Z"));
  assert.deepEqual(claims, ["event-1:2026-09-08T08:10:00.000Z", "event-1:2026-09-08T08:11:00.000Z"]);
});

test("dispatches multiple reminder rules for one event independently", async () => {
  const claimed: string[] = [];
  const worker = createNotificationWorker({
    remindersDueBetween: async () => [{ ...reminder, id: "reminder-10", offsetMinutes: 10 }, { ...reminder, id: "reminder-30", offsetMinutes: 30, startAt: new Date("2026-09-08T08:30:00.000Z") }],
    claim: async (intent) => { claimed.push(intent.reminderId); return true; }, complete: async () => undefined, expire: async () => undefined,
    resolveRecipients: async () => [{ id: "destination-1", provider: "home_assistant", target: "mobile_app_phone" }], send: async () => ({ success: true, provider: "home_assistant", status: 200 }),
  });
  assert.equal((await worker.run(now)).delivered, 2);
  assert.deepEqual(claimed, ["reminder-10", "reminder-30"]);
});

test("delivers to each participant's current enabled destination", async () => {
  const targets: string[] = [];
  const worker = createNotificationWorker({
    remindersDueBetween: async () => [{ ...reminder, participantIds: ["member-a", "member-b"] }], claim: async () => true, complete: async () => undefined, expire: async () => undefined,
    resolveRecipients: async (ids) => { assert.deepEqual(ids, ["member-a", "member-b"]); return [{ id: "a", provider: "home_assistant", target: "mobile_app_a" }, { id: "b", provider: "home_assistant", target: "mobile_app_b" }]; },
    send: async (_notification, destination) => { targets.push(destination.target); return { success: true, provider: "home_assistant", status: 200 }; },
  });
  assert.equal((await worker.run(now)).delivered, 2);
  assert.deepEqual(targets, ["mobile_app_a", "mobile_app_b"]);
});

test("recovers a reminder inside the fifteen-minute catch-up window", async () => {
  let sent = false;
  const worker = createNotificationWorker({
    remindersDueBetween: async () => [{ ...reminder, startAt: new Date("2026-09-08T08:04:00.000Z") }], claim: async () => true, complete: async () => undefined, expire: async () => undefined,
    resolveRecipients: async () => [{ id: "destination-1", provider: "home_assistant", target: "mobile_app_phone" }], send: async () => { sent = true; return { success: true, provider: "home_assistant", status: 200 }; },
  });
  assert.equal((await worker.run(now)).delivered, 1);
  assert.equal(sent, true);
});

test("skips delivery when current discovery no longer returns a deleted event or removed reminder", async () => {
  const worker = createNotificationWorker({
    remindersDueBetween: async () => [], claim: async () => { throw new Error("no current reminder should claim"); }, complete: async () => undefined, expire: async () => undefined,
    resolveRecipients: async () => { throw new Error("no current reminder should route"); }, send: async () => { throw new Error("no current reminder should send"); },
  });
  assert.deepEqual(await worker.run(now), { delivered: 0, expired: 0, skipped: 0, failed: 0 });
});

test("skips an event when current participant destinations are disabled or absent", async () => {
  const worker = createNotificationWorker({
    remindersDueBetween: async () => [reminder], claim: async () => { throw new Error("no destination should claim"); }, complete: async () => undefined, expire: async () => undefined,
    resolveRecipients: async () => [], send: async () => { throw new Error("no destination should send"); },
  });
  assert.deepEqual(await worker.run(now), { delivered: 0, expired: 0, skipped: 0, failed: 0 });
});

test("uses the destination revalidated atomically at claim time", async () => {
  const sent: string[] = [];
  const worker = createNotificationWorker({
    remindersDueBetween: async () => [reminder],
    resolveRecipients: async () => [{ id: "destination-1", provider: "home_assistant", target: "stale_target" }],
    claim: async () => ({ id: "destination-1", provider: "home_assistant", target: "current_target" }),
    complete: async () => undefined,
    expire: async () => undefined,
    send: async (_notification, destination) => {
      sent.push(destination.target);
      return { success: true, provider: "home_assistant", status: 200 };
    },
  });

  assert.equal((await worker.run(now)).delivered, 1);
  assert.deepEqual(sent, ["current_target"]);
});

test("rejects an intent when the authoritative schedule changes before its claim", () => {
  const intent = {
    reminderId: "reminder-1",
    occurrenceKey: "event-1:2026-09-08T08:10:00.000Z",
    scheduledFor: new Date("2026-09-08T08:00:00.000Z"),
  };
  const current = {
    eventId: "event-1",
    allDay: false,
    startAt: new Date("2026-09-08T08:30:00.000Z"),
    endAt: new Date("2026-09-08T09:20:00.000Z"),
    recurrenceRule: "FREQ=DAILY",
    offsetMinutes: 10,
  };

  assert.equal(isCurrentSchedule(intent, current), false);
  assert.equal(isCurrentSchedule(intent, { ...current, startAt: new Date("2026-09-08T08:10:00.000Z"), offsetMinutes: 30 }), false);
  assert.equal(isCurrentSchedule(intent, { ...current, startAt: new Date("2026-09-08T08:10:00.000Z") }), true);
});
