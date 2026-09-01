import assert from "node:assert/strict";
import test from "node:test";

import {
  createEventPayload,
  eventFormValuesFromPersistedEvent,
} from "./calendar-form";

test("creates timed event timestamps in Africa/Johannesburg", () => {
  const result = createEventPayload({
    title: "School pickup",
    startDate: "2026-09-01",
    startTime: "10:30",
    endDate: "2026-09-01",
    endTime: "11:15",
    allDay: false,
    participantIds: ["member-1"],
    categoryId: "category-1",
    location: "School",
    description: "Collect Mia",
  });

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.deepEqual(result.data, {
    title: "School pickup",
    startAt: "2026-09-01T08:30:00.000Z",
    endAt: "2026-09-01T09:15:00.000Z",
    allDay: false,
    participantIds: ["member-1"],
    categoryId: "category-1",
    location: "School",
    description: "Collect Mia",
    recurrenceRule: null,
  });
});

test("uses an exclusive next-day end for an all-day event", () => {
  const result = createEventPayload({
    title: "Heritage Day",
    startDate: "2026-09-24",
    endDate: "2026-09-24",
    allDay: true,
    participantIds: [],
    categoryId: null,
    location: "",
    description: "",
  });

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.startAt, "2026-09-23T22:00:00.000Z");
  assert.equal(result.data.endAt, "2026-09-24T22:00:00.000Z");
});

test("prefills all-day edits with Johannesburg dates and an inclusive end", () => {
  assert.deepEqual(
    eventFormValuesFromPersistedEvent({
      title: "Heritage Day",
      startAt: "2026-09-23T22:00:00.000Z",
      endAt: "2026-09-25T22:00:00.000Z",
      allDay: true,
      participants: [{ id: "member-1" }],
      categoryId: "category-1",
      location: "Home",
      description: "Braai",
      recurrenceRule: "FREQ=YEARLY",
    }),
    {
      title: "Heritage Day",
      startDate: "2026-09-24",
      startTime: "00:00",
      endDate: "2026-09-25",
      endTime: "00:00",
      allDay: true,
      participantIds: ["member-1"],
      categoryId: "category-1",
      location: "Home",
      description: "Braai",
      recurrenceRule: "FREQ=YEARLY",
    },
  );
});

test("rejects end date/times that are not after the start", () => {
  const result = createEventPayload({
    title: "Too short",
    startDate: "2026-09-01",
    startTime: "10:30",
    endDate: "2026-09-01",
    endTime: "10:30",
    allDay: false,
    participantIds: [],
    categoryId: null,
    location: "",
    description: "",
  });

  assert.deepEqual(result, {
    success: false,
    field: "end",
    message: "End date/time must be after start date/time.",
  });
});
