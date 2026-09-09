import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "@/app/api/spending/reconcile/route";

test("Spending reconciliation HTTP endpoint rejects malformed JSON before mutation", async () => {
  const response = await POST(
    new Request("http://family-hub.test/api/spending/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    code: "VALIDATION",
    error: "The Spending reconciliation payload must be valid JSON",
  });
});

test("Spending reconciliation HTTP endpoint limits streamed bodies without Content-Length", async () => {
  const request = new Request("http://family-hub.test/api/spending/reconcile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "x".repeat(5 * 1024 * 1024 + 1),
  });
  assert.equal(request.headers.get("content-length"), null);

  const response = await POST(request);

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    success: false,
    code: "VALIDATION",
    error: "The Spending reconciliation payload must be 5 MB or smaller",
  });
});
