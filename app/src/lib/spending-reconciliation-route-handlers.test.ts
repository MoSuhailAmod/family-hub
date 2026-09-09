import assert from "node:assert/strict";
import test from "node:test";

import {
  type SpendingReconciliationService,
  createSpendingReconciliationRouteHandlers,
} from "./spending-reconciliation-route-handlers";

function service(
  result: Awaited<ReturnType<SpendingReconciliationService["reconcile"]>>,
): SpendingReconciliationService {
  return { reconcile: async () => result };
}

test("reconciles a Spending snapshot through the shared reconciliation service", async () => {
  const snapshot = { schemaVersion: "spending-reconciliation/v1" };
  const handlers = createSpendingReconciliationRouteHandlers(service({
    success: true,
    summary: {
      processed: 2,
      inserted: ["2026-08"],
      updated: [],
      unchanged: ["2026-07"],
      partialRefreshed: [],
      completedFromPartial: [],
    },
  }));

  const response = await handlers.reconcileSnapshot(snapshot);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    summary: {
      processed: 2,
      inserted: ["2026-08"],
      updated: [],
      unchanged: ["2026-07"],
      partialRefreshed: [],
      completedFromPartial: [],
    },
  });
});

test("returns safe machine-readable reconciliation errors", async () => {
  for (const [result, status] of [
    [{ success: false, code: "VALIDATION", error: "periods.0.total: Must be a signed decimal string" }, 400],
    [{ success: false, code: "DOMAIN", error: "Period 2026-08 cannot transition from completed to partial" }, 409],
    [{ success: false, code: "PERSISTENCE", error: "Unable to reconcile Spending snapshot" }, 500],
  ] as const) {
    const response = await createSpendingReconciliationRouteHandlers(service(result)).reconcileSnapshot({});

    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), result);
  }
});
