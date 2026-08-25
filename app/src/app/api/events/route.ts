import { getGoogleCalendarEvents } from "@/lib/google-calendar";
import type { CalendarOccurrence } from "@/lib/calendar-types";
import {
  createCalendarEventService,
  listCalendarEventsService,
} from "@/lib/calendar-service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const startValue = url.searchParams.get("start");
    const endValue = url.searchParams.get("end");

    if (!startValue || !endValue) {
      return Response.json(
        {
          error: "start and end query parameters are required",
        },
        {
          status: 400,
        },
      );
    }

    const result = await listCalendarEventsService(
      startValue,
      endValue,
    );

    if (!result.success) {
      return Response.json(
        {
          error: result.error,
          details: result.details,
        },
        {
          status: 400,
        },
      );
    }

    let googleEvents: CalendarOccurrence[] = [];

    try {
      googleEvents = await getGoogleCalendarEvents(
        new Date(startValue),
        new Date(endValue),
      );
    } catch (error) {
      console.error(
        "Failed to load Google Calendar events:",
        error,
      );
    }

    return Response.json({
      items: [...result.data, ...googleEvents],
    });
  } catch (error) {
    console.error("Failed to load events:", error);

    return Response.json(
      {
        error: "Failed to load events",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await createCalendarEventService(body);

    if (!result.success) {
      return Response.json(
        {
          error: result.error,
          details: result.details,
        },
        {
          status: 400,
        },
      );
    }

    return Response.json(
      {
        event: result.data,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Failed to create event:", error);

    return Response.json(
      {
        error: "Failed to create event",
      },
      {
        status: 500,
      },
    );
  }
}
