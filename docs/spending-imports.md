# Spending ingestion (superseded)

The legacy in-page Markdown/JSON document-upload workflow has been retired. The normal `/spending` page is now a read-only dashboard over persisted Spending data; it does not parse, preview, or upload household documents in the browser.

The approved replacement architecture is [ADR-001: Spending V2 — agent-ingested, database-backed Spending](adr/ADR-001-spending-v2-agent-ingestion.md). Under that design, ChatGPT processes the cumulative household report and submits a structured snapshot to Family Hub's reconciliation boundary. Family Hub remains responsible for validation, reconciliation, and durable persistence, while the Spending UI reads the stored results.

Historical import code and documentation remain available in Git history for traceability. The canonical import domain/service boundary is intentionally retained for subsequent V2 ingestion work.
