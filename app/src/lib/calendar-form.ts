const JOHANNESBURG_OFFSET = "+02:00";

export type EventFormValues = {
  title: string;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  allDay: boolean;
  participantIds: string[];
  categoryId: string | null;
  location: string;
  description: string;
  recurrenceRule?: string | null;
};

type PersistedEventForForm = {
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  participants: Array<{ id: string }>;
  categoryId: string | null;
  location: string | null;
  description: string | null;
  recurrenceRule: string | null;
};

export type CreateEventPayload = {
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  participantIds: string[];
  categoryId: string | null;
  location: string;
  description: string;
  recurrenceRule: string | null;
};

export type CreateEventPayloadResult =
  | { success: true; data: CreateEventPayload }
  | { success: false; field: "end"; message: string };

function toJohannesburgIso(date: string, time = "00:00") {
  return new Date(`${date}T${time}:00${JOHANNESBURG_OFFSET}`).toISOString();
}

function nextDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function previousDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function johannesburgDateTimeParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

export function eventFormValuesFromPersistedEvent(
  event: PersistedEventForForm,
): EventFormValues {
  const start = johannesburgDateTimeParts(event.startAt);
  const end = johannesburgDateTimeParts(event.endAt);

  return {
    title: event.title,
    startDate: start.date,
    startTime: start.time,
    endDate: event.allDay ? previousDate(end.date) : end.date,
    endTime: end.time,
    allDay: event.allDay,
    participantIds: event.participants.map((participant) => participant.id),
    categoryId: event.categoryId,
    location: event.location ?? "",
    description: event.description ?? "",
    recurrenceRule: event.recurrenceRule,
  };
}

export function createEventPayload(
  values: EventFormValues,
): CreateEventPayloadResult {
  const startAt = toJohannesburgIso(
    values.startDate,
    values.allDay ? undefined : values.startTime,
  );
  const endAt = toJohannesburgIso(
    values.allDay ? nextDate(values.endDate) : values.endDate,
    values.allDay ? undefined : values.endTime,
  );

  if (new Date(endAt) <= new Date(startAt)) {
    return {
      success: false,
      field: "end",
      message: "End date/time must be after start date/time.",
    };
  }

  return {
    success: true,
    data: {
      title: values.title.trim(),
      startAt,
      endAt,
      allDay: values.allDay,
      participantIds: values.participantIds,
      categoryId: values.categoryId,
      location: values.location.trim(),
      description: values.description.trim(),
      recurrenceRule: values.recurrenceRule?.trim() || null,
    },
  };
}
