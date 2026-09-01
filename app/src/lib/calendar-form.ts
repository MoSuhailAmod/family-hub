const JOHANNESBURG_OFFSET = "+02:00";

type EventFormValues = {
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
