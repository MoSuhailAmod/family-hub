import {
  createEvent,
  deleteEvent,
  getEventById,
  getEventsForRange,
  listFamilyMembers,
  updateEvent,
} from "@/lib/calendar-data";

import { parseEventInput } from "@/lib/validation";

export type ServiceErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_DATE_RANGE"
  | "NOT_FOUND";

export type ServiceResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      code: ServiceErrorCode;
      error: string;
      details?: unknown;
    };

export async function getFamilyMembersService() {
  return listFamilyMembers();
}

export async function listCalendarEventsService(
  startValue: string,
  endValue: string,
): Promise<ServiceResult<Awaited<ReturnType<typeof getEventsForRange>>>> {
  const start = new Date(startValue);
  const end = new Date(endValue);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return {
      success: false,
      code: "INVALID_DATE_RANGE",
      error: "Invalid date range",
    };
  }

  const events = await getEventsForRange(start, end);

  return {
    success: true,
    data: events,
  };
}

export async function getCalendarEventService(id: string) {
  const event = await getEventById(id);

  if (!event) {
    return {
      success: false as const,
      code: "NOT_FOUND" as const,
      error: "Event not found",
    };
  }

  return {
    success: true as const,
    data: event,
  };
}

export async function createCalendarEventService(
  input: unknown,
) {
  const parsed = parseEventInput(input);

  if (!parsed.success) {
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      error: "Validation failed",
      details: parsed.errors,
    };
  }

  const event = await createEvent(parsed.data);

  return {
    success: true as const,
    data: event,
  };
}

export async function updateCalendarEventService(
  id: string,
  input: unknown,
) {
  const parsed = parseEventInput(input);

  if (!parsed.success) {
    return {
      success: false as const,
      code: "VALIDATION_ERROR" as const,
      error: "Validation failed",
      details: parsed.errors,
    };
  }

  const event = await updateEvent(id, parsed.data);

  if (!event) {
    return {
      success: false as const,
      code: "NOT_FOUND" as const,
      error: "Event not found",
    };
  }

  return {
    success: true as const,
    data: event,
  };
}

export async function deleteCalendarEventService(id: string) {
  const deleted = await deleteEvent(id);

  if (!deleted) {
    return {
      success: false as const,
      code: "NOT_FOUND" as const,
      error: "Event not found",
    };
  }

  return {
    success: true as const,
    data: {
      deleted: true,
      id,
    },
  };
}
