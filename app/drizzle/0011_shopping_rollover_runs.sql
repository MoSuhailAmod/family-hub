CREATE TABLE "shopping_rollover_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_key" text NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_rollover_runs_week_key_unique" ON "shopping_rollover_runs" USING btree ("week_key");