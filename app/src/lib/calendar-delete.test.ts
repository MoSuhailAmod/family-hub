import assert from "node:assert/strict";
import test from "node:test";

import {
  canDeleteCalendarEvent,
  deleteCalendarEvent,
} from "./calendar-delete";

test("does not offer deletion for externally managed Google events", () => {
  assert.equal(canDeleteCalendarEvent("google:external-event"), false);
  assert.equal(canDeleteCalendarEvent("series-123"), true);
});

test("deletes a calendar event using its persisted series id", async () => {
  const requests: Array<{ input: string; init?: RequestInit }> = [];

  const result = await deleteCalendarEvent(
    "series-123",
    async (input, init) => {
      requests.push({ input: String(input), init });
      return new Response(null, { status: 204 });
    },
  );

  assert.deepEqual(requests, [
    {
      input: "/api/events/series-123",
      init: { method: "DELETE" },
    },
  ]);
  assert.deepEqual(result, { success: true });
});

test("keeps the event intact by reporting a failed deletion", async () => {
  const result = await deleteCalendarEvent(
    "series-123",
    async () =>
      Response.json(
        { error: "This event could not be deleted." },
        { status: 500 },
      ),
  );

  assert.deepEqual(result, {
    success: false,
    error: "This event could not be deleted.",
  });
});
