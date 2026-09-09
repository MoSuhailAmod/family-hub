import assert from "node:assert/strict";
import test from "node:test";

import { expandEventForRange } from "./recurrence";
import { parseEventInput } from "./validation";

const eventInput = {
  title: "Dentist appointment",
  startAt: "2026-09-10T13:30:00.000Z",
  endAt: "2026-09-10T14:00:00.000Z",
};

test("defaults an absent reminder collection to no reminders and returns approved offsets in deterministic order", () => {
  const withoutReminders = parseEventInput(eventInput);
  assert.equal(withoutReminders.success, true);
  if (!withoutReminders.success) return;
  assert.deepEqual(withoutReminders.data.reminderOffsets, []);

  const withReminders = parseEventInput({
    ...eventInput,
    reminderOffsets: [10080, 10, 60, 30, 1440],
  });
  assert.equal(withReminders.success, true);
  if (!withReminders.success) return;
  assert.deepEqual(withReminders.data.reminderOffsets, [10, 30, 60, 1440, 10080]);
});

test("rejects zero, negative, arbitrary, and duplicate reminder offsets", () => {
  for (const reminderOffsets of [[0], [-10], [15], [10, 10]]) {
    const parsed = parseEventInput({ ...eventInput, reminderOffsets });
    assert.equal(parsed.success, false, `expected ${reminderOffsets} to fail`);
  }
});

test("recurring occurrences retain the persisted series reminder metadata without materialising per-occurrence rules", () => {
  const parsed = parseEventInput({
    ...eventInput,
    recurrenceRule: "FREQ=DAILY;COUNT=2",
    reminderOffsets: [1440, 10],
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const occurrences = expandEventForRange(
    {
      id: "event-1",
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      recurrenceRule: parsed.data.recurrenceRule,
      reminderOffsets: parsed.data.reminderOffsets,
    },
    new Date("2026-09-10T00:00:00.000Z"),
    new Date("2026-09-12T00:00:00.000Z"),
  );

  assert.equal(occurrences.length, 2);
  assert.deepEqual(
    occurrences.map((occurrence) => occurrence.reminderOffsets),
    [[10, 1440], [10, 1440]],
  );
});
