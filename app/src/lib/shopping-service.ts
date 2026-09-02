import {
  normalizeCreateShoppingItem,
  normalizeUpdateShoppingItem,
  parseShoppingCompletion,
} from "./shopping-validation";
import type {
  CreateShoppingItemInput,
  ShoppingItem,
  ShoppingRepository,
  UpdateShoppingItemInput,
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

    getById(id: string) {
      return repository.getById(id);
    },

    async create(input: unknown) {
      return repository.create(normalizeCreateShoppingItem(input));
    },

    async update(id: string, input: unknown) {
      return repository.update(id, normalizeUpdateShoppingItem(input));
    },

    async setCompleted(id: string, completed: unknown) {
      return repository.setCompletion(
        id,
        parseShoppingCompletion(completed) ? new Date() : null,
      );
    },

    delete(id: string) {
      return repository.delete(id);
    },
  };
}
