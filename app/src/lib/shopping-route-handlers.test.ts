import assert from "node:assert/strict";
import test from "node:test";

import {
  ShoppingValidationError,
} from "./shopping-validation";
import {
  type ShoppingService,
  createShoppingRouteHandlers,
} from "./shopping-route-handlers";

const item = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Milk",
  quantity: "2L",
  notes: null,
  isCompleted: false,
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
  updatedAt: new Date("2026-09-01T10:00:00.000Z"),
  completedAt: null,
};

function service(overrides: Partial<ShoppingService> = {}): ShoppingService {
  return {
    list: async () => [item],
    getById: async () => item,
    create: async () => item,
    update: async () => item,
    setCompleted: async () => item,
    delete: async () => true,
    ...overrides,
  };
}

test("lists shopping items through the shared service", async () => {
  const handlers = createShoppingRouteHandlers(service());

  const response = await handlers.list();

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items[0].id, item.id);
});

test("creates a shopping item through the shared service", async () => {
  let received: unknown;
  const handlers = createShoppingRouteHandlers(
    service({ create: async (input) => {
      received = input;
      return item;
    } }),
  );

  const response = await handlers.create(
    new Request("http://family-hub.test/api/shopping-items", {
      method: "POST",
      body: JSON.stringify({ name: "Milk", quantity: "2L" }),
    }),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(received, { name: "Milk", quantity: "2L" });
  assert.equal((await response.json()).item.id, item.id);
});

test("returns a validation error for invalid shopping input", async () => {
  const handlers = createShoppingRouteHandlers(
    service({ create: async () => { throw new ShoppingValidationError("Name is required"); } }),
  );

  const response = await handlers.create(
    new Request("http://family-hub.test/api/shopping-items", {
      method: "POST",
      body: JSON.stringify({ name: " " }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Name is required" });
});

test("returns not found for a missing shopping item", async () => {
  const handlers = createShoppingRouteHandlers(
    service({ getById: async () => null }),
  );

  const response = await handlers.get("missing-id");

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Shopping item not found" });
});

test("rejects mixed completion and field updates predictably", async () => {
  const calls: string[] = [];
  const handlers = createShoppingRouteHandlers(
    service({
      update: async () => {
        calls.push("update");
        return item;
      },
      setCompleted: async () => {
        calls.push("complete");
        return item;
      },
    }),
  );

  const response = await handlers.update(
    "item-id",
    new Request("http://family-hub.test/api/shopping-items/item-id", {
      method: "PATCH",
      body: JSON.stringify({ completed: true, notes: "Organic" }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Completion updates cannot include editable item fields",
  });
  assert.deepEqual(calls, []);
});

test("returns a predictable error for malformed JSON", async () => {
  const handlers = createShoppingRouteHandlers(service());

  const response = await handlers.create(
    new Request("http://family-hub.test/api/shopping-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid JSON body" });
});

test("updates, completes, and deletes by stable id", async () => {
  const calls: string[] = [];
  const handlers = createShoppingRouteHandlers(
    service({
      update: async (id, input) => {
        calls.push(`update:${id}:${JSON.stringify(input)}`);
        return item;
      },
      setCompleted: async (id, completed) => {
        calls.push(`complete:${id}:${completed}`);
        return { ...item, isCompleted: completed === true };
      },
      delete: async (id) => {
        calls.push(`delete:${id}`);
        return true;
      },
    }),
  );

  const update = await handlers.update(
    "item-id",
    new Request("http://family-hub.test/api/shopping-items/item-id", {
      method: "PATCH",
      body: JSON.stringify({ notes: "Organic" }),
    }),
  );
  const completion = await handlers.update(
    "item-id",
    new Request("http://family-hub.test/api/shopping-items/item-id", {
      method: "PATCH",
      body: JSON.stringify({ completed: true }),
    }),
  );
  const deletion = await handlers.delete("item-id");

  assert.equal(update.status, 200);
  assert.equal(completion.status, 200);
  assert.equal(deletion.status, 204);
  assert.deepEqual(calls, [
    'update:item-id:{"notes":"Organic"}',
    "complete:item-id:true",
    "delete:item-id",
  ]);
});
