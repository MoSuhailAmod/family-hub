import {
  type CreateShoppingItemInput,
  type NormalizedUpdateShoppingItemInput,
  type UpdateShoppingItemInput,
} from "./shopping-types";

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

export function normalizeCreateShoppingItem(
  input: CreateShoppingItemInput,
): Required<CreateShoppingItemInput> {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Name is required");
  }

  return {
    name,
    quantity: optionalText(input.quantity),
    notes: optionalText(input.notes),
  };
}

export function normalizeUpdateShoppingItem(
  input: UpdateShoppingItemInput,
): NormalizedUpdateShoppingItemInput {
  if (input.name !== undefined && !input.name.trim()) {
    throw new Error("Name is required");
  }

  return {
    name: input.name?.trim(),
    quantity:
      input.quantity === undefined
        ? undefined
        : optionalText(input.quantity),
    notes:
      input.notes === undefined ? undefined : optionalText(input.notes),
  };
}
