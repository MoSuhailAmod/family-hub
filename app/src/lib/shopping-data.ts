import { eq } from "drizzle-orm";

import { shoppingItems } from "@/db/schema";
import { db } from "@/lib/db";

import type {
  NormalizedUpdateShoppingItemInput,
  ShoppingItem,
  ShoppingRepository,
} from "./shopping-types";

type ShoppingItemRow = typeof shoppingItems.$inferSelect;

function mapShoppingItem(row: ShoppingItemRow): ShoppingItem {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    notes: row.notes,
    isCompleted: row.isCompleted,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

export const shoppingRepository: ShoppingRepository = {
  async list() {
    return (await db.select().from(shoppingItems)).map(mapShoppingItem);
  },

  async getById(id) {
    const [row] = await db
      .select()
      .from(shoppingItems)
      .where(eq(shoppingItems.id, id));

    return row ? mapShoppingItem(row) : null;
  },

  async create(input) {
    const [row] = await db
      .insert(shoppingItems)
      .values(input)
      .returning();

    return mapShoppingItem(row);
  },

  async update(id, changes) {
    const update: NormalizedUpdateShoppingItemInput & { updatedAt: Date } = {
      ...changes,
      updatedAt: new Date(),
    };
    const [row] = await db
      .update(shoppingItems)
      .set(update)
      .where(eq(shoppingItems.id, id))
      .returning();

    return row ? mapShoppingItem(row) : null;
  },

  async setCompletion(id, completedAt) {
    const [row] = await db
      .update(shoppingItems)
      .set({
        isCompleted: completedAt !== null,
        completedAt,
        updatedAt: new Date(),
      })
      .where(eq(shoppingItems.id, id))
      .returning();

    return row ? mapShoppingItem(row) : null;
  },

  async delete(id) {
    const [row] = await db
      .delete(shoppingItems)
      .where(eq(shoppingItems.id, id))
      .returning({ id: shoppingItems.id });

    return Boolean(row);
  },
};
