import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import EmbeddedPostgres from "embedded-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Client } from "pg";

const migrationsFolder = join(process.cwd(), "drizzle");
let databaseDir: string;
let postgres: EmbeddedPostgres;
let client: Client;
let closeApplicationPool: (() => Promise<void>) | undefined;

before(async () => {
  databaseDir = await mkdtemp(join(tmpdir(), "family-hub-calendar-reminders-"));
  postgres = new EmbeddedPostgres({
    databaseDir,
    port: 55434,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("calendar_reminders");
  client = postgres.getPgClient("calendar_reminders");
  await client.connect();
  await migrate(drizzle(client), { migrationsFolder });
  process.env.DATABASE_URL = "postgresql://postgres:password@localhost:55434/calendar_reminders";
});

after(async () => {
  await closeApplicationPool?.();
  await client.end();
  await postgres.stop();
  await rm(databaseDir, { recursive: true, force: true });
});

function input(overrides: Record<string, unknown> = {}) {
  return {
    title: "Dentist appointment",
    startAt: "2026-09-10T13:30:00.000Z",
    endAt: "2026-09-10T14:00:00.000Z",
    allDay: false,
    participantIds: [],
    ...overrides,
  };
}

test("persists, reads, synchronises, and cascades Family Hub reminder rules", async () => {
  const { parseEventInput } = await import("./validation");
  const { createEvent, deleteEvent, getEventsForRange, updateEvent } =
    await import("./calendar-data");
  const { pool } = await import("./db");
  closeApplicationPool = () => pool.end();

  const createdInput = parseEventInput(input({ reminderOffsets: [10080, 10] }));
  assert.equal(createdInput.success, true);
  if (!createdInput.success) return;

  const created = await createEvent(createdInput.data);
  assert.ok(created);
  assert.deepEqual(created.reminderOffsets, [10, 10080]);

  const updatedInput = parseEventInput(input({ reminderOffsets: [30, 10] }));
  assert.equal(updatedInput.success, true);
  if (!updatedInput.success) return;

  const updated = await updateEvent(created.id, updatedInput.data);
  assert.ok(updated);
  assert.deepEqual(updated.reminderOffsets, [10, 30]);

  const stored = await client.query<{ offset_minutes: number }>(
    "select offset_minutes from calendar_event_reminders where event_id = $1 order by offset_minutes",
    [created.id],
  );
  assert.deepEqual(stored.rows, [
    { offset_minutes: 10 },
    { offset_minutes: 30 },
  ]);

  const listed = await getEventsForRange(
    new Date("2026-09-10T00:00:00.000Z"),
    new Date("2026-09-11T00:00:00.000Z"),
  );
  assert.deepEqual(listed[0].reminderOffsets, [10, 30]);

  assert.equal(await deleteEvent(created.id), true);
  const remaining = await client.query<{ count: string }>(
    "select count(*)::text as count from calendar_event_reminders where event_id = $1",
    [created.id],
  );
  assert.deepEqual(remaining.rows, [{ count: "0" }]);
});

test("retains one reminder set for every projected recurrence occurrence", async () => {
  const { parseEventInput } = await import("./validation");
  const { createEvent, getEventsForRange } = await import("./calendar-data");

  const parsed = parseEventInput(input({
    recurrenceRule: "FREQ=DAILY;COUNT=2",
    reminderOffsets: [1440, 60],
  }));
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const event = await createEvent(parsed.data);
  assert.ok(event);

  const occurrences = await getEventsForRange(
    new Date("2026-09-10T00:00:00.000Z"),
    new Date("2026-09-12T00:00:00.000Z"),
  );
  assert.deepEqual(
    occurrences
      .filter((occurrence) => occurrence.id === event.id)
      .map((occurrence) => occurrence.reminderOffsets),
    [[60, 1440], [60, 1440]],
  );

  const reminders = await client.query<{ count: string }>(
    "select count(*)::text as count from calendar_event_reminders where event_id = $1",
    [event.id],
  );
  assert.deepEqual(reminders.rows, [{ count: "2" }]);
});
