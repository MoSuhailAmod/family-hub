CREATE TABLE "calendar_event_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"offset_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_event_reminders_offset_minutes_check" CHECK ("calendar_event_reminders"."offset_minutes" in (10, 30, 60, 1440, 10080))
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reminder_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"occurrence_key" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_attempted_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_deliveries_attempt_count_check" CHECK ("notification_deliveries"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notification_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_member_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"target" text NOT NULL,
	"label" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_event_reminders" ADD CONSTRAINT "calendar_event_reminders_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_reminder_id_calendar_event_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."calendar_event_reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_destination_id_notification_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."notification_destinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_destinations" ADD CONSTRAINT "notification_destinations_family_member_id_family_members_id_fk" FOREIGN KEY ("family_member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_event_reminders_event_offset_unique" ON "calendar_event_reminders" USING btree ("event_id","offset_minutes");--> statement-breakpoint
CREATE INDEX "calendar_event_reminders_event_id_index" ON "calendar_event_reminders" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_reminder_occurrence_destination_unique" ON "notification_deliveries" USING btree ("reminder_id","occurrence_key","destination_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_claim_index" ON "notification_deliveries" USING btree ("status","next_attempt_at","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_destinations_provider_target_unique" ON "notification_destinations" USING btree ("provider","target");--> statement-breakpoint
CREATE INDEX "notification_destinations_family_member_id_index" ON "notification_destinations" USING btree ("family_member_id");