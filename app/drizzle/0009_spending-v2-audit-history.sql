ALTER TABLE "spending_reconciliation_log" DROP CONSTRAINT "spending_reconciliation_log_period_import_spending_periods_fk";
--> statement-breakpoint
ALTER TABLE "spending_reconciliation_log" ALTER COLUMN "period_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "spending_reconciliation_log" ADD COLUMN "source_producer" text NOT NULL;--> statement-breakpoint
ALTER TABLE "spending_reconciliation_log" ADD COLUMN "source_period_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "spending_reconciliation_log" ADD CONSTRAINT "spending_reconciliation_log_import_spending_imports_fk" FOREIGN KEY ("import_id") REFERENCES "public"."spending_imports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spending_reconciliation_log" ADD CONSTRAINT "spending_reconciliation_log_period_spending_periods_fk" FOREIGN KEY ("period_id") REFERENCES "public"."spending_periods"("id") ON DELETE set null ON UPDATE no action;