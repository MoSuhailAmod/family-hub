import { z } from "zod";

import type {
  CreateShoppingItemInput,
  NormalizedUpdateShoppingItemInput,
  UpdateShoppingItemInput,
} from "./shopping-types";

export class ShoppingValidationError extends Error {}

const optionalText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => value?.trim() || null);

const createShoppingItemSchema = z.object({
  name: z
    .string({ error: "Name must be a string" })
    .trim()
    .min(1, "Name is required"),
  quantity: optionalText,
  notes: optionalText,
});

const updateShoppingItemSchema = z
  .object({
    name: z
      .string({ error: "Name must be a string" })
      .trim()
      .min(1, "Name is required")
      .optional(),
    quantity: optionalText.optional(),
    notes: optionalText.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one editable field is required",
  });

const completedSchema = z.boolean({
  error: "Completed must be a boolean",
});

const shoppingItemIdSchema = z.uuid({
  error: "Item id must be a UUID",
});

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;

  throw new ShoppingValidationError(parsed.error.issues[0].message);
}

export function normalizeCreateShoppingItem(
  input: unknown,
): Required<CreateShoppingItemInput> {
  const parsed = parseOrThrow(createShoppingItemSchema, input);
  return {
    name: parsed.name,
    quantity: parsed.quantity ?? null,
    notes: parsed.notes ?? null,
  };
}

export function normalizeUpdateShoppingItem(
  input: unknown,
): NormalizedUpdateShoppingItemInput {
  const parsed = parseOrThrow(updateShoppingItemSchema, input);
  const normalized: NormalizedUpdateShoppingItemInput = {};

  if (parsed.name !== undefined) normalized.name = parsed.name;
  if (parsed.quantity !== undefined) normalized.quantity = parsed.quantity;
  if (parsed.notes !== undefined) normalized.notes = parsed.notes;

  return normalized;
}

export function parseShoppingCompletion(input: unknown) {
  return parseOrThrow(completedSchema, input);
}

export function parseShoppingItemId(input: unknown) {
  return parseOrThrow(shoppingItemIdSchema, input);
}

export type { UpdateShoppingItemInput };
