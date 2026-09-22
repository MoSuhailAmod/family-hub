import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { spendingReconciliationService, spendingService } from "@/lib/spending";
import { shoppingService } from "@/lib/shopping";
import type { SpendingReconciliationService } from "@/lib/spending-reconciliation-route-handlers";
import type { SpendingService } from "@/lib/spending-route-handlers";
import type { ShoppingService } from "@/lib/shopping-route-handlers";
import { ShoppingValidationError } from "@/lib/shopping-validation";
import {
  getCalendarEventService,
  createCalendarEventService,
  updateCalendarEventService,
  deleteCalendarEventService,
  getFamilyMembersService,
  getEventCategoriesService,
  listCalendarEventsService,
} from "@/lib/calendar-service";

type FamilyHubMcpDependencies = {
  spendingService?: Pick<
    SpendingService,
    "listPeriods" | "getPeriod" | "listImportMetadata" | "listReconciliationHistory"
  >;
  spendingReconciliationService?: SpendingReconciliationService;
  shoppingService?: Pick<ShoppingService, "list" | "create" | "setCompleted">;
};

function shoppingFailure(error: unknown, operation: string) {
  if (error instanceof ShoppingValidationError) {
    return { success: false as const, code: "VALIDATION", error: error.message };
  }

  console.error(`Failed to ${operation} shopping item via MCP:`, error);
  return {
    success: false as const,
    code: "WRITE_FAILED",
    error: `Unable to ${operation} the shopping item`,
  };
}

