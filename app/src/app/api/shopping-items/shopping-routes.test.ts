import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "@/app/api/shopping-items/route";
import { DELETE, GET, PATCH } from "@/app/api/shopping-items/[id]/route";

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

test("item routes return 400 for malformed ids before accessing persistence", async () => {
  const context = { params: Promise.resolve({ id: "not-a-uuid" }) };
  const patchRequest = new Request("http://family-hub.test/api/shopping-items/not-a-uuid", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes: "Organic" }),
  });

  for (const response of [
    await GET(new Request("http://family-hub.test/api/shopping-items/not-a-uuid"), context),
    await PATCH(patchRequest, context),
    await DELETE(new Request("http://family-hub.test/api/shopping-items/not-a-uuid", { method: "DELETE" }), context),
  ]) {
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Item id must be a UUID" });
  }
});

test("item route rejects empty and unknown-only update payloads", async () => {
  const context = { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) };

  for (const body of [{}, { unexpected: "value" }]) {
    const response = await PATCH(
      new Request("http://family-hub.test/api/shopping-items/00000000-0000-4000-8000-000000000001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      context,
    );

    assert.equal(response.status, 400);
  }
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
