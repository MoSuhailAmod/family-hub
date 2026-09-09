ALTER TABLE "spending_reconciliation_log" DROP CONSTRAINT "spending_reconciliation_log_import_id_spending_imports_id_fk";
--> statement-breakpoint
ALTER TABLE "spending_reconciliation_log" DROP CONSTRAINT "spending_reconciliation_log_period_id_spending_periods_id_fk";
--> statement-breakpoint
DROP INDEX "spending_source_documents_document_period_unique";--> statement-breakpoint
ALTER TABLE "spending_imports" ALTER COLUMN "source_period_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "spending_source_documents" ALTER COLUMN "source_period_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "spending_imports" ADD CONSTRAINT "spending_imports_source_document_spending_source_documents_fk" FOREIGN KEY ("source_producer","source_document_id") REFERENCES "public"."spending_source_documents"("source_producer","source_document_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "spending_periods_id_import_unique" ON "spending_periods" USING btree ("id","import_id");--> statement-breakpoint
ALTER TABLE "spending_reconciliation_log" ADD CONSTRAINT "spending_reconciliation_log_period_import_spending_periods_fk" FOREIGN KEY ("period_id","import_id") REFERENCES "public"."spending_periods"("id","import_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spending_imports" ADD CONSTRAINT "spending_imports_source_period_count_check" CHECK ("spending_imports"."source_period_count" >= 1);--> statement-breakpoint
ALTER TABLE "spending_transactions" ADD CONSTRAINT "spending_transactions_transaction_date_check" CHECK ("spending_transactions"."line_type" <> 'transaction' or "spending_transactions"."source_transaction_date" is not null);--> statement-breakpoint
ALTER TABLE "spending_transactions" ADD CONSTRAINT "spending_transactions_display_order_check" CHECK ("spending_transactions"."display_order" >= 0);