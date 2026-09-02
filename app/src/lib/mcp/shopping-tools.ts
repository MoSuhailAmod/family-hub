import type { ShoppingItem } from "@/lib/shopping-types";

export type ShoppingToolService = {
  list: () => Promise<ShoppingItem[]>;
  create: (input: unknown) => Promise<ShoppingItem>;
  update: (id: string, input: unknown) => Promise<ShoppingItem | null>;
  setCompleted: (
    id: string,
    completed: unknown,
  ) => Promise<ShoppingItem | null>;
  delete: (id: string) => Promise<boolean>;
};

type ToolResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function serviceFailure(error: unknown): ToolResult<never> {
  return {
    success: false,
    error: error instanceof Error ? error.message : "Shopping operation failed",
  };
}

export function createShoppingToolAdapters(service: ShoppingToolService) {
  return {
    async list(): Promise<ToolResult<ShoppingItem[]>> {
      try {
        return { success: true, data: await service.list() };
      } catch (error) {
        return serviceFailure(error);
      }
    },

    async add(input: {
      name: string;
      quantity?: string | null;
      notes?: string | null;
    }): Promise<ToolResult<ShoppingItem>> {
      try {
        return { success: true, data: await service.create(input) };
      } catch (error) {
        return serviceFailure(error);
      }
    },

    async update(input: {
      id: string;
      name?: string;
      quantity?: string | null;
      notes?: string | null;
    }): Promise<ToolResult<ShoppingItem>> {
      try {
        const { id, ...changes } = input;
        const item = await service.update(id, changes);
        return item
          ? { success: true, data: item }
          : { success: false, error: "Shopping item not found" };
      } catch (error) {
        return serviceFailure(error);
      }
    },

    async complete(input: {
      id: string;
      completed: boolean;
    }): Promise<ToolResult<ShoppingItem>> {
      try {
        const item = await service.setCompleted(input.id, input.completed);
        return item
          ? { success: true, data: item }
          : { success: false, error: "Shopping item not found" };
      } catch (error) {
        return serviceFailure(error);
      }
    },

    async delete(input: {
      id: string;
      confirm: boolean;
    }): Promise<ToolResult<{ id: string }>> {
      if (!input.confirm) {
        return { success: false, error: "Delete requires confirm: true" };
      }

      try {
        return (await service.delete(input.id))
          ? { success: true, data: { id: input.id } }
          : { success: false, error: "Shopping item not found" };
      } catch (error) {
        return serviceFailure(error);
      }
    },
  };
}
