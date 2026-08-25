import ical from "node-ical";
import { getFamilyMembersService } from "@/lib/calendar-service";

import type { CalendarOccurrence } from "@/lib/calendar-types";

type GoogleIcalEvent = {
  type?: string;
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: Date;
  end?: Date;
  datetype?: string;
  rrule?: {
    between(
      start: Date,
      end: Date,
      inclusive?: boolean,
    ): Date[];
  };
};

function getFamilyMemberName(
  description?: string,
) {
  if (!description) {
    return null;
  }

  const match = description.match(
    /family_member=([^\n<]+)/i,
  );

  return match?.[1]?.trim() ?? null;
}

function toOccurrence(
  event: GoogleIcalEvent,
  start: Date,
  end: Date,
  recurring: boolean,
  members: Awaited<ReturnType<typeof getFamilyMembersService>>,
): CalendarOccurrence {
  const uid = event.uid ?? `${start.getTime()}`;

  return {
    id: `google:${uid}`,
    title: event.summary ?? "Untitled Google event",
    description: event.description ?? null,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    allDay: event.datetype === "date",
    location: event.location ?? null,
    categoryId: null,
    recurrenceRule: null,
    category: null,
    participants: (() => {
      const memberName =
        getFamilyMemberName(event.description);

      const member = members.find(
        (item) =>
          item.name.toLowerCase() ===
          memberName?.toLowerCase(),
      );

      return member
        ? [{
            id: member.id,
            name: member.name,
            color: member.color,
          }]
        : [];
    })(),
    occurrenceKey: `google:${uid}:${start.toISOString()}`,
    occurrenceStartAt: start.toISOString(),
    occurrenceEndAt: end.toISOString(),
    recurring,
  };
}

export async function getGoogleCalendarEvents(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarOccurrence[]> {
  const url = process.env.GOOGLE_FAMILY_CALENDAR_ICS_URL;

  if (!url) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Google Calendar returned HTTP ${response.status}`,
      );
    }

    const calendar = await ical.async.parseICS(
      await response.text(),
    );

    const members = await getFamilyMembersService();
    const occurrences: CalendarOccurrence[] = [];

    for (const item of Object.values(calendar)) {
      const event = item as GoogleIcalEvent;

      if (
        event.type !== "VEVENT" ||
        !event.start ||
        !event.end
      ) {
        continue;
      }

      const duration =
        event.end.getTime() - event.start.getTime();

      if (event.rrule) {
        const starts = event.rrule.between(
          new Date(rangeStart.getTime() - duration),
          rangeEnd,
          true,
        );

        for (const start of starts) {
          const end = new Date(start.getTime() + duration);

          if (start < rangeEnd && end > rangeStart) {
            occurrences.push(
              toOccurrence(event, start, end, true, members),
            );
          }
        }

        continue;
      }

      if (
        event.start < rangeEnd &&
        event.end > rangeStart
      ) {
        occurrences.push(
          toOccurrence(
            event,
            event.start,
            event.end,
            false,
            members,
          ),
        );
      }
    }

    return occurrences;
  } finally {
    clearTimeout(timeout);
  }
}
