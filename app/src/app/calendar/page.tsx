"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import listPlugin from "@fullcalendar/react/list";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import themePlugin from "@fullcalendar/react/themes/pulse";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  CalendarOccurrence,
  FamilyMember,
} from "@/lib/calendar-types";

const TIME_ZONE = "Africa/Johannesburg";

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

function personColor(
  event: CalendarOccurrence,
) {
  return (
    event.participants[0]?.color ??
    "#94A3B8"
  );
}

function readableText(color: string) {
  const normalized =
    color.replace("#", "");

  if (normalized.length !== 6) {
    return "#ffffff";
  }

  const red = parseInt(
    normalized.slice(0, 2),
    16,
  );

  const green = parseInt(
    normalized.slice(2, 4),
    16,
  );

  const blue = parseInt(
    normalized.slice(4, 6),
    16,
  );

  const luminance =
    (0.299 * red +
      0.587 * green +
      0.114 * blue) /
    255;

  return luminance > 0.66
    ? "#2D2610"
    : "#FFFFFF";
}

function formatTime(date: Date | null) {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      timeZone: TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    },
  ).format(date);
}

export default function CalendarPage() {
  const calendarRef = useRef(null);

  const [events, setEvents] = useState<
    CalendarDisplayEvent[]
  >([]);

  const [members, setMembers] = useState<
    FamilyMember[]
  >([]);

  const [
    activeMemberId,
    setActiveMemberId,
  ] = useState<string | null>(null);

  const [calendarTitle, setCalendarTitle] =
    useState("");

  const [activeView, setActiveView] =
    useState("dayGridMonth");

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    fetch("/api/family-members")
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Unable to load family members",
          );
        }

        return response.json();
      })
      .then((data) => {
        setMembers(data.items ?? []);
      })
      .catch((memberError) => {
        console.error(memberError);
      });
  }, []);

  const loadEvents = useCallback(
    async (
      start: Date,
      end: Date,
    ) => {
      try {
        setError(null);

        const response = await fetch(
          `/api/events?start=${encodeURIComponent(
            start.toISOString(),
          )}&end=${encodeURIComponent(
            end.toISOString(),
          )}`,
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load events",
          );
        }

        const data = await response.json();

        const mapped =
          (
            data.items as CalendarOccurrence[]
          ).map((event) => {
            const color =
              personColor(event);

            return {
              id: event.occurrenceKey,
              groupId: event.id,
              title: event.title,
              start:
                event.occurrenceStartAt,
              end:
                event.occurrenceEndAt,
              allDay: event.allDay,

              backgroundColor: color,
              borderColor: color,

              extendedProps: {
                seriesId: event.id,
                ownerColor: color,
                participants:
                  event.participants,
                recurring:
                  event.recurring,
                description:
                  event.description,
                location:
                  event.location,

                // Category remains available
                // to the UI but its colour is
                // intentionally not used.
                category: event.category,
              },
            };
          });

        setEvents(mapped);
      } catch (loadError) {
        console.error(loadError);

        setError(
          "Calendar events could not be loaded.",
        );
      }
    },
    [],
  );

  const filteredEvents = useMemo(
    () => {
      if (!activeMemberId) {
        return events;
      }

      return events.filter((event) =>
        event.extendedProps.participants.some(
          (participant) =>
            participant.id === activeMemberId,
        ),
      );
    },
    [events, activeMemberId],
  );

  function calendarApi() {
    const ref = calendarRef.current as
      | { getApi: () => {
          prev: () => void;
          next: () => void;
          today: () => void;
          changeView: (view: string) => void;
        } }
      | null;

    return ref?.getApi();
  }

  function movePrevious() {
    calendarApi()?.prev();
  }

  function moveNext() {
    calendarApi()?.next();
  }

  function moveToday() {
    calendarApi()?.today();
  }

  function changeView(view: string) {
    calendarApi()?.changeView(view);
  }

  return (
    <div className="page calendar-page">
      <header className="calendar-header">
        <div>
          <p className="eyebrow">
            Family schedule
          </p>

          <h1>Calendar</h1>

          <p className="page-subtitle">
            Everyone&apos;s plans in one
            place.
          </p>
        </div>

        <button
          className="primary-button"
          type="button"
          disabled
          title="Event creation is coming next"
        >
          <Plus size={17} />
          Add event
        </button>
      </header>

      <section className="calendar-toolbar-card">
        <div className="calendar-navigation">
          <button
            type="button"
            className="icon-button"
            onClick={movePrevious}
            aria-label="Previous"
          >
            <ChevronLeft size={19} />
          </button>

          <button
            type="button"
            className="icon-button"
            onClick={moveNext}
            aria-label="Next"
          >
            <ChevronRight size={19} />
          </button>

          <button
            type="button"
            className="today-button"
            onClick={moveToday}
          >
            <RotateCcw size={14} />
            Today
          </button>

          <div className="calendar-current-title">
            {calendarTitle}
          </div>
        </div>

        <div className="view-switcher">
          {[
            ["dayGridMonth", "Month"],
            ["timeGridWeek", "Week"],
            ["listMonth", "Agenda"],
          ].map(([view, label]) => (
            <button
              key={view}
              type="button"
              className={
                activeView === view
                  ? "view-button view-button-active"
                  : "view-button"
              }
              onClick={() =>
                changeView(view)
              }
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="family-filter-bar">
        <div className="family-filter-label">
          <CalendarDays size={16} />
          Show
        </div>

        <button
          type="button"
          className={
            activeMemberId === null
              ? "member-filter member-filter-all member-filter-active"
              : "member-filter member-filter-all"
          }
          onClick={() =>
            setActiveMemberId(null)
          }
        >
          Everyone
        </button>

        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            className={
              activeMemberId === member.id
                ? "member-filter member-filter-active"
                : "member-filter"
            }
            onClick={() =>
              setActiveMemberId(
                activeMemberId === member.id
                  ? null
                  : member.id,
              )
            }
          >
            <span
              className="member-color-dot"
              style={{
                background: member.color,
              }}
            />

            {member.name}
          </button>
        ))}
      </section>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <section className="calendar-surface">
        <FullCalendar
          ref={calendarRef}
          plugins={[
            themePlugin,
            dayGridPlugin,
            timeGridPlugin,
            listPlugin,
          ]}
          headerToolbar={false}
          initialView="dayGridMonth"
          firstDay={1}
          events={filteredEvents}
          height="auto"
          nowIndicator
          dayMaxEvents={3}
          eventDisplay="block"
          displayEventEnd
          datesSet={(info) => {
            setCalendarTitle(
              info.view.title,
            );

            setActiveView(
              info.view.type,
            );

            void loadEvents(
              info.start,
              info.end,
            );
          }}
          eventContent={(info) => {
            const participants =
              info.event.extendedProps
                .participants as CalendarOccurrence["participants"];

            const owner =
              participants[0] ?? null;

            const color =
              info.event.extendedProps
                .ownerColor as string;

            const textColor =
              readableText(color);

            return (
              <div
                className="family-calendar-event"
                style={{
                  background: color,
                  color: textColor,
                }}
              >
                <div className="calendar-event-topline">
                  {!info.event.allDay && (
                    <span className="calendar-event-time">
                      {formatTime(
                        info.event.start,
                      )}
                    </span>
                  )}

                  {info.event.extendedProps
                    .recurring && (
                    <span
                      className="repeat-indicator"
                      title="Recurring event"
                    >
                      ↻
                    </span>
                  )}
                </div>

                <strong className="calendar-event-title">
                  {info.event.title}
                </strong>

                {owner && (
                  <span className="calendar-event-owner">
                    {owner.name}
                    {participants.length > 1
                      ? ` +${participants.length - 1}`
                      : ""}
                  </span>
                )}
              </div>
            );
          }}
        />
      </section>
    </div>
  );
}
