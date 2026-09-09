# ADR-001: Spending V2 — agent-ingested, database-backed Spending

- **Status:** Accepted
- **Date:** 2026-09-09
- **Parent feature:** #60 — `Spending | Feature: add household spending history and insights`

## Context

The first Spending implementation made the Family Hub Spending page part of the ingestion pipeline: the household selected a Markdown/JSON file in the UI, Family Hub parsed and previewed it, then imported the resulting payload.

That implementation is technically workable but does not match the intended product model. Spending data is updated only about once or twice per month, while Family Hub is viewed regularly. The Spending page should therefore be a dashboard over durable structured data, not a document-processing screen.

The household source is a cumulative `Household Spending Budget.md` report. Each new report may contain all previous periods, the newest completed period, a current partial period, category totals, transactions, explicit source assumptions, and historical corrections.

The report is already processed upstream. Family Hub must not reproduce categorisation, exclusion, refund matching, account-transfer detection, category combination, or other financial interpretation.

## Decision

Spending V2 separates ingestion, reconciliation, storage, and presentation:

```text
Household Spending Budget.md
        ↓
ChatGPT — normal household ingestion interface
        ↓
structured cumulative Spending snapshot
        ↓
Family Hub reconciliation service / API / MCP boundary
        ↓
PostgreSQL — durable runtime data source
        ↓
Family Hub Spending UI — read-only dashboard and drill-down
```

### 1. ChatGPT is the normal ingestion interface

The normal household workflow is conversational:

> Here is my latest Spending document. Import it into Family Hub.

ChatGPT validates/extracts the cumulative report and submits a structured snapshot to Family Hub. Hermes remains the implementation agent and may support future unattended automation, but Hermes is not the normal household Spending input interface for V2.

### 2. Markdown is an ingestion artifact, not a runtime dependency

The source Markdown is used to ingest/reconcile data. Once reconciliation succeeds, the Spending UI does not need the document. Family Hub may retain provenance such as hashes/revisions, but the dashboard reads structured records from PostgreSQL.

### 3. Reconcile every eligible source period

A cumulative report is reconciled period-by-period, not reduced to only the latest completed period.

For example:

```text
March      unchanged → no-op
April      unchanged → no-op
May        changed   → update/replace atomically
June       unchanged → no-op
July       unchanged → no-op
August     new       → insert
September  partial   → insert/update as partial
```

This is intentionally different from the current Markdown upload implementation, which selects one completed period.

### 4. Family Hub owns reconciliation and persistence

ChatGPT must not write directly to PostgreSQL. Family Hub exposes a shared domain/service boundary for reconciliation. Conceptually:

```text
get_spending_periods()
get_spending_period(period_key)
reconcile_spending_snapshot(snapshot)
```

The same domain logic may later be exposed through HTTP and MCP without duplicating business rules.

### 5. Period lifecycle

At minimum, periods support:

- `partial`
- `completed`

A partial period can be visible in the dashboard. A later cumulative report may refresh it repeatedly and eventually transition it to `completed` without creating a duplicate period.

### 6. Source totals are authoritative

Period and category totals explicitly stated in the processed source are persisted as supplied. Transactions provide drill-down detail; Family Hub does not independently recalculate the financial report and replace source totals.

### 7. Categories remain dynamic

Categories are data, not schema columns. New, renamed, retired, split, or combined categories must not require database migrations. Historical source classification remains preserved. Reporting/group mappings may remain available for non-destructive normalized trends.

### 8. Transaction/source-line semantics are preserved

Individual dated transactions are stored as structured records. The source can also contain non-bank source lines such as assumptions. The persistence model may distinguish line types such as `transaction`, `assumption`, or `adjustment` where needed; Family Hub must not invent a date or reinterpret their financial meaning.

### 9. Spending UI becomes presentation-only

The normal Spending screen removes:

- Markdown upload control
- JSON upload control
- upload preview/confirmation as the primary workflow
- browser document parsing
- browser/server preparation solely for the page upload workflow
- user-facing `spending-import/v1` terminology

It instead opens directly to database-backed information: latest completed period, optional current partial period, total spending, category breakdowns, trends, history, and transaction drill-down.

### 10. Existing history remains for traceability

Existing Spending issues and merged implementation are not deleted from GitHub. New work is added as subsequent tasks under #60. Code that implements the retired UI workflow may be removed by the new tasks, while useful persistence/service/UI foundations are retained where they fit this ADR.

## Target reconciliation behavior

For each imported period Family Hub determines a deterministic outcome such as:

- `insert`
- `update`
- `unchanged`
- `partial-refresh`
- `completed-from-partial`

Changed-period replacement must be transactional. An import failure must not leave a half-reconciled period.

Stable logical period identity should primarily derive from the source start/end dates, for example `2026-07-28-to-2026-08-27`, so later cumulative documents map back to the same logical period.

## Target persistence concepts

The existing schema must be reviewed rather than discarded automatically. The V2 target needs equivalents of:

- `spending_import_documents` / source provenance
- `spending_periods`
- `spending_categories`
- `spending_period_categories`
- `spending_transactions`
- `spending_reconciliation_log`

Important integrity concepts include one logical source period per household and deterministic transaction identities within a period.

## Privacy and security

Spending source files contain private household financial information.

- Real source documents must not be committed to the repository.
- Automated tests use sanitized representative fixtures.
- Logs should record reconciliation outcomes without unnecessarily duplicating transaction-level private data.
- Agent/API interfaces expose only the data required for the workflow.
- Raw source retention is not required for dashboard operation.

## Consequences

### Positive

- Family Hub Spending becomes a clean household dashboard rather than an import utility.
- There is one normal household ingestion interface: ChatGPT.
- Cumulative reports can repair historical data automatically.
- Partial periods can be kept current and later finalized.
- Structured database data powers future trends, insights, search, and drill-down.
- Reconciliation and database integrity remain owned by Family Hub.

### Trade-offs

- Reconciliation becomes more sophisticated than the original single-period import.
- Family Hub needs a deliberate agent-facing ingestion boundary.
- Import provenance and regression coverage become more important.
- Normal ingestion depends on the ChatGPT/Family Hub integration path.

These trade-offs are accepted because ingestion is infrequent and the household already uses ChatGPT as the Family Hub administrative interface.

## Rejected alternatives

### Keep the Spending-page upload workflow

Rejected because it makes the dashboard responsible for document ingestion and exposes implementation details that are irrelevant to normal household use.

### Use Hermes as the primary household ingestion interface

Rejected for V2 because the user wants one conversational control point and updates are infrequent. Hermes remains the implementation agent and may support future automation.

### Render/store Markdown as the runtime source

Rejected because the product requires structured period/category/transaction queries and historical comparison without re-parsing documents at runtime.

### Allow ChatGPT to write directly to PostgreSQL

Rejected because reconciliation and persistence integrity must remain centralized in Family Hub.

## Implementation principle

> **Markdown is an ingestion source. PostgreSQL is the runtime data source. ChatGPT is the household ingestion interface. Family Hub owns reconciliation and persistence.**

## Design references

See [Spending V2 design reference](../design/spending-v2/README.md) for the approved data flow, user flow, database direction, and dashboard mockup.