import assert from "node:assert/strict";
import test from "node:test";

import {
  type ShoppingItem,
  type ShoppingRepository,
  createShoppingService,
} from "./shopping-service";

function item(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Milk",
    quantity: null,
    notes: null,
    isCompleted: false,
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    updatedAt: new Date("2026-09-01T10:00:00.000Z"),
    completedAt: null,
    ...overrides,
  };
}

function memoryRepository(initial: ShoppingItem[] = []): ShoppingRepository {
  const items = [...initial];
  let sequence = items.length;

  return {
    async list() {
      return [...items];
    },
    async getById(id) {
      return items.find((candidate) => candidate.id === id) ?? null;
    },
    async create(input) {
      sequence += 1;
      const now = new Date(`2026-09-01T10:00:0${sequence}.000Z`);
      const created = item({
        id: `00000000-0000-4000-8000-00000000000${sequence}`,
        ...input,
        createdAt: now,
        updatedAt: now,
      });
      items.push(created);
      return created;
    },
    async update(id, changes) {
      const index = items.findIndex((candidate) => candidate.id === id);
      if (index < 0) return null;
      const updated = {
        ...items[index],
        ...changes,
        updatedAt: new Date("2026-09-01T11:00:00.000Z"),
      };
      items[index] = updated;
      return updated;
    },
    async setCompletion(id, completedAt) {
      const index = items.findIndex((candidate) => candidate.id === id);
      if (index < 0) return null;
      const updated = {
        ...items[index],
        isCompleted: completedAt !== null,
        completedAt,
        updatedAt: new Date("2026-09-01T11:00:00.000Z"),
      };
      items[index] = updated;
      return updated;
    },
    async delete(id) {
      const index = items.findIndex((candidate) => candidate.id === id);
      if (index < 0) return false;
      items.splice(index, 1);
      return true;
    },
  };
}

test("creates distinct trimmed duplicate shopping items", async () => {
  const service = createShoppingService(memoryRepository());

  const first = await service.create({ name: "  Milk  ", quantity: "2L" });
  const second = await service.create({ name: "Milk" });

  assert.equal(first.name, "Milk");
  assert.equal(first.quantity, "2L");
  assert.notEqual(first.id, second.id);
  assert.equal(second.name, "Milk");
});

test("rejects an empty shopping item name", async () => {
  const service = createShoppingService(memoryRepository());

  await assert.rejects(() => service.create({ name: "   " }), {
    message: "Name is required",
  });
});

test("rejects invalid runtime inputs with controlled validation errors", async () => {
  const service = createShoppingService(memoryRepository());

  await assert.rejects(
    () => service.create({ name: 42 } as unknown as { name: string }),
    { message: "Name must be a string" },
  );
  await assert.rejects(
    () => service.setCompleted("00000000-0000-4000-8000-000000000001", "yes" as unknown as boolean),
    { message: "Completed must be a boolean" },
  );
});

test("rejects malformed stable ids before reaching persistence", async () => {
  const service = createShoppingService(memoryRepository([item()]));

  for (const operation of [
    () => service.getById("not-a-uuid"),
    () => service.update("not-a-uuid", { notes: "Organic" }),
    () => service.setCompleted("not-a-uuid", true),
    () => service.delete("not-a-uuid"),
  ]) {
    await assert.rejects(operation, { message: "Item id must be a UUID" });
  }
});

test("updates editable shopping item fields by stable id", async () => {
  const existing = item();
  const service = createShoppingService(memoryRepository([existing]));

  const updated = await service.update(existing.id, {
    name: "  Oat milk ",
    quantity: "2 x 1L",
    notes: "Unsweetened",
  });

  assert.deepEqual(
    { name: updated?.name, quantity: updated?.quantity, notes: updated?.notes },
    { name: "Oat milk", quantity: "2 x 1L", notes: "Unsweetened" },
  );
});

test("preserves unspecified fields during a partial update", async () => {
  const existing = item({ quantity: "1L", notes: "Full cream" });
  const service = createShoppingService(memoryRepository([existing]));

  const updated = await service.update(existing.id, { quantity: "2L" });

  assert.deepEqual(
    { name: updated?.name, quantity: updated?.quantity, notes: updated?.notes },
    { name: "Milk", quantity: "2L", notes: "Full cream" },
  );
});

test("completes and restores an item without deleting it", async () => {
  const existing = item();
  const service = createShoppingService(memoryRepository([existing]));

  const complete = await service.setCompleted(existing.id, true);
  assert.equal(complete?.isCompleted, true);
  assert.ok(complete?.completedAt);

  const restored = await service.setCompleted(existing.id, false);
  assert.equal(restored?.isCompleted, false);
  assert.equal(restored?.completedAt, null);
});

test("does not rewrite timestamps for repeated completion states", async () => {
  const completed = item({
    isCompleted: true,
    completedAt: new Date("2026-09-01T12:00:00.000Z"),
    updatedAt: new Date("2026-09-01T12:00:00.000Z"),
  });
  const active = item({
    id: "00000000-0000-4000-8000-000000000002",
    isCompleted: false,
    completedAt: null,
  });
  let completionWrites = 0;
  const service = createShoppingService({
    ...memoryRepository([completed, active]),
    getById: async (id) => id === completed.id ? completed : id === active.id ? active : null,
    setCompletion: async () => {
      completionWrites += 1;
      return null;
    },
  });

  assert.equal(await service.setCompleted(completed.id, true), completed);
  assert.equal(await service.setCompleted(active.id, false), active);
  assert.equal(completionWrites, 0);
});

test("hard deletes an item by stable id", async () => {
  const existing = item();
  const service = createShoppingService(memoryRepository([existing]));

  assert.equal(await service.delete(existing.id), true);
  assert.equal(await service.getById(existing.id), null);
});

test("lists active items then recently completed items using stable ordering", async () => {
  const service = createShoppingService(memoryRepository([
    item({ id: "b", name: "Active later", createdAt: new Date("2026-09-02T00:00:00Z") }),
    item({ id: "a", name: "Active earlier", createdAt: new Date("2026-09-01T00:00:00Z") }),
    item({ id: "d", name: "Complete older", isCompleted: true, completedAt: new Date("2026-09-01T12:00:00Z") }),
    item({ id: "c", name: "Complete newer", isCompleted: true, completedAt: new Date("2026-09-02T12:00:00Z") }),
  ]));

  assert.deepEqual(
    (await service.list()).map((candidate) => candidate.id),
    ["a", "b", "c", "d"],
  );
});
