CREATE TABLE "spending_source_documents" (
	"source_producer" text NOT NULL,
	"source_document_id" text NOT NULL,
	"source_period_key" text NOT NULL,
	CONSTRAINT "spending_source_documents_source_producer_source_document_id_pk" PRIMARY KEY("source_producer","source_document_id")
);
--> statement-breakpoint
ALTER TABLE "spending_imports" ADD COLUMN "source_period_key" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "spending_source_documents_document_period_unique" ON "spending_source_documents" USING btree ("source_producer","source_document_id","source_period_key");--> statement-breakpoint
ALTER TABLE "spending_imports" ADD CONSTRAINT "spending_imports_source_document_period_spending_source_documents_fk" FOREIGN KEY ("source_producer","source_document_id","source_period_key") REFERENCES "public"."spending_source_documents"("source_producer","source_document_id","source_period_key") ON DELETE no action ON UPDATE no action;