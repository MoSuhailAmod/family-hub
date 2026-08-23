"use client";

import {
  ArrowRight,
  CalendarDays,
  Clock3,
} from "lucide-react";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  CalendarOccurrence,
} from "@/lib/calendar-types";

const TIME_ZONE = "Africa/Johannesburg";

function dayKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).formatToParts(new Date(value));

  const get = (type: string) =>
    parts.find((part) => part.type === type)
      ?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      timeZone: TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    },
  ).format(new Date(value));
}

function formatFullDate(value: Date) {
  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      timeZone: TIME_ZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  ).format(value);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      timeZone: TIME_ZONE,
      weekday: "short",
      day: "numeric",
      month: "short",
    },
  ).format(new Date(value));
}

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat(
      "en-ZA",
      {
        timeZone: TIME_ZONE,
        hour: "2-digit",
        hour12: false,
      },
    ).format(new Date()),
  );

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getPersonColor(
  event: CalendarOccurrence,
) {
  return (
    event.participants[0]?.color ??
    "#94A3B8"
  );
}

function EventCard({
  event,
  upcoming = false,
}: {
  event: CalendarOccurrence;
  upcoming?: boolean;
}) {
  const personColor = getPersonColor(event);

  return (
    <div
      className="dashboard-event-card"
      style={
        {
          "--person-color": personColor,
        } as React.CSSProperties
      }
    >
      <div className="dashboard-event-time">
        {upcoming ? (
          <span className="event-date-label">
            {formatShortDate(
              event.occurrenceStartAt,
            )}
          </span>
        ) : event.allDay ? (
          <span>All day</span>
        ) : (
          <>
            <Clock3 size={14} />
            <span>
              {formatTime(
                event.occurrenceStartAt,
              )}
            </span>
          </>
        )}
      </div>

      <div className="dashboard-event-body">
        <strong>{event.title}</strong>

        {upcoming && !event.allDay && (
          <span className="dashboard-event-secondary">
            {formatTime(
              event.occurrenceStartAt,
            )}
          </span>
        )}

        {event.participants.length > 0 && (
          <div className="dashboard-participants">
            {event.participants.map(
              (participant) => (
                <span
                  key={participant.id}
                  className="dashboard-person"
                >
                  <span
                    className="person-dot"
                    style={{
                      background:
                        participant.color,
                    }}
                  />

                  {participant.name}
                </span>
              ),
            )}

            {event.recurring && (
              <span className="recurring-label">
                Repeats
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [events, setEvents] = useState<
    CalendarOccurrence[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(end.getDate() + 30);

        const response = await fetch(
          `/api/events?start=${encodeURIComponent(
            start.toISOString(),
          )}&end=${encodeURIComponent(
            end.toISOString(),
          )}`,
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load calendar",
          );
        }

        const data = await response.json();

        setEvents(data.items ?? []);
      } catch (loadError) {
        console.error(loadError);

        setError(
          "The calendar could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const todayKey = dayKey(new Date());

  const today = useMemo(
    () =>
      events.filter(
        (event) =>
          dayKey(
            event.occurrenceStartAt,
          ) === todayKey,
      ),
    [events, todayKey],
  );

  const upcoming = useMemo(
    () =>
      events
        .filter(
          (event) =>
            dayKey(
              event.occurrenceStartAt,
            ) > todayKey,
        )
        .slice(0, 8),
    [events, todayKey],
  );

  return (
    <div className="page dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">
            {formatFullDate(new Date())}
          </p>

          <h1>{greeting()}</h1>

          <p className="page-subtitle">
            Here&apos;s what&apos;s happening
            with the family.
          </p>
        </div>

        <Link
          href="/calendar"
          className="primary-button"
        >
          <CalendarDays size={17} />
          Calendar
        </Link>
      </header>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="section-label">
                Today
              </p>
              <h2>
                {today.length
                  ? `${today.length} ${
                      today.length === 1
                        ? "event"
                        : "events"
                    }`
                  : "A quiet day"}
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="skeleton-line">
              Loading your day…
            </div>
          ) : today.length === 0 ? (
            <div className="dashboard-empty">
              <div className="empty-icon">
                <CalendarDays size={20} />
              </div>

              <div>
                <strong>
                  Nothing scheduled today
                </strong>
                <p>
                  Enjoy the breathing room.
                </p>
              </div>
            </div>
          ) : (
            <div className="dashboard-event-list">
              {today.map((event) => (
                <EventCard
                  key={event.occurrenceKey}
                  event={event}
                />
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <p className="section-label">
                Upcoming
              </p>
              <h2>Next on the calendar</h2>
            </div>

            <Link
              href="/calendar"
              className="text-link"
            >
              View calendar
              <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="skeleton-line">
              Loading upcoming events…
            </div>
          ) : upcoming.length === 0 ? (
            <div className="dashboard-empty">
              <div>
                <strong>
                  Nothing coming up
                </strong>
              </div>
            </div>
          ) : (
            <div className="dashboard-event-list">
              {upcoming.map((event) => (
                <EventCard
                  key={event.occurrenceKey}
                  event={event}
                  upcoming
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
