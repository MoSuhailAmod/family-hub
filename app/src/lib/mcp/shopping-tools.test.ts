import assert from "node:assert/strict";
import test from "node:test";

import {
  createShoppingToolAdapters,
  type ShoppingToolService,
} from "./shopping-tools";

const item = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Milk",
  quantity: null,
  notes: null,
  isCompleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
};

test("shopping tool adapters use stable ids and shared service operations", async () => {
  const calls: string[] = [];
  const service: ShoppingToolService = {
    list: async () => [item],
    create: async (input) => { calls.push(`create:${JSON.stringify(input)}`); return item; },
    update: async (id, input) => { calls.push(`update:${id}:${JSON.stringify(input)}`); return item; },
    setCompleted: async (id, completed) => { calls.push(`complete:${id}:${completed}`); return item; },
    delete: async (id) => { calls.push(`delete:${id}`); return true; },
  };
  const tools = createShoppingToolAdapters(service);

  const added = await tools.add({ name: "Milk" });
  assert.equal(added.success, true);
  if (added.success) {
    assert.equal(added.data.id, item.id);
  }
  assert.equal((await tools.update({ id: item.id, notes: "Organic" })).success, true);
  assert.equal((await tools.complete({ id: item.id, completed: true })).success, true);
  assert.equal((await tools.delete({ id: item.id, confirm: true })).success, true);
  assert.deepEqual(calls, [
    'create:{"name":"Milk"}',
    `update:${item.id}:{"notes":"Organic"}`,
    `complete:${item.id}:true`,
    `delete:${item.id}`,
  ]);
});

test("shopping tool adapters return predictable validation and not-found failures", async () => {
  const tools = createShoppingToolAdapters({
    list: async () => [],
    create: async () => { throw new Error("Name is required"); },
    update: async () => null,
    setCompleted: async () => null,
    delete: async () => false,
  });

  assert.deepEqual(await tools.add({ name: " " }), { success: false, error: "Name is required" });
  assert.deepEqual(await tools.update({ id: "missing" }), { success: false, error: "Shopping item not found" });
  assert.deepEqual(await tools.delete({ id: "missing", confirm: true }), { success: false, error: "Shopping item not found" });
  assert.deepEqual(await tools.delete({ id: item.id, confirm: false }), { success: false, error: "Delete requires confirm: true" });
});
