import {
  normalizeCreateShoppingItem,
  normalizeUpdateShoppingItem,
  parseShoppingCompletion,
  parseShoppingItemId,
} from "./shopping-validation";
import type {
  ShoppingItem,
  ShoppingRepository,
} from "./shopping-types";

export type {
  CreateShoppingItemInput,
  ShoppingItem,
  ShoppingRepository,
  UpdateShoppingItemInput,
} from "./shopping-types";

function compareShoppingItems(a: ShoppingItem, b: ShoppingItem) {
  if (a.isCompleted !== b.isCompleted) {
    return a.isCompleted ? 1 : -1;
  }

  if (!a.isCompleted) {
    const createdDifference = a.createdAt.getTime() - b.createdAt.getTime();
    return createdDifference || a.id.localeCompare(b.id);
  }

  const completedDifference =
    (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0);
  return completedDifference || a.id.localeCompare(b.id);
}

export function createShoppingService(repository: ShoppingRepository) {
  return {
    async list() {
      return (await repository.list()).sort(compareShoppingItems);
    },

    async getById(id: string) {
      return repository.getById(parseShoppingItemId(id));
    },

    async create(input: unknown) {
      return repository.create(normalizeCreateShoppingItem(input));
    },

    async update(id: string, input: unknown) {
      return repository.update(
        parseShoppingItemId(id),
        normalizeUpdateShoppingItem(input),
      );
    },

    async setCompleted(id: string, completed: unknown) {
      const itemId = parseShoppingItemId(id);
      const desiredState = parseShoppingCompletion(completed);
      const existing = await repository.getById(itemId);

      if (!existing || existing.isCompleted === desiredState) {
        return existing;
      }

      return repository.setCompletion(itemId, desiredState ? new Date() : null);
    },

    async delete(id: string) {
      return repository.delete(parseShoppingItemId(id));
    },
  };
}
