import { pool } from "@/lib/db";
import {
  createNotificationDestinationService,
  type NotificationDestination,
} from "@/lib/notification-destinations";

type DestinationRow = {
  id: string;
  family_member_id: string;
  family_member_name: string;
  provider: string;
  target: string;
  label: string | null;
  enabled: boolean;
};

function map(row: DestinationRow): NotificationDestination {
  return {
    id: row.id,
    familyMemberId: row.family_member_id,
    familyMemberName: row.family_member_name,
    provider: row.provider,
    target: row.target,
    label: row.label,
    enabled: row.enabled,
  };
}

async function returnedDestination(query: string, values: unknown[]) {
  const result = await pool.query<DestinationRow>(query, values);
  return result.rows[0] ? map(result.rows[0]) : null;
}

export const notificationDestinationRepository = {
  async memberExists(id: string) {
    const result = await pool.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM family_members WHERE id = $1) AS exists",
      [id],
    );
    return result.rows[0].exists;
  },
  async list(memberIds?: string[]) {
    const result = await pool.query<DestinationRow>(
      `SELECT nd.id, nd.family_member_id, fm.name AS family_member_name,
              nd.provider, nd.target, nd.label, nd.enabled
       FROM notification_destinations nd
       INNER JOIN family_members fm ON fm.id = nd.family_member_id
       WHERE $1::uuid[] IS NULL OR nd.family_member_id = ANY($1::uuid[])
       ORDER BY fm.name, nd.provider, nd.target`,
      [memberIds?.length ? memberIds : null],
    );
    return result.rows.map(map);
  },
  create(input: Omit<NotificationDestination, "id" | "familyMemberName">) {
    return returnedDestination(
      `WITH inserted AS (
         INSERT INTO notification_destinations (family_member_id, provider, target, label, enabled)
         VALUES ($1, $2, $3, $4, $5) RETURNING *
       ) SELECT inserted.id, inserted.family_member_id, fm.name AS family_member_name,
                inserted.provider, inserted.target, inserted.label, inserted.enabled
         FROM inserted INNER JOIN family_members fm ON fm.id = inserted.family_member_id`,
      [input.familyMemberId, input.provider, input.target, input.label, input.enabled],
    ).then((item) => {
      if (!item) throw new Error("Notification destination insert did not return a row");
      return item;
    });
  },
  update(id: string, patch: Partial<Pick<NotificationDestination, "target" | "label" | "enabled">>) {
    return returnedDestination(
      `WITH updated AS (
         UPDATE notification_destinations
         SET target = CASE WHEN $2 THEN $3 ELSE target END,
             label = CASE WHEN $4 THEN $5 ELSE label END,
             enabled = CASE WHEN $6 THEN $7 ELSE enabled END,
             updated_at = NOW()
         WHERE id = $1 RETURNING *
       ) SELECT updated.id, updated.family_member_id, fm.name AS family_member_name,
                updated.provider, updated.target, updated.label, updated.enabled
         FROM updated INNER JOIN family_members fm ON fm.id = updated.family_member_id`,
      [id, patch.target !== undefined, patch.target ?? null, patch.label !== undefined, patch.label ?? null, patch.enabled !== undefined, patch.enabled ?? false],
    );
  },
  async delete(id: string) {
    const result = await pool.query("DELETE FROM notification_destinations WHERE id = $1", [id]);
    return result.rowCount === 1;
  },
};

export const notificationDestinationService = createNotificationDestinationService(
  notificationDestinationRepository,
);
