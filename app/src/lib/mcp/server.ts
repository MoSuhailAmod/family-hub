import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import {
  getCalendarEventService,
  createCalendarEventService,
  updateCalendarEventService,
  deleteCalendarEventService,
  getFamilyMembersService,
  getEventCategoriesService,
  listCalendarEventsService,
} from "@/lib/calendar-service";

export function createFamilyHubMcpServer() {
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

  return server;
}
