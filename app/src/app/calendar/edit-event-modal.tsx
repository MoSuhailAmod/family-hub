"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  createEventPayload,
  eventFormValuesFromPersistedEvent,
  type EventFormValues,
} from "@/lib/calendar-form";
import type { EventCategory, FamilyMember } from "@/lib/calendar-types";

type PersistedEvent = {
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

type Props = {
  seriesId: string;
  members: FamilyMember[];
  categories: EventCategory[];
  onClose: () => void;
  onUpdated: () => void;
};

export default function EditEventModal({
  seriesId,
  members,
  categories,
  onClose,
  onUpdated,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submissionInFlight = useRef(false);
  const [form, setForm] = useState<EventFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog) dialog.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEvent() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/events/${encodeURIComponent(seriesId)}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load event.");
        }
        if (!cancelled) {
          setForm(eventFormValuesFromPersistedEvent(data.event as PersistedEvent));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load event.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadEvent();
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  const selectedMembers = useMemo(
    () => new Set(form?.participantIds ?? []),
    [form?.participantIds],
  );

  function close() {
    if (!saving) onClose();
  }

  function update<K extends keyof EventFormValues>(
    key: K,
    value: EventFormValues[K],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function toggleParticipant(memberId: string) {
    if (!form) return;
    update(
      "participantIds",
      selectedMembers.has(memberId)
        ? form.participantIds.filter((id) => id !== memberId)
        : [...form.participantIds, memberId],
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;

    setError(null);
    setFieldErrors({});
    if (!form.title.trim()) {
      setFieldErrors({ title: "Title is required." });
      return;
    }

    const payload = createEventPayload(form);
    if (!payload.success) {
      setFieldErrors({ [payload.field]: payload.message });
      return;
    }

    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setSaving(true);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(seriesId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.data),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const flattened = data.details?.fieldErrors as
          | Record<string, string[]>
          | undefined;
        if (flattened) {
          setFieldErrors(
            Object.fromEntries(
              Object.entries(flattened).map(([key, messages]) => [
                key === "endAt" ? "end" : key,
                messages[0] ?? "Invalid value.",
              ]),
            ),
          );
        }
        setError(data.error ?? "Unable to update event.");
        return;
      }

      onUpdated();
      onClose();
    } catch {
      setError("Unable to update event. Please try again.");
    } finally {
      submissionInFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="create-event-backdrop"
      aria-labelledby="edit-event-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form className="create-event-dialog" onSubmit={submit}>
        <header className="create-event-header">
          <div>
            <p className="eyebrow">Family schedule</p>
            <h2 id="edit-event-title">Edit event</h2>
          </div>
          <button type="button" className="event-details-close" onClick={close} aria-label="Close edit event form">
            ×
          </button>
        </header>

        <div className="create-event-body">
          {loading ? <p>Loading event…</p> : null}
          {error ? <div className="error-banner">{error}</div> : null}
          {form?.recurrenceRule ? <p className="edit-series-notice">This is a recurring event. Changes apply to the entire series.</p> : null}
          {form ? <>
            <label>
              Title <span aria-hidden="true">*</span>
              <input autoFocus value={form.title} onChange={(event) => update("title", event.target.value)} aria-invalid={Boolean(fieldErrors.title)} />
              {fieldErrors.title ? <span className="form-error">{fieldErrors.title}</span> : null}
            </label>
            <label className="checkbox-field">
              <input type="checkbox" checked={form.allDay} onChange={(event) => update("allDay", event.target.checked)} />
              All day
            </label>
            <div className="create-event-date-grid">
              <label>Start date <span aria-hidden="true">*</span><input type="date" required value={form.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
              {!form.allDay ? <label>Start time <span aria-hidden="true">*</span><input type="time" required value={form.startTime} onChange={(event) => update("startTime", event.target.value)} /></label> : null}
              <label>End date <span aria-hidden="true">*</span><input type="date" required value={form.endDate} onChange={(event) => update("endDate", event.target.value)} aria-invalid={Boolean(fieldErrors.end)} /></label>
              {!form.allDay ? <label>End time <span aria-hidden="true">*</span><input type="time" required value={form.endTime} onChange={(event) => update("endTime", event.target.value)} aria-invalid={Boolean(fieldErrors.end)} /></label> : null}
            </div>
            {fieldErrors.end ? <span className="form-error">{fieldErrors.end}</span> : null}
            <fieldset>
              <legend>Family members</legend>
              <div className="participant-options">
                {members.map((member) => <label key={member.id} className="participant-option"><input type="checkbox" checked={selectedMembers.has(member.id)} onChange={() => toggleParticipant(member.id)} /><span style={{ background: member.color }} className="member-color-dot" />{member.name}</label>)}
              </div>
            </fieldset>
            <label>Category<select value={form.categoryId ?? ""} onChange={(event) => update("categoryId", event.target.value || null)}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label>Location<input value={form.location} onChange={(event) => update("location", event.target.value)} /></label>
            <label>Notes<textarea rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
          </> : null}
        </div>
        <footer className="create-event-actions">
          <button type="button" className="secondary-button" onClick={close} disabled={saving}>Cancel</button>
          <button type="submit" className="primary-button" disabled={loading || saving || !form}>{saving ? "Saving…" : "Save changes"}</button>
        </footer>
      </form>
    </dialog>
  );
}
