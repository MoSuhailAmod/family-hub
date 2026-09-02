import assert from "node:assert/strict";
import test from "node:test";

import { getTableColumns, getTableName } from "drizzle-orm";
import * as schema from "./schema";

test("defines the approved shopping_items persistence table", () => {
  const shoppingItems = (schema as Record<string, unknown>).shoppingItems;

  assert.ok(shoppingItems, "shoppingItems table must be exported");
  assert.equal(getTableName(shoppingItems as never), "shopping_items");

  const columns = getTableColumns(shoppingItems as never);
  assert.deepEqual(Object.keys(columns).sort(), [
    "completedAt",
    "createdAt",
    "id",
    "isCompleted",
    "name",
    "notes",
    "quantity",
    "updatedAt",
  ]);
});
