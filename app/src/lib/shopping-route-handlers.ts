import type { ShoppingItem } from "./shopping-types";
import { ShoppingValidationError } from "./shopping-validation";

export type ShoppingService = {
  list: () => Promise<ShoppingItem[]>;
  getById: (id: string) => Promise<ShoppingItem | null>;
  create: (input: unknown) => Promise<ShoppingItem>;
  update: (id: string, input: unknown) => Promise<ShoppingItem | null>;
  setCompleted: (
    id: string,
    completed: unknown,
  ) => Promise<ShoppingItem | null>;
  delete: (id: string) => Promise<boolean>;
};

class InvalidJsonError extends Error {}
class InvalidShoppingPatchError extends Error {}

async function requestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidJsonError("Invalid JSON body");
  }
}

function errorResponse(error: unknown, operation: string) {
  if (
    error instanceof ShoppingValidationError ||
    error instanceof InvalidJsonError ||
    error instanceof InvalidShoppingPatchError
  ) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error(`Failed to ${operation} shopping item:`, error);
  return Response.json(
    { error: `Failed to ${operation} shopping item` },
    { status: 500 },
  );
}

function notFoundResponse() {
  return Response.json(
    { error: "Shopping item not found" },
    { status: 404 },
  );
}

function isCompletionUpdate(body: unknown): body is { completed: unknown } {
  return (
    typeof body === "object" &&
    body !== null &&
    Object.keys(body).length === 1 &&
    "completed" in body
  );
}

function includesCompletionField(body: unknown) {
  return typeof body === "object" && body !== null && "completed" in body;
}

export function createShoppingRouteHandlers(service: ShoppingService) {
  return {
    async list() {
      try {
        return Response.json({ items: await service.list() });
      } catch (error) {
        return errorResponse(error, "list");
      }
    },

    async create(request: Request) {
      try {
        const item = await service.create(await requestBody(request));
        return Response.json({ item }, { status: 201 });
      } catch (error) {
        return errorResponse(error, "create");
      }
    },

    async get(id: string) {
      try {
        const item = await service.getById(id);
        return item ? Response.json({ item }) : notFoundResponse();
      } catch (error) {
        return errorResponse(error, "load");
      }
    },

    async update(id: string, request: Request) {
      try {
        const body = await requestBody(request);
        if (includesCompletionField(body) && !isCompletionUpdate(body)) {
          throw new InvalidShoppingPatchError(
            "Completion updates cannot include editable item fields",
          );
        }

        const item = isCompletionUpdate(body)
          ? await service.setCompleted(id, body.completed)
          : await service.update(id, body);

        return item ? Response.json({ item }) : notFoundResponse();
      } catch (error) {
        return errorResponse(error, "update");
      }
    },

    async delete(id: string) {
      try {
        return (await service.delete(id))
          ? new Response(null, { status: 204 })
          : notFoundResponse();
      } catch (error) {
        return errorResponse(error, "delete");
      }
    },
  };
}
