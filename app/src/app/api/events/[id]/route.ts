import {
  deleteEvent,
  getEventById,
  updateEvent,
} from "@/lib/calendar-data";

import { parseEventInput } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const event = await getEventById(id);

    if (!event) {
      return Response.json(
        {
          error: "Event not found",
        },
        {
          status: 404,
        },
      );
    }

    return Response.json({
      event,
    });
  } catch (error) {
    console.error("Failed to load event:", error);

    return Response.json(
      {
        error: "Failed to load event",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const body = await request.json();

    const parsed = parseEventInput(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Validation failed",
          details: parsed.errors,
        },
        {
          status: 400,
        },
      );
    }

    const event = await updateEvent(id, parsed.data);

    if (!event) {
      return Response.json(
        {
          error: "Event not found",
        },
        {
          status: 404,
        },
      );
    }

    return Response.json({
      event,
    });
  } catch (error) {
    console.error("Failed to update event:", error);

    return Response.json(
      {
        error: "Failed to update event",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const deleted = await deleteEvent(id);

    if (!deleted) {
      return Response.json(
        {
          error: "Event not found",
        },
        {
          status: 404,
        },
      );
    }

    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    console.error("Failed to delete event:", error);

    return Response.json(
      {
        error: "Failed to delete event",
      },
      {
        status: 500,
      },
    );
  }
}