export function createFamilyHubMcpServerWithDependencies(
  dependencies: FamilyHubMcpDependencies = {},
) {
  const spendingReads = dependencies.spendingService ?? spendingService;
  const reconciliation = dependencies.spendingReconciliationService ?? spendingReconciliationService;
  const shopping = dependencies.shoppingService ?? shoppingService;
  const server = new McpServer({
    name: "family-hub",
    version: "0.1.0",
  });

  server.registerTool(
    "family_hub_status",
    {
      description: "Check whether Family Hub is available.",
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            service: "family-hub",
          }),
        },
      ],
    }),
  );

  server.registerTool(
    "family_members_list",
    {
      description: "List active Family Hub family members.",
    },
    async () => {
      const items = await getFamilyMembersService();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ items }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "calendar_list_events",
    {
      description: "List calendar events within a date/time range.",
      inputSchema: z.object({
        start: z.string(),
        end: z.string(),
      }),
    },
    async ({ start, end }) => {
      const result =
        await listCalendarEventsService(start, end);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
        isError: !result.success,
      };
    },
  );

  server.registerTool(
    "calendar_get_event",
    {
      description: "Get one calendar event by UUID.",
      inputSchema: z.object({
        id: z.string().uuid(),
      }),
    },
    async ({ id }) => {
      const result =
        await getCalendarEventService(id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
        isError: !result.success,
      };
    },
  );
  server.registerTool(
    "event_categories_list",
    {
      description: "List active Family Hub event categories.",
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const items = await getEventCategoriesService();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ items }),
          },
        ],
      };
    },
  );


  server.registerTool(
    "calendar_create_event",
    {
      description: "Create a new Family Hub calendar event.",
      inputSchema: z.object({
        title: z.string(),
        description: z.string().nullable().optional(),
        startAt: z.string(),
        endAt: z.string(),
        allDay: z.boolean().optional(),
        location: z.string().nullable().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        recurrenceRule: z.string().nullable().optional(),
        participantIds: z.array(z.string().uuid()).optional(),
        reminderOffsets: z.array(z.union([
          z.literal(10),
          z.literal(30),
          z.literal(60),
          z.literal(1440),
          z.literal(10080),
        ])).optional(),
      }),
    },
    async (input) => {
      const result =
        await createCalendarEventService(input);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
        isError: !result.success,
      };
    },
  );


  server.registerTool(
    "calendar_update_event",
    {
      description: "Update an existing Family Hub calendar event.",
      inputSchema: z.object({
        id: z.string().uuid(),
        title: z.string(),
        description: z.string().nullable().optional(),
        startAt: z.string(),
        endAt: z.string(),
        allDay: z.boolean().optional(),
        location: z.string().nullable().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        recurrenceRule: z.string().nullable().optional(),
        participantIds: z.array(z.string().uuid()).optional(),
        reminderOffsets: z.array(z.union([
          z.literal(10),
          z.literal(30),
          z.literal(60),
          z.literal(1440),
          z.literal(10080),
        ])).optional(),
      }),
    },
    async ({ id, ...input }) => {
      const result =
        await updateCalendarEventService(id, input);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
        isError: !result.success,
      };
    },
  );

  server.registerTool(
    "calendar_delete_event",
    {
      description: "Delete a Family Hub calendar event by UUID.",
      inputSchema: z.object({
        id: z.string().uuid(),
      }),
    },
    async ({ id }) => {
      const result =
        await deleteCalendarEventService(id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
        isError: !result.success,
      };
    },
  );

  server.registerTool(
    "spending_list_periods",
    {
      description: "List current and historical Spending periods for agent reconciliation review.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const periods = await spendingReads.listPeriods();
        return { content: [{ type: "text", text: JSON.stringify({ success: true, data: periods }) }] };
      } catch {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, code: "READ_FAILED", error: "Unable to list Spending periods" }) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "spending_get_period",
    {
      description: "Get one Spending period and its import status by producer and source period key.",
      inputSchema: z.object({
        sourceProducer: z.string().min(1),
        sourcePeriodKey: z.string().min(1),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ sourceProducer, sourcePeriodKey }) => {
      try {
        const period = await spendingReads.getPeriod(sourceProducer, sourcePeriodKey);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(period
              ? { success: true, data: period }
              : { success: false, code: "NOT_FOUND", error: "Spending period not found" }),
          }],
          isError: !period,
        };
      } catch {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, code: "READ_FAILED", error: "Unable to load Spending period" }) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "spending_list_imports",
    {
      description: "List Spending import metadata and reconciliation provenance without transaction details.",
      inputSchema: z.object({ sourceProducer: z.string().min(1).optional() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ sourceProducer }) => {
      try {
        const imports = await spendingReads.listImportMetadata(sourceProducer);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, data: imports }) }] };
      } catch {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, code: "READ_FAILED", error: "Unable to list Spending imports" }) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "spending_list_reconciliation_history",
    {
      description: "List safe Spending reconciliation outcomes and source provenance without transaction or raw document content.",
      inputSchema: z.object({ sourceProducer: z.string().min(1).optional() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ sourceProducer }) => {
      try {
        const history = await spendingReads.listReconciliationHistory(sourceProducer);
        return { content: [{ type: "text", text: JSON.stringify({ success: true, data: history }) }] };
      } catch {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, code: "READ_FAILED", error: "Unable to list Spending reconciliation history" }) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "spending_reconcile_snapshot",
    {
      description: "Validate and reconcile a structured cumulative Spending snapshot through Family Hub's shared service.",
      inputSchema: z.object({ snapshot: z.unknown() }),
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async ({ snapshot }) => {
      const result = await reconciliation.reconcile(snapshot);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: !result.success,
      };
    },
  );

  server.registerTool(
    "shopping_list_items",
    {
      description: "List shopping items.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const items = await shopping.list();
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, data: items }) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify(shoppingFailure(error, "list")) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "shopping_create_item",
    {
      description: "Create a shopping item.",
      inputSchema: z.object({
        name: z.string().min(1),
        quantity: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const item = await shopping.create(input);
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, data: item }) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify(shoppingFailure(error, "create")) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "shopping_complete_item",
    {
      description: "Mark a shopping item as completed or incomplete.",
      inputSchema: z.object({ id: z.string().uuid(), completed: z.boolean() }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, completed }) => {
      try {
        const item = await shopping.setCompleted(id, completed);
        const result = item
          ? { success: true as const, data: item }
          : { success: false as const, code: "NOT_FOUND", error: "Shopping item not found" };
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          isError: !item,
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: JSON.stringify(shoppingFailure(error, "complete")) }],
          isError: true,
        };
      }
    },
  );

  return server;
}

export function createFamilyHubMcpServer() {
  return createFamilyHubMcpServerWithDependencies();
}
