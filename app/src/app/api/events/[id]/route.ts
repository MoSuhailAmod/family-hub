import {
  deleteCalendarEventService,
  getCalendarEventService,
  updateCalendarEventService,
} from "@/lib/calendar-service";

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

    const result = await getCalendarEventService(id);

    if (!result.success) {
      return Response.json(
        {
          error: result.error,
        },
        {
          status: 404,
        },
      );
    }

    return Response.json({
      event: result.data,
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

    const result = await updateCalendarEventService(
      id,
      body,
    );

    if (!result.success) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : 400;

      return Response.json(
        {
          error: result.error,
          details: result.details,
        },
        {
          status,
        },
      );
    }

    return Response.json({
      event: result.data,
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

    const result = await deleteCalendarEventService(id);

    if (!result.success) {
      return Response.json(
        {
          error: result.error,
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
