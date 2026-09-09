import assert from "node:assert/strict";
import test from "node:test";

import { createSpendingImportRouteHandlers } from "./spending-import-route-handlers";

test("routes a validated Spending upload through the shared import service", async () => {
  const uploaded = { schemaVersion: "spending-import/v1" };
  const handlers = createSpendingImportRouteHandlers({
    import: async (input) => {
      assert.equal(input, uploaded);
      return { success: true, status: "imported" } as const;
    },
  });

  const response = await handlers.importSnapshot(uploaded);

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { success: true, status: "imported" });
});

test("makes validation and persistence upload errors understandable HTTP responses", async () => {
  const handlers = createSpendingImportRouteHandlers({
    import: async () => ({
      success: false,
      code: "VALIDATION",
      error: "period.endDate: Must be on or after period.startDate",
    }),
  });

  const response = await handlers.importSnapshot({});

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "period.endDate: Must be on or after period.startDate",
  });
});
