import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const shoppingItems = pgTable("shopping_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: text("name").notNull(),

  quantity: text("quantity"),

  notes: text("notes"),

  isCompleted: boolean("is_completed")
    .default(false)
    .notNull(),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  completedAt: timestamp("completed_at", {
    withTimezone: true,
  }),
});

export const familyMembers = pgTable("family_members", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: text("name")
    .notNull()
    .unique(),

  color: text("color")
    .notNull(),

  isActive: boolean("is_active")
    .default(true)
    .notNull(),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const eventCategories = pgTable("event_categories", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: text("name")
    .notNull()
    .unique(),

  color: text("color")
    .notNull(),

  icon: text("icon"),

  isActive: boolean("is_active")
    .default(true)
    .notNull(),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").defaultRandom().primaryKey(),

  title: text("title")
    .notNull(),

  description: text("description"),

  startAt: timestamp("start_at", {
    withTimezone: true,
  })
    .notNull(),

  endAt: timestamp("end_at", {
    withTimezone: true,
  })
    .notNull(),

  allDay: boolean("all_day")
    .default(false)
    .notNull(),

  location: text("location"),

  categoryId: uuid("category_id")
    .references(() => eventCategories.id, {
      onDelete: "set null",
    }),

  recurrenceRule: text("recurrence_rule"),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const eventParticipants = pgTable(
  "event_participants",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, {
        onDelete: "cascade",
      }),

    familyMemberId: uuid("family_member_id")
      .notNull()
      .references(() => familyMembers.id, {
        onDelete: "cascade",
      }),
  },
  (table) => [
    primaryKey({
      columns: [
        table.eventId,
        table.familyMemberId,
      ],
    }),
  ],
);

export const calendarEventReminders = pgTable(
  "calendar_event_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, {
        onDelete: "cascade",
      }),

    offsetMinutes: integer("offset_minutes").notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("calendar_event_reminders_event_offset_unique").on(
      table.eventId,
      table.offsetMinutes,
    ),
    index("calendar_event_reminders_event_id_index").on(table.eventId),
    check(
      "calendar_event_reminders_offset_minutes_check",
      sql`${table.offsetMinutes} in (10, 30, 60, 1440, 10080)`,
    ),
  ],
);

export const notificationDestinations = pgTable(
  "notification_destinations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    familyMemberId: uuid("family_member_id")
      .notNull()
      .references(() => familyMembers.id, {
        onDelete: "cascade",
      }),

    provider: text("provider").notNull(),

    target: text("target").notNull(),

    label: text("label"),

    enabled: boolean("enabled")
      .default(true)
      .notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("notification_destinations_provider_target_unique").on(
      table.provider,
      table.target,
    ),
    index("notification_destinations_family_member_id_index").on(
      table.familyMemberId,
    ),
  ],
);

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    reminderId: uuid("reminder_id")
      .notNull()
      .references(() => calendarEventReminders.id, {
        onDelete: "cascade",
      }),

    destinationId: uuid("destination_id")
      .notNull()
      .references(() => notificationDestinations.id, {
        onDelete: "cascade",
      }),

    occurrenceKey: text("occurrence_key").notNull(),

    scheduledFor: timestamp("scheduled_for", {
      withTimezone: true,
    }).notNull(),

    status: text("status")
      .default("pending")
      .notNull(),

    attemptCount: integer("attempt_count")
      .default(0)
      .notNull(),

    nextAttemptAt: timestamp("next_attempt_at", {
      withTimezone: true,
    }),

    lastAttemptedAt: timestamp("last_attempted_at", {
      withTimezone: true,
    }),

    deliveredAt: timestamp("delivered_at", {
      withTimezone: true,
    }),

    lastError: text("last_error"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("notification_deliveries_reminder_occurrence_destination_unique").on(
      table.reminderId,
      table.occurrenceKey,
      table.destinationId,
    ),
    index("notification_deliveries_claim_index").on(
      table.status,
      table.nextAttemptAt,
      table.scheduledFor,
    ),
    check(
      "notification_deliveries_attempt_count_check",
      sql`${table.attemptCount} >= 0`,
    ),
  ],
);

// Immutable source metadata for each imported source document revision.
export const spendingImports = pgTable(
  "spending_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    sourceProducer: text("source_producer").notNull(),
    sourceDocumentId: text("source_document_id").notNull(),
    sourceRevision: text("source_revision").notNull(),
    sourceContentSha256: text("source_content_sha256").notNull(),
    sourceIssuedAt: timestamp("source_issued_at", {
      withTimezone: true,
    }).notNull(),

    importedAt: timestamp("imported_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("spending_imports_id_producer_unique").on(
      table.id,
      table.sourceProducer,
    ),
    uniqueIndex("spending_imports_source_revision_unique").on(
      table.sourceProducer,
      table.sourceDocumentId,
      table.sourceRevision,
      table.sourceContentSha256,
    ),
    index("spending_imports_source_document_index").on(
      table.sourceProducer,
      table.sourceDocumentId,
    ),
  ],
);

