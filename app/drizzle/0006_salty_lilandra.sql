ALTER TABLE "spending_periods" DROP CONSTRAINT "spending_periods_import_id_source_producer_spending_imports_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "spending_imports_id_producer_period_unique" ON "spending_imports" USING btree ("id","source_producer","source_period_key");
--> statement-breakpoint
ALTER TABLE "spending_periods" ADD CONSTRAINT "spending_periods_import_id_source_producer_period_spending_imports_fk" FOREIGN KEY ("import_id","source_producer","source_period_key") REFERENCES "public"."spending_imports"("id","source_producer","source_period_key") ON DELETE no action ON UPDATE no action;