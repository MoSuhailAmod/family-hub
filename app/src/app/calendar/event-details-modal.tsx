"use client";

import {
  X,
  MapPin,
  Tag,
  Repeat,
  Calendar,
  Clock,
  Users,
  FileText,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { canEditCalendarEvent } from "@/lib/calendar-edit";
import {
  canDeleteCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/calendar-delete";
import type { CalendarOccurrence } from "@/lib/calendar-types";

type CalendarDisplayEvent = {
  id: string;
  groupId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;

  extendedProps: {
    seriesId: string;
    ownerColor: string;
    participants:
      CalendarOccurrence["participants"];
    recurring: boolean;
    description: string | null;
    location: string | null;
    category:
      CalendarOccurrence["category"];
  };
};

type Props = {
  event: CalendarDisplayEvent | null;
  onClose: () => void;
  onEdit: (seriesId: string) => void;
  onDeleted: () => void;
};

const TIME_ZONE = "Africa/Johannesburg";

function formatDateLong(date: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTimeRange(start: Date | null, end: Date | null) {
  if (!start) return "";
  const s = new Intl.DateTimeFormat("en-ZA", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(start);
  if (!end) return s;
  const e = new Intl.DateTimeFormat("en-ZA", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(end);
  return `${s} – ${e}`;
}

function startToDate(raw: string | null) {
  return raw ? new Date(raw) : null;
}

function isAllDay(event: CalendarDisplayEvent) {
  return event.allDay;
}

function isMultiDay(event: CalendarDisplayEvent) {
  const s = startToDate(event.start);
  const e = startToDate(event.end);
  if (!s || !e) return false;

  if (isAllDay(event)) {
    // FullCalendar uses an exclusive end for all-day events.
    // A single-day all-day event arrives as start=Aug 27,
    // end=Aug 28 00:00:00 (exclusive). Only when the gap is
    // more than one day is it genuinely multi-day.
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays =
      (e.getTime() - s.getTime()) / msPerDay;
    return diffDays > 1;
  }

  return s.toDateString() !== e.toDateString();
}

function allDayInclusiveEnd(
  event: CalendarDisplayEvent,
) {
  const s = startToDate(event.start);
  const e = startToDate(event.end);
  if (!s || !e) return null;

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays =
    (e.getTime() - s.getTime()) / msPerDay;

  if (
    diffDays > 1 &&
    e.getHours() === 0 &&
    e.getMinutes() === 0
  ) {
    return new Date(e.getTime() - msPerDay);
  }
  return e;
}

export default function EventDetailsModal({
  event,
  onClose,
  onEdit,
  onDeleted,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const deletionInFlightRef = useRef(false);
  const [confirmingDeletion, setConfirmingDeletion] =
    useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onClose();
    };
    dialog.addEventListener("keydown", handleKey);
    return () =>
      dialog.removeEventListener("keydown", handleKey);
  }, [isDeleting, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (event) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [event]);

  if (!event) return null;

  const startDate = startToDate(event.start);
  const endDate =
    isAllDay(event)
      ? allDayInclusiveEnd(event)
      : startToDate(event.end);
  const participants = event.extendedProps.participants;

  const showAllDay = isAllDay(event);
  const multiDay = isMultiDay(event);
  const canEdit = canEditCalendarEvent(
    event.extendedProps.seriesId,
  );
  const canDelete = canDeleteCalendarEvent(
    event.extendedProps.seriesId,
  );

  async function handleDelete() {
    if (deletionInFlightRef.current) return;

    const eventToDelete = event;
    if (!eventToDelete) return;

    deletionInFlightRef.current = true;
    setIsDeleting(true);
    setDeletionError(null);

    const result = await deleteCalendarEvent(
      eventToDelete.extendedProps.seriesId,
    );

    deletionInFlightRef.current = false;
    setIsDeleting(false);

    if (result.success) {
      onDeleted();
      return;
    }

    setDeletionError(result.error);
  }

  return (
    <dialog
      ref={dialogRef}
      className="event-details-backdrop"
      aria-modal="true"
      aria-labelledby="event-details-title"
      aria-describedby="event-details-body"
    >
      <div className="event-details-dialog">
        <header className="event-details-header">
          <h2
            id="event-details-title"
            className="event-details-title"
          >
            Event details
          </h2>
          <button
            type="button"
            className="event-details-close"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close event details"
          >
            <X size={18} />
          </button>
        </header>

        <div className="event-details-body" id="event-details-body">
          {/* Title */}
          <h1 className="event-details-event-title">
            {event.title}
          </h1>

          {/* Date / time block */}
          <section className="event-details-meta">
            <div className="event-details-date-row">
              <Calendar
                size={15}
                className="event-details-icon"
              />
              <span className="event-details-date">
                {formatDateLong(startDate)}
                {multiDay && endDate && (
                  <>
                    {" → "}
                    {formatDateLong(endDate)}
                  </>
                )}
              </span>
            </div>

            {showAllDay ? (
              <div className="event-details-allday-row">
                <Clock
                  size={15}
                  className="event-details-icon"
                />
                <span className="event-details-allday-label">
                  All day
                </span>
              </div>
            ) : (
              <div className="event-details-time-row">
                <Clock
                  size={15}
                  className="event-details-icon"
                />
                <span className="event-details-time">
                  {formatTimeRange(startDate, endDate)}
                </span>
              </div>
            )}
          </section>

          {/* Participants */}
          <section className="event-details-section">
            <div className="event-details-section-label">
              <Users size={14} />
              <span>People</span>
            </div>
            <div className="event-details-participants">
              {participants.length > 0 ? (
                participants.map((p) => (
                  <span
                    key={p.id}
                    className="event-details-participant"
                  >
                    <span
                      className="event-details-participant-dot"
                      style={{ background: p.color }}
                    />
                    {p.name}
                  </span>
                ))
              ) : (
                <span className="event-details-unassigned">
                  Unassigned
                </span>
              )}
            </div>
          </section>

          {/* Location */}
          {event.extendedProps.location ? (
            <section className="event-details-section">
              <div className="event-details-section-label">
                <MapPin size={14} />
                <span>Location</span>
              </div>
              <p className="event-details-location">
                {event.extendedProps.location}
              </p>
            </section>
          ) : null}

          {/* Category */}
          {event.extendedProps.category ? (
            <section className="event-details-section">
              <div className="event-details-section-label">
                <Tag size={14} />
                <span>Category</span>
              </div>
              <span className="event-details-category">
                {event.extendedProps.category.name}
              </span>
            </section>
          ) : null}

          {/* Recurrence */}
          {event.extendedProps.recurring ? (
            <section className="event-details-section">
              <div className="event-details-section-label">
                <Repeat size={14} />
                <span>Recurrence</span>
              </div>
              <p className="event-details-recurrence">
                Recurring event — edits apply to the entire series.
              </p>
            </section>
          ) : null}

          {/* Description */}
          {event.extendedProps.description ? (
            <section className="event-details-section">
              <div className="event-details-section-label">
                <FileText size={14} />
                <span>Notes</span>
              </div>
              <p className="event-details-description">
                {event.extendedProps.description}
              </p>
            </section>
          ) : null}

          <section className="event-details-actions">
            {canEdit ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => onEdit(event.extendedProps.seriesId)}
                disabled={isDeleting}
              >
                <Pencil size={15} />
                Edit event
              </button>
            ) : (
              <p className="event-details-external-notice">
                This event is managed in Google Calendar and cannot be edited
                from Family Hub.
              </p>
            )}

            {deletionError && (
              <p className="event-details-delete-error" role="alert">
                {deletionError}
              </p>
            )}

            {canDelete ? (
              confirmingDeletion ? (
                <div
                  className="event-details-delete-confirmation"
                  role="alertdialog"
                  aria-labelledby="delete-event-title"
                  aria-describedby="delete-event-description"
                >
                  <h3 id="delete-event-title">Delete event?</h3>
                  <p id="delete-event-description">
                    Delete “{event.title}”? This deletion is permanent from
                    Family Hub.
                    {event.extendedProps.recurring && (
                      <> This deletes the entire series.</>
                    )}
                  </p>
                  <div className="event-details-delete-buttons">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setConfirmingDeletion(false)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void handleDelete()}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting…" : "Delete event"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="event-details-delete-button"
                  onClick={() => {
                    setDeletionError(null);
                    setConfirmingDeletion(true);
                  }}
                  disabled={isDeleting}
                >
                  <Trash2 size={16} />
                  Delete event
                </button>
              )
            ) : (
              <p className="event-details-external-notice">
                This event is managed in Google Calendar and cannot be
                deleted from Family Hub.
              </p>
            )}
          </section>
        </div>
      </div>
    </dialog>
  );
}
