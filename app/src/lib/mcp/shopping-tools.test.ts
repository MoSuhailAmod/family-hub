import assert from "node:assert/strict";
import test from "node:test";

import { createFamilyHubMcpServerWithDependencies } from "./server";
import { ShoppingValidationError } from "../shopping-validation";

type ToolResult = {
  content: { text: string }[];
  isError?: boolean;
};

type RegisteredTools = Record<string, { handler: (input: unknown) => Promise<ToolResult> }>;

function shoppingTools(dependencies: Parameters<typeof createFamilyHubMcpServerWithDependencies>[0]) {
  const server = createFamilyHubMcpServerWithDependencies(dependencies);
  return (server as unknown as { _registeredTools: RegisteredTools })._registeredTools;
}

test("registers shopping MCP tools and passes create input to the shared service", async () => {
  let received: unknown;
  const tools = shoppingTools({
    shoppingService: {
      list: async () => [],
      create: async (input) => {
        received = input;
        return {} as never;
      },
      setCompleted: async () => null,
    },
  });
  const input = { name: "Milk", quantity: "2 litres", notes: "Full cream" };

  assert.equal(Object.keys(tools).length, 16);
  assert.deepEqual(
    ["shopping_list_items", "shopping_create_item", "shopping_complete_item"].map((name) => Boolean(tools[name])),
    [true, true, true],
  );
  await tools.shopping_create_item.handler(input);
  assert.deepEqual(received, input);
});

test("returns a validation error message from the shopping service", async () => {
  const tools = shoppingTools({
    shoppingService: {
      list: async () => [],
      create: async () => {
        throw new ShoppingValidationError("Name is required");
      },
      setCompleted: async () => null,
    },
  });

  const result = await tools.shopping_create_item.handler({ name: "" });

  assert.equal(result.isError, true);
  assert.deepEqual(JSON.parse(result.content[0].text), {
    success: false,
    code: "VALIDATION",
    error: "Name is required",
  });
});

test("does not leak generic shopping service errors", async () => {
  const tools = shoppingTools({
    shoppingService: {
      list: async () => {
        throw new Error("database connection string");
      },
      create: async () => ({} as never),
      setCompleted: async () => null,
    },
  });

  const result = await tools.shopping_list_items.handler({});

  assert.equal(result.isError, true);
  assert.deepEqual(JSON.parse(result.content[0].text), {
    success: false,
    code: "WRITE_FAILED",
    error: "Unable to list the shopping item",
  });
});

test("returns not found when completing a missing shopping item", async () => {
  const tools = shoppingTools({
    shoppingService: {
      list: async () => [],
      create: async () => ({} as never),
      setCompleted: async () => null,
    },
  });

  const result = await tools.shopping_complete_item.handler({
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    completed: true,
  });

  assert.equal(result.isError, true);
  assert.deepEqual(JSON.parse(result.content[0].text), {
    success: false,
    code: "NOT_FOUND",
    error: "Shopping item not found",
  });
});
