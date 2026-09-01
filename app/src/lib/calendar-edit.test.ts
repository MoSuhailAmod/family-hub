import assert from "node:assert/strict";
import test from "node:test";

import { canEditCalendarEvent } from "./calendar-edit";

test("does not offer edits for externally managed Google events", () => {
  assert.equal(canEditCalendarEvent("google:external-event"), false);
  assert.equal(canEditCalendarEvent("series-123"), true);
});
