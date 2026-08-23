import type { PoolClient } from "pg";

import { pool } from "@/lib/db";
import type { EventInput } from "@/lib/validation";
import { expandEventForRange } from "@/lib/recurrence";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  start_at: Date;
  end_at: Date;
  all_day: boolean;
  location: string | null;
  category_id: string | null;
  recurrence_rule: string | null;
  created_at: Date;
  updated_at: Date;
  category_name: string | null;
  category_color: string | null;
};

type ParticipantRow = {
  event_id: string;
  id: string;
  name: string;
  color: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string | null;
  categoryId: string | null;
  recurrenceRule: string | null;
  createdAt: Date;
  updatedAt: Date;

  category: {
    id: string;
    name: string;
    color: string;
  } | null;

  participants: {
    id: string;
    name: string;
    color: string;
  }[];
};

export async function listFamilyMembers() {
  const result = await pool.query(
    `
      SELECT
        id,
        name,
        color,
        is_active AS "isActive"
      FROM family_members
      WHERE is_active = true
      ORDER BY name
    `,
  );

  return result.rows;
}

export async function listEventCategories() {
  const result = await pool.query(
    `
      SELECT
        id,
        name,
        color,
        icon,
        is_active AS "isActive"
      FROM event_categories
      WHERE is_active = true
      ORDER BY name
    `,
  );

  return result.rows;
}

async function getParticipantsForEvents(ids: string[]) {
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      color: string;
    }[]
  >();

  if (ids.length === 0) {
    return map;
  }

  const result = await pool.query<ParticipantRow>(
    `
      SELECT
        ep.event_id,
        fm.id,
        fm.name,
        fm.color
      FROM event_participants ep
      INNER JOIN family_members fm
        ON fm.id = ep.family_member_id
      WHERE ep.event_id = ANY($1::uuid[])
      ORDER BY fm.name
    `,
    [ids],
  );

  for (const row of result.rows) {
    const existing = map.get(row.event_id) ?? [];

    existing.push({
      id: row.id,
      name: row.name,
      color: row.color,
    });

    map.set(row.event_id, existing);
  }

  return map;
}

function mapEvent(
  row: EventRow,
  participantMap: Map<
    string,
    {
      id: string;
      name: string;
      color: string;
    }[]
  >,
): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: row.all_day,
    location: row.location,
    categoryId: row.category_id,
    recurrenceRule: row.recurrence_rule,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    category:
      row.category_id &&
      row.category_name &&
      row.category_color
        ? {
            id: row.category_id,
            name: row.category_name,
            color: row.category_color,
          }
        : null,

    participants: participantMap.get(row.id) ?? [],
  };
}

export async function getEventById(id: string) {
  const result = await pool.query<EventRow>(
    `
      SELECT
        e.*,
        c.name AS category_name,
        c.color AS category_color
      FROM calendar_events e
      LEFT JOIN event_categories c
        ON c.id = e.category_id
      WHERE e.id = $1
      LIMIT 1
    `,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const participantMap = await getParticipantsForEvents([id]);

  return mapEvent(result.rows[0], participantMap);
}

export async function getEventsForRange(
  rangeStart: Date,
  rangeEnd: Date,
) {
  const result = await pool.query<EventRow>(
    `
      SELECT
        e.*,
        c.name AS category_name,
        c.color AS category_color
      FROM calendar_events e
      LEFT JOIN event_categories c
        ON c.id = e.category_id
      WHERE
        (
          e.recurrence_rule IS NULL
          AND e.start_at < $2
          AND e.end_at > $1
        )
        OR
        (
          e.recurrence_rule IS NOT NULL
          AND e.start_at < $2
        )
      ORDER BY e.start_at
    `,
    [rangeStart, rangeEnd],
  );

  const participantMap = await getParticipantsForEvents(
    result.rows.map((row) => row.id),
  );

  return result.rows
    .flatMap((row) => {
      const event = mapEvent(row, participantMap);

      return expandEventForRange(
        event,
        rangeStart,
        rangeEnd,
      );
    })
    .sort(
      (a, b) =>
        a.occurrenceStartAt.getTime() -
        b.occurrenceStartAt.getTime(),
    );
}

async function insertParticipants(
  client: PoolClient,
  eventId: string,
  participantIds: string[],
) {
  for (const familyMemberId of participantIds) {
    await client.query(
      `
        INSERT INTO event_participants (
          event_id,
          family_member_id
        )
        VALUES ($1, $2)
      `,
      [eventId, familyMemberId],
    );
  }
}

export async function createEvent(input: EventInput) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<{ id: string }>(
      `
        INSERT INTO calendar_events (
          title,
          description,
          start_at,
          end_at,
          all_day,
          location,
          category_id,
          recurrence_rule
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8
        )
        RETURNING id
      `,
      [
        input.title,
        input.description,
        new Date(input.startAt),
        new Date(input.endAt),
        input.allDay,
        input.location,
        input.categoryId,
        input.recurrenceRule,
      ],
    );

    const eventId = result.rows[0].id;

    await insertParticipants(
      client,
      eventId,
      input.participantIds,
    );

    await client.query("COMMIT");

    return getEventById(eventId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEvent(
  id: string,
  input: EventInput,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        UPDATE calendar_events
        SET
          title = $2,
          description = $3,
          start_at = $4,
          end_at = $5,
          all_day = $6,
          location = $7,
          category_id = $8,
          recurrence_rule = $9,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [
        id,
        input.title,
        input.description,
        new Date(input.startAt),
        new Date(input.endAt),
        input.allDay,
        input.location,
        input.categoryId,
        input.recurrenceRule,
      ],
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
        DELETE FROM event_participants
        WHERE event_id = $1
      `,
      [id],
    );

    await insertParticipants(
      client,
      id,
      input.participantIds,
    );

    await client.query("COMMIT");

    return getEventById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteEvent(id: string) {
  const result = await pool.query(
    `
      DELETE FROM calendar_events
      WHERE id = $1
      RETURNING id
    `,
    [id],
  );

  return result.rowCount === 1;
}