// The current imported snapshot for a producer-defined logical period.
export const spendingPeriods = pgTable(
  "spending_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    importId: uuid("import_id").notNull(),
    sourceProducer: text("source_producer").notNull(),
    sourcePeriodKey: text("source_period_key").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    currency: text("currency").notNull(),
    total: numeric("total").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.importId, table.sourceProducer],
      foreignColumns: [spendingImports.id, spendingImports.sourceProducer],
      name: "spending_periods_import_id_source_producer_spending_imports_fk",
    }),
    uniqueIndex("spending_periods_id_producer_unique").on(
      table.id,
      table.sourceProducer,
    ),
    uniqueIndex("spending_periods_import_unique").on(table.importId),
    uniqueIndex("spending_periods_source_period_unique").on(
      table.sourceProducer,
      table.sourcePeriodKey,
    ),
  ],
);

// Stable source category identity. Display names belong to period snapshots below.
export const spendingCategories = pgTable(
  "spending_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    sourceProducer: text("source_producer").notNull(),
    sourceCategoryKey: text("source_category_key").notNull(),
  },
  (table) => [
    uniqueIndex("spending_categories_id_producer_unique").on(
      table.id,
      table.sourceProducer,
    ),
    uniqueIndex("spending_categories_source_category_unique").on(
      table.sourceProducer,
      table.sourceCategoryKey,
    ),
  ],
);

// Immutable category names and totals as imported for a single period.
export const spendingPeriodCategories = pgTable(
  "spending_period_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    periodId: uuid("period_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    sourceProducer: text("source_producer").notNull(),
    sourceCategoryName: text("source_category_name").notNull(),
    total: numeric("total").notNull(),
    transactionsProvided: boolean("transactions_provided").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.periodId, table.sourceProducer],
      foreignColumns: [spendingPeriods.id, spendingPeriods.sourceProducer],
      name: "spending_period_categories_period_id_source_producer_spending_periods_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.categoryId, table.sourceProducer],
      foreignColumns: [spendingCategories.id, spendingCategories.sourceProducer],
      name: "spending_period_categories_category_id_source_producer_spending_categories_fk",
    }),
    uniqueIndex("spending_period_categories_id_period_unique").on(
      table.id,
      table.periodId,
    ),
    uniqueIndex("spending_period_categories_period_category_unique").on(
      table.periodId,
      table.categoryId,
    ),
    index("spending_period_categories_period_id_index").on(table.periodId),
    index("spending_period_categories_category_id_index").on(table.categoryId),
  ],
);

// Optional source transaction detail; totals remain authoritative source values.
export const spendingTransactions = pgTable(
  "spending_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    periodId: uuid("period_id").notNull(),
    periodCategoryId: uuid("period_category_id").notNull(),
    sourceTransactionKey: text("source_transaction_key").notNull(),
    sourceTransactionDate: date("source_transaction_date").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.periodCategoryId, table.periodId],
      foreignColumns: [spendingPeriodCategories.id, spendingPeriodCategories.periodId],
      name: "spending_transactions_period_category_id_period_id_spending_period_categories_fk",
    }).onDelete("cascade"),
    uniqueIndex("spending_transactions_period_source_transaction_unique").on(
      table.periodId,
      table.sourceTransactionKey,
    ),
    index("spending_transactions_period_category_id_index").on(
      table.periodCategoryId,
    ),
    index("spending_transactions_period_date_index").on(
      table.periodId,
      table.sourceTransactionDate,
    ),
  ],
);

// Family Hub-owned reporting mappings can evolve without changing source snapshots.
export const spendingReportingGroups = pgTable(
  "spending_reporting_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
  },
  (table) => [uniqueIndex("spending_reporting_groups_name_unique").on(table.name)],
);

export const spendingCategoryReportingGroups = pgTable(
  "spending_category_reporting_groups",
  {
    categoryId: uuid("category_id")
      .notNull()
      .references(() => spendingCategories.id, {
        onDelete: "cascade",
      }),
    reportingGroupId: uuid("reporting_group_id")
      .notNull()
      .references(() => spendingReportingGroups.id, {
        onDelete: "cascade",
      }),
  },
  (table) => [
    uniqueIndex("spending_category_reporting_groups_category_group_unique").on(
      table.categoryId,
      table.reportingGroupId,
    ),
  ],
);
