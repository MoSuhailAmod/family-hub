export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  notes: string | null;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type CreateShoppingItemInput = {
  name: string;
  quantity?: string | null;
  notes?: string | null;
};

export type UpdateShoppingItemInput = {
  name?: string;
  quantity?: string | null;
  notes?: string | null;
};

export type NormalizedUpdateShoppingItemInput = {
  name?: string;
  quantity?: string | null;
  notes?: string | null;
};

export type ShoppingRepository = {
  list: () => Promise<ShoppingItem[]>;
  getById: (id: string) => Promise<ShoppingItem | null>;
  create: (
    input: Required<CreateShoppingItemInput>,
  ) => Promise<ShoppingItem>;
  update: (
    id: string,
    changes: NormalizedUpdateShoppingItemInput,
  ) => Promise<ShoppingItem | null>;
  setCompletion: (
    id: string,
    completedAt: Date | null,
  ) => Promise<ShoppingItem | null>;
  delete: (id: string) => Promise<boolean>;
};
