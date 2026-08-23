import { RRule } from "rrule";

export type ExpandableEvent = {
  id: string;
  startAt: Date;
  endAt: Date;
  recurrenceRule: string | null;
};

export type EventOccurrence<T extends ExpandableEvent> = T & {
  occurrenceKey: string;
  occurrenceStartAt: Date;
  occurrenceEndAt: Date;
  recurring: boolean;
};

export function expandEventForRange<T extends ExpandableEvent>(
  event: T,
  rangeStart: Date,
  rangeEnd: Date,
): EventOccurrence<T>[] {
  const duration = event.endAt.getTime() - event.startAt.getTime();

  if (!event.recurrenceRule) {
    if (event.startAt < rangeEnd && event.endAt > rangeStart) {
      return [
        {
          ...event,
          occurrenceKey: event.id,
          occurrenceStartAt: event.startAt,
          occurrenceEndAt: event.endAt,
          recurring: false,
        },
      ];
    }

    return [];
  }

  const options = RRule.parseString(
    event.recurrenceRule.replace(/^RRULE:/i, ""),
  );

  const rule = new RRule({
    ...options,
    dtstart: event.startAt,
  });

  const searchStart = new Date(rangeStart.getTime() - duration);

  return rule
    .between(searchStart, rangeEnd, true)
    .map((occurrenceStartAt) => {
      const occurrenceEndAt = new Date(
        occurrenceStartAt.getTime() + duration,
      );

      return {
        ...event,
        occurrenceKey: `${event.id}:${occurrenceStartAt.toISOString()}`,
        occurrenceStartAt,
        occurrenceEndAt,
        recurring: true,
      };
    })
    .filter(
      (occurrence) =>
        occurrence.occurrenceStartAt < rangeEnd &&
        occurrence.occurrenceEndAt > rangeStart,
    );
}
