ALTER TABLE "calendar_event_reminders" DROP CONSTRAINT "calendar_event_reminders_offset_minutes_check";--> statement-breakpoint
ALTER TABLE "event_categories" ADD COLUMN "default_reminder_offsets" integer[] DEFAULT ARRAY[]::integer[] NOT NULL;--> statement-breakpoint
-- Backfill default notification profiles for the household's existing seeded
-- categories, matched by name. New/renamed categories keep the column default
-- (no profile) until deliberately set.
UPDATE "event_categories" SET "default_reminder_offsets" = ARRAY[1440] WHERE "name" = 'Family';--> statement-breakpoint
UPDATE "event_categories" SET "default_reminder_offsets" = ARRAY[10080, 2880, 1440] WHERE "name" = 'School';--> statement-breakpoint
UPDATE "event_categories" SET "default_reminder_offsets" = ARRAY[60] WHERE "name" = 'Work';--> statement-breakpoint
UPDATE "event_categories" SET "default_reminder_offsets" = ARRAY[1440] WHERE "name" = 'Medical';--> statement-breakpoint
UPDATE "event_categories" SET "default_reminder_offsets" = ARRAY[10080, 1440] WHERE "name" = 'Birthday';--> statement-breakpoint
UPDATE "event_categories" SET "default_reminder_offsets" = ARRAY[1440] WHERE "name" = 'Appointment';--> statement-breakpoint
UPDATE "event_categories" SET "default_reminder_offsets" = ARRAY[10080] WHERE "name" = 'Holiday';--> statement-breakpoint
ALTER TABLE "calendar_event_reminders" ADD CONSTRAINT "calendar_event_reminders_offset_minutes_check" CHECK ("calendar_event_reminders"."offset_minutes" in (10, 30, 60, 1440, 2880, 10080));--> statement-breakpoint
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_default_reminder_offsets_check" CHECK ("event_categories"."default_reminder_offsets" <@ ARRAY[10, 30, 60, 1440, 2880, 10080]::integer[]);