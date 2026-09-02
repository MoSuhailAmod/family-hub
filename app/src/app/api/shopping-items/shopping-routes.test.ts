import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "@/app/api/shopping-items/route";
import { PATCH } from "@/app/api/shopping-items/[id]/route";

test("collection route returns 400 for malformed JSON before accessing persistence", async () => {
  const response = await POST(
    new Request("http://family-hub.test/api/shopping-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid JSON body" });
});

test("item route rejects mixed completion and editable field payloads", async () => {
  const response = await PATCH(
    new Request("http://family-hub.test/api/shopping-items/item-id", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true, notes: "Organic" }),
    }),
    { params: Promise.resolve({ id: "item-id" }) },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Completion updates cannot include editable item fields",
  });
});
