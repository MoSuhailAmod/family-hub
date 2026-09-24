import assert from "node:assert/strict";
import test from "node:test";

import {
  createShoppingRolloverWorker,
  currentWeekKey,
  isRolloverDue,
} from "./shopping-rollover-worker";

test("is not due before Monday 06:00 Africa/Johannesburg", () => {
  assert.equal(isRolloverDue(new Date("2026-09-06T22:00:00.000Z")), false); // Monday 00:00 SAST
  assert.equal(isRolloverDue(new Date("2026-09-07T03:59:00.000Z")), false); // Monday 05:59 SAST
});

test("is due from Monday 06:00 Africa/Johannesburg onward", () => {
  assert.equal(isRolloverDue(new Date("2026-09-07T04:00:00.000Z")), true); // Monday 06:00 SAST
  assert.equal(isRolloverDue(new Date("2026-09-07T20:00:00.000Z")), true); // Monday 22:00 SAST
});

test("is not due once Monday has passed", () => {
  assert.equal(isRolloverDue(new Date("2026-09-08T04:00:00.000Z")), false); // Tuesday
});

test("keys the week by Monday's Africa/Johannesburg calendar date", () => {
  assert.equal(currentWeekKey(new Date("2026-09-07T04:00:00.000Z")), "2026-09-07");
  assert.equal(currentWeekKey(new Date("2026-09-07T20:00:00.000Z")), "2026-09-07");
});

test("claims the week and runs the rollover once due", async () => {
  const claims: string[] = [];
  let rolloverRuns = 0;
  const worker = createShoppingRolloverWorker({
    claimWeek: async (weekKey) => { claims.push(weekKey); return true; },
    runRollover: async () => { rolloverRuns += 1; return 3; },
  });

  const result = await worker.run(new Date("2026-09-07T05:00:00.000Z"));

  assert.deepEqual(result, { ran: true, deleted: 3 });
  assert.deepEqual(claims, ["2026-09-07"]);
  assert.equal(rolloverRuns, 1);
});

test("does not claim or run the rollover when not due", async () => {
  const worker = createShoppingRolloverWorker({
    claimWeek: async () => { throw new Error("must not claim outside the trigger window"); },
    runRollover: async () => { throw new Error("must not run outside the trigger window"); },
  });

  assert.deepEqual(await worker.run(new Date("2026-09-06T22:00:00.000Z")), { ran: false, deleted: 0 });
});

test("does not re-run the rollover once the week has already been claimed", async () => {
  let rolloverRuns = 0;
  const worker = createShoppingRolloverWorker({
    claimWeek: async () => false,
    runRollover: async () => { rolloverRuns += 1; return 0; },
  });

  const result = await worker.run(new Date("2026-09-07T10:00:00.000Z"));

  assert.deepEqual(result, { ran: false, deleted: 0 });
  assert.equal(rolloverRuns, 0);
});

test("still catches up later the same Monday after a missed check at 06:00", async () => {
  const worker = createShoppingRolloverWorker({
    claimWeek: async () => true,
    runRollover: async () => 2,
  });

  const result = await worker.run(new Date("2026-09-07T15:00:00.000Z")); // Monday 17:00 SAST

  assert.deepEqual(result, { ran: true, deleted: 2 });
});
