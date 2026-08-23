export type FamilyMember = {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
};

export type EventCategory = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  isActive: boolean;
};

export type Participant = {
  id: string;
  name: string;
  color: string;
};

export type CalendarOccurrence = {
  id: string;
  title: string;
  description: string | null;

  startAt: string;
  endAt: string;

  allDay: boolean;
  location: string | null;

  categoryId: string | null;
  recurrenceRule: string | null;

  category: {
    id: string;
    name: string;
    color: string;
  } | null;

  participants: Participant[];

  occurrenceKey: string;
  occurrenceStartAt: string;
  occurrenceEndAt: string;

  recurring: boolean;
};
