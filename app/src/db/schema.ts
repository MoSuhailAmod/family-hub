import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
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
