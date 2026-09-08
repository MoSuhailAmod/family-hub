CREATE TABLE "spending_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_producer" text NOT NULL,
	"source_category_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spending_category_reporting_groups" (
	"category_id" uuid NOT NULL,
	"reporting_group_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spending_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_producer" text NOT NULL,
	"source_document_id" text NOT NULL,
	"source_revision" text NOT NULL,
	"source_content_sha256" text NOT NULL,
	"source_issued_at" timestamp with time zone NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spending_period_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"source_producer" text NOT NULL,
	"source_category_name" text NOT NULL,
	"total" numeric NOT NULL,
	"transactions_provided" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spending_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"source_producer" text NOT NULL,
	"source_period_key" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"currency" text NOT NULL,
	"total" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spending_reporting_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spending_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"period_category_id" uuid NOT NULL,
	"source_transaction_key" text NOT NULL,
	"source_transaction_date" date NOT NULL,
	"description" text NOT NULL,
	"amount" numeric NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "spending_categories_id_producer_unique" ON "spending_categories" USING btree ("id","source_producer");--> statement-breakpoint
CREATE UNIQUE INDEX "spending_imports_id_producer_unique" ON "spending_imports" USING btree ("id","source_producer");--> statement-breakpoint
CREATE UNIQUE INDEX "spending_period_categories_id_period_unique" ON "spending_period_categories" USING btree ("id","period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spending_periods_id_producer_unique" ON "spending_periods" USING btree ("id","source_producer");--> statement-breakpoint
ALTER TABLE "spending_category_reporting_groups" ADD CONSTRAINT "spending_category_reporting_groups_category_id_spending_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."spending_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spending_category_reporting_groups" ADD CONSTRAINT "spending_category_reporting_groups_reporting_group_id_spending_reporting_groups_id_fk" FOREIGN KEY ("reporting_group_id") REFERENCES "public"."spending_reporting_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spending_period_categories" ADD CONSTRAINT "spending_period_categories_period_id_source_producer_spending_periods_fk" FOREIGN KEY ("period_id","source_producer") REFERENCES "public"."spending_periods"("id","source_producer") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spending_period_categories" ADD CONSTRAINT "spending_period_categories_category_id_source_producer_spending_categories_fk" FOREIGN KEY ("category_id","source_producer") REFERENCES "public"."spending_categories"("id","source_producer") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spending_periods" ADD CONSTRAINT "spending_periods_import_id_source_producer_spending_imports_fk" FOREIGN KEY ("import_id","source_producer") REFERENCES "public"."spending_imports"("id","source_producer") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spending_transactions" ADD CONSTRAINT "spending_transactions_period_category_id_period_id_spending_period_categories_fk" FOREIGN KEY ("period_category_id","period_id") REFERENCES "public"."spending_period_categories"("id","period_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "spending_categories_source_category_unique" ON "spending_categories" USING btree ("source_producer","source_category_key");--> statement-breakpoint
CREATE UNIQUE INDEX "spending_category_reporting_groups_category_group_unique" ON "spending_category_reporting_groups" USING btree ("category_id","reporting_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spending_imports_source_revision_unique" ON "spending_imports" USING btree ("source_producer","source_document_id","source_revision","source_content_sha256");--> statement-breakpoint
CREATE INDEX "spending_imports_source_document_index" ON "spending_imports" USING btree ("source_producer","source_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spending_period_categories_period_category_unique" ON "spending_period_categories" USING btree ("period_id","category_id");--> statement-breakpoint
CREATE INDEX "spending_period_categories_period_id_index" ON "spending_period_categories" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "spending_period_categories_category_id_index" ON "spending_period_categories" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spending_periods_import_unique" ON "spending_periods" USING btree ("import_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spending_periods_source_period_unique" ON "spending_periods" USING btree ("source_producer","source_period_key");--> statement-breakpoint
CREATE UNIQUE INDEX "spending_reporting_groups_name_unique" ON "spending_reporting_groups" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "spending_transactions_period_source_transaction_unique" ON "spending_transactions" USING btree ("period_id","source_transaction_key");--> statement-breakpoint
CREATE INDEX "spending_transactions_period_category_id_index" ON "spending_transactions" USING btree ("period_category_id");--> statement-breakpoint
CREATE INDEX "spending_transactions_period_date_index" ON "spending_transactions" USING btree ("period_id","source_transaction_date");