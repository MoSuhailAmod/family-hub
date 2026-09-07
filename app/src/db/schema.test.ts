import assert from "node:assert/strict";
import test from "node:test";

import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import * as schema from "./schema";

function assertTableColumns(
  exportName: string,
  expectedTableName: string,
  expectedColumns: string[],
) {
  const table = (schema as Record<string, unknown>)[exportName];
  assert.ok(table, `${exportName} table must be exported`);
  assert.equal(getTableName(table as never), expectedTableName);
  assert.deepEqual(Object.keys(getTableColumns(table as never)).sort(), expectedColumns);
}

test("defines the approved shopping_items persistence table", () => {
  assertTableColumns("shoppingItems", "shopping_items", [
    "completedAt",
    "createdAt",
    "id",
    "isCompleted",
    "name",
    "notes",
    "quantity",
    "updatedAt",
  ]);
});

test("defines calendar reminder rules with an event-scoped preset offset", () => {
  assertTableColumns("calendarEventReminders", "calendar_event_reminders", [
    "createdAt",
    "eventId",
    "id",
    "offsetMinutes",
    "updatedAt",
  ]);
});

test("defines multiple provider destinations per family member", () => {
  assertTableColumns("notificationDestinations", "notification_destinations", [
    "createdAt",
    "enabled",
    "familyMemberId",
    "id",
    "label",
    "provider",
    "target",
    "updatedAt",
  ]);
});

test("defines durable reminder delivery state with idempotency fields", () => {
  assertTableColumns("notificationDeliveries", "notification_deliveries", [
    "attemptCount",
    "createdAt",
    "deliveredAt",
    "destinationId",
    "id",
    "lastAttemptedAt",
    "lastError",
    "nextAttemptAt",
    "occurrenceKey",
    "reminderId",
    "scheduledFor",
    "status",
    "updatedAt",
  ]);
});

function constraintNames(table: Parameters<typeof getTableConfig>[0]) {
  const config = getTableConfig(table);

  return {
    checks: config.checks.map((check) => check.name).sort(),
    indexes: config.indexes.map((index) => index.config.name).sort(),
  };
}

test("defines required notification constraints and idempotency indexes", () => {
  assert.deepEqual(constraintNames(schema.calendarEventReminders), {
    checks: ["calendar_event_reminders_offset_minutes_check"],
    indexes: [
      "calendar_event_reminders_event_id_index",
      "calendar_event_reminders_event_offset_unique",
    ],
  });
  assert.deepEqual(constraintNames(schema.notificationDestinations), {
    checks: [],
    indexes: [
      "notification_destinations_family_member_id_index",
      "notification_destinations_provider_target_unique",
    ],
  });
  assert.deepEqual(constraintNames(schema.notificationDeliveries), {
    checks: ["notification_deliveries_attempt_count_check"],
    indexes: [
      "notification_deliveries_claim_index",
      "notification_deliveries_reminder_occurrence_destination_unique",
    ],
  });

  const reminderOffsetCheck = getTableConfig(
    schema.calendarEventReminders,
  ).checks.find(
    (check) => check.name === "calendar_event_reminders_offset_minutes_check",
  );
  assert.ok(reminderOffsetCheck);
  assert.match(
    new PgDialect().sqlToQuery(reminderOffsetCheck.value).sql,
    /\(10, 30, 60, 1440, 10080\)$/,
  );
});
