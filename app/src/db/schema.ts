import {
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
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
