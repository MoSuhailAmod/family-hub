import {
  createEvent,
  getEventsForRange,
} from "@/lib/calendar-data";

import { parseEventInput } from "@/lib/validation";

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

    const start = new Date(startValue);
    const end = new Date(endValue);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return Response.json(
        {
          error: "Invalid date range",
        },
        {
          status: 400,
        },
      );
    }

    const items = await getEventsForRange(start, end);

    return Response.json({
      items,
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

    const event = await createEvent(parsed.data);

    return Response.json(
      {
        event,
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
