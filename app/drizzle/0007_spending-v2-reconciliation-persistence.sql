CREATE TABLE "spending_reconciliation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"action" text NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spending_reconciliation_log_action_check" CHECK ("spending_reconciliation_log"."action" in ('insert', 'update', 'unchanged', 'partial-refresh', 'completed-from-partial'))
);
--> statement-breakpoint
ALTER TABLE "spending_imports" DROP CONSTRAINT "spending_imports_source_document_period_spending_source_documents_fk";
--> statement-breakpoint
ALTER TABLE "spending_periods" DROP CONSTRAINT "spending_periods_import_id_source_producer_period_spending_imports_fk";
--> statement-breakpoint
DROP INDEX "spending_imports_id_producer_period_unique";--> statement-breakpoint
DROP INDEX "spending_periods_import_unique";--> statement-breakpoint
ALTER TABLE "spending_transactions" ALTER COLUMN "source_transaction_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "spending_imports" ADD COLUMN "imported_by" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "spending_imports" ADD COLUMN "source_period_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "spending_periods" ADD COLUMN "status" text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "spending_transactions" ADD COLUMN "line_type" text DEFAULT 'transaction' NOT NULL;--> statement-breakpoint
ALTER TABLE "spending_transactions" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "spending_reconciliation_log" ADD CONSTRAINT "spending_reconciliation_log_import_id_spending_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."spending_imports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spending_reconciliation_log" ADD CONSTRAINT "spending_reconciliation_log_period_id_spending_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."spending_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spending_reconciliation_log_import_id_index" ON "spending_reconciliation_log" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "spending_reconciliation_log_period_id_index" ON "spending_reconciliation_log" USING btree ("period_id");--> statement-breakpoint
ALTER TABLE "spending_periods" ADD CONSTRAINT "spending_periods_import_id_source_producer_spending_imports_fk" FOREIGN KEY ("import_id","source_producer") REFERENCES "public"."spending_imports"("id","source_producer") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spending_periods" ADD CONSTRAINT "spending_periods_status_check" CHECK ("spending_periods"."status" in ('partial', 'completed'));--> statement-breakpoint
ALTER TABLE "spending_transactions" ADD CONSTRAINT "spending_transactions_line_type_check" CHECK ("spending_transactions"."line_type" in ('transaction', 'assumption', 'adjustment'));