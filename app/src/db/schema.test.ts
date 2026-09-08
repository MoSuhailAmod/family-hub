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

function foreignKeyNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table)
    .foreignKeys.map((foreignKey) => foreignKey.getName())
    .sort();
}

test("defines flexible Spending source snapshots and future reporting mappings", () => {
  assertTableColumns("spendingSourceDocuments", "spending_source_documents", [
    "sourceDocumentId",
    "sourcePeriodKey",
    "sourceProducer",
  ]);
  assertTableColumns("spendingImports", "spending_imports", [
    "id",
    "importedAt",
    "sourceContentSha256",
    "sourceDocumentId",
    "sourceIssuedAt",
    "sourcePeriodKey",
    "sourceProducer",
    "sourceRevision",
  ]);
  assertTableColumns("spendingPeriods", "spending_periods", [
    "currency",
    "endDate",
    "id",
    "importId",
    "sourcePeriodKey",
    "sourceProducer",
    "startDate",
    "total",
  ]);
  assertTableColumns("spendingCategories", "spending_categories", [
    "id",
    "sourceCategoryKey",
    "sourceProducer",
  ]);
  assertTableColumns("spendingPeriodCategories", "spending_period_categories", [
    "categoryId",
    "id",
    "periodId",
    "sourceCategoryName",
    "sourceProducer",
    "total",
    "transactionsProvided",
  ]);
  assertTableColumns("spendingTransactions", "spending_transactions", [
    "amount",
    "description",
    "id",
    "periodCategoryId",
    "periodId",
    "sourceTransactionDate",
    "sourceTransactionKey",
  ]);
  assertTableColumns("spendingReportingGroups", "spending_reporting_groups", [
    "id",
    "name",
  ]);
  assertTableColumns(
    "spendingCategoryReportingGroups",
    "spending_category_reporting_groups",
    ["categoryId", "reportingGroupId"],
  );

  assert.deepEqual(constraintNames(schema.spendingSourceDocuments), {
    checks: [],
    indexes: ["spending_source_documents_document_period_unique"],
  });
  assert.deepEqual(constraintNames(schema.spendingImports), {
    checks: [],
    indexes: [
      "spending_imports_id_producer_unique",
      "spending_imports_source_document_index",
      "spending_imports_source_revision_unique",
    ],
  });
  assert.deepEqual(constraintNames(schema.spendingPeriods), {
    checks: [],
    indexes: [
      "spending_periods_id_producer_unique",
      "spending_periods_import_unique",
      "spending_periods_source_period_unique",
    ],
  });
  assert.deepEqual(constraintNames(schema.spendingCategories), {
    checks: [],
    indexes: [
      "spending_categories_id_producer_unique",
      "spending_categories_source_category_unique",
    ],
  });
  assert.deepEqual(constraintNames(schema.spendingPeriodCategories), {
    checks: [],
    indexes: [
      "spending_period_categories_category_id_index",
      "spending_period_categories_id_period_unique",
      "spending_period_categories_period_category_unique",
      "spending_period_categories_period_id_index",
    ],
  });
  assert.deepEqual(constraintNames(schema.spendingTransactions), {
    checks: [],
    indexes: [
      "spending_transactions_period_category_id_index",
      "spending_transactions_period_date_index",
      "spending_transactions_period_source_transaction_unique",
    ],
  });
  assert.deepEqual(foreignKeyNames(schema.spendingImports), [
    "spending_imports_source_document_period_spending_source_documents_fk",
  ]);
  assert.deepEqual(foreignKeyNames(schema.spendingPeriods), [
    "spending_periods_import_id_source_producer_spending_imports_fk",
  ]);
  assert.deepEqual(foreignKeyNames(schema.spendingPeriodCategories), [
    "spending_period_categories_category_id_source_producer_spending_categories_fk",
    "spending_period_categories_period_id_source_producer_spending_periods_fk",
  ]);
  assert.deepEqual(foreignKeyNames(schema.spendingTransactions), [
    "spending_transactions_period_category_id_period_id_spending_period_categories_fk",
  ]);

  assert.deepEqual(constraintNames(schema.spendingReportingGroups), {
    checks: [],
    indexes: ["spending_reporting_groups_name_unique"],
  });
  assert.deepEqual(constraintNames(schema.spendingCategoryReportingGroups), {
    checks: [],
    indexes: ["spending_category_reporting_groups_category_group_unique"],
  });
});

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
