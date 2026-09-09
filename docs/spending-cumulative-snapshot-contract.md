# Spending cumulative snapshot contract v1

**Status:** Canonical ChatGPT-to-Family-Hub ingestion contract for cumulative household Spending reports.

This contract is the agent-facing companion to [ADR-001](adr/ADR-001-spending-v2-agent-ingestion.md). It defines the structured snapshot that ChatGPT submits after it interprets an uploaded cumulative `Household Spending Budget.md`. It is intentionally independent of Markdown headings, tables, parsing libraries, or a Family Hub page upload flow.

Family Hub validates, reconciles, and persists this snapshot through `spending_reconcile_snapshot` (MCP) or `POST /api/spending/reconcile` (HTTP). It never accepts raw household Markdown at that boundary.

## Normal household command

Upload the latest cumulative `Household Spending Budget.md` to ChatGPT and ask:

> Import this Household Spending Budget into Family Hub. Reconcile every period in the report and summarize unchanged, updated, inserted, and partial periods.

ChatGPT constructs one complete snapshot from the report, computes its canonical content hash, submits it to Family Hub, and reports the returned reconciliation summary. There is no Family Hub Spending-page upload workflow.

## Canonical payload

The exact schema version is `spending-reconciliation/v1`.

```json
{
  "schemaVersion": "spending-reconciliation/v1",
  "source": {
    "producer": "chatgpt-household-spending",
    "documentId": "household-spending-budget",
    "revision": "2026-10-08T08:00:00Z",
    "issuedAt": "2026-10-08T08:00:00Z",
    "importedBy": "chatgpt",
    "contentSha256": "<lowercase SHA-256 of canonical payload without this field>"
  },
  "periods": [
    {
      "sourcePeriodKey": "2026-09-28-to-2026-10-27",
      "startDate": "2026-09-28",
      "endDate": "2026-10-27",
      "currency": "ZAR",
      "total": "710.00",
      "status": "partial",
      "categories": [
        {
          "sourceCategoryKey": "groceries",
          "name": "Groceries",
          "total": "690.00",
          "lines": [
            {
              "sourceTransactionKey": "2026-10-02-example-market",
              "lineType": "transaction",
              "date": "2026-10-02",
              "description": "Example Market",
              "amount": "690.00"
            }
          ]
        },
        {
          "sourceCategoryKey": "home-maintenance",
          "name": "Home maintenance",
          "total": "20.00",
          "lines": [
            {
              "sourceTransactionKey": "2026-10-maintenance-provision",
              "lineType": "assumption",
              "description": "Opening maintenance provision",
              "amount": "20.00"
            }
          ]
        }
      ]
    }
  ]
}
```

## Required contract rules

### Source and import metadata

- `source.producer` is a stable identifier for the upstream process and scopes every source key. Use `chatgpt-household-spending` for the normal workflow unless an explicit future producer is introduced.
- `source.documentId` identifies the logical cumulative household report. It remains stable when that report is corrected or refreshed.
- `source.revision` identifies the emitted report revision. It is a non-empty string; it may be a timestamp, number, or upstream revision label.
- `source.issuedAt` is an ISO-8601 timestamp with an explicit offset.
- `source.importedBy` identifies the submitting actor, normally `chatgpt`.
- `source.contentSha256` is a lowercase 64-character SHA-256 digest. Compute it over UTF-8 canonical JSON of the complete payload after omitting only `source.contentSha256`: preserve array order; serialize JSON primitives normally; recursively sort every object’s property names lexicographically; and emit no whitespace. Family Hub rejects a mismatch. Every sanitized JSON fixture in this directory is a hash-valid interoperability vector for this exact algorithm.

Amounts are signed decimal strings, never JavaScript numbers. `currency` is a three-letter ISO 4217 code and applies to every total and line in its period. Period and category totals are authoritative source values: Family Hub must not recompute them from lines.

### Cumulative periods and partial cutoff headings

- `periods` contains every eligible historical and current period visible in the source report, not only the newest completed period.
- Each period has one `sourcePeriodKey`, normally stable date-boundary form such as `2026-09-28-to-2026-10-27`. It must be unique within the snapshot and stable across later report revisions.
- `startDate` and `endDate` describe the **logical reporting period**, not the source document's partial-report cutoff. The end date cannot precede the start date.
- The household `Household Spending Budget.md` uses a fixed 28th-to-27th cadence. For a partial heading such as `28 Aug 2026 - 3 Sep 2026 (partial period)`, `3 Sep` is the source **as-of/cutoff** date, not a reporting boundary. ChatGPT first confirms the cadence from the completed period headings in the same cumulative document (for example `28 Jul 2026 - 27 Aug 2026`); then it derives the logical end as the 27th immediately before the next 28th after the partial heading's start. It must therefore emit `startDate: 2026-08-28`, `endDate: 2026-09-27`, and `sourcePeriodKey: 2026-08-28-to-2026-09-27`. It must not use the visible cutoff as a period end or invent a `Reporting period:` source line. If the uploaded document does not establish the 28th-to-27th cadence, ChatGPT must ask for the cumulative history needed to establish it rather than guess an identity.
- The cutoff is source interpretation/provenance, not a separate v1 payload field: `source.revision` and `source.issuedAt` identify the emitted snapshot, while dated transaction lines show the included detail. Family Hub never infers a different period boundary from those dates.
- A period is `completed` when its logical source reporting interval is final. A currently open interval is `partial`.
- A later snapshot may refresh a `partial` period repeatedly, then submit the same logical key and end boundary as `completed`. Family Hub records `partial-refresh` or `completed-from-partial` as appropriate. A completed period must never regress to partial.

### Categories and source lines

- `categories` is a complete dynamic array for that period. Category keys are not Family Hub enums and new/renamed/retired categories require no schema migration.
- Category identity is `(source.producer, sourceCategoryKey)`. Its display `name` is historical source data and is not the identity.
- ChatGPT maintains a per-`(source.producer, source.documentId)` v1 identity map while interpreting successive cumulative revisions. For a newly observed category, derive `sourceCategoryKey` by Unicode-normalizing its source heading, lowercasing it, converting runs of non-alphanumeric characters to one `-`, and trimming `-` (for example, `Home maintenance` becomes `home-maintenance`). Preserve that key on every later snapshot for the same category lineage; a case, spacing, punctuation, or display-name correction changes only `name`, not the key. A semantic rename retains the existing key only when the retained cumulative history or prior snapshot unambiguously identifies it as the same category; otherwise treat it as a new category and leave the prior key retired. Do not silently merge ambiguous categories.
- A category's optional `lines` differentiates absence of source detail (omit `lines`) from an explicitly supplied empty list (`"lines": []`).
- Every line has a `sourceTransactionKey` unique within its period, a non-empty `description`, a decimal `amount`, and one of `transaction`, `assumption`, or `adjustment` as `lineType`.
- A `transaction` line must have a dated ISO `date`. `assumption` and `adjustment` lines may omit `date`; Family Hub must not invent one or reinterpret the source meaning.
- `sourceTransactionKey` is the stable identity of every source line, despite its legacy field name. For a newly observed line, derive a readable base key from `lineType`, then (for transactions) `YYYY-MM-DD`, then the normalized description using the category-normalization algorithm; for example, `transaction-2026-09-01-example-market` and `assumption-opening-maintenance-provision`. When two new lines have the same base within a period, order those colliding lines by source order and append `-2`, `-3`, and so on. This rule applies equally to `transaction`, `assumption`, and `adjustment` lines.
- Before deriving a new key, ChatGPT must match a line to its identity-map entry from the preceding cumulative revision. First match an unchanged line by category lineage, `lineType`, transaction date when present, and normalized description. For a corrected description or amount, retain the previous key when exactly one prior line remains after matching the same category lineage, `lineType`, date (or undated source slot), and source-order occurrence; the corrected fields are then emitted as new source data under that unchanged key. Existing exact matches always win before source-order matching, so inserting a new duplicate does not renumber existing lines. If a correction has multiple plausible prior matches, ChatGPT must request clarification or a stable upstream marker instead of guessing a key. A changed `lineType`, date, or category is a new line unless the cumulative source explicitly establishes the prior identity.

## Corrections and reconciliation confirmation

A corrected historical period is sent using the same `sourcePeriodKey` with changed authoritative source values and a new source revision/hash. Family Hub replaces that period atomically and returns it in `summary.updated`. Do not omit unchanged historical periods just because they need no update: their inclusion proves the source is cumulative and lets the result identify them as unchanged.

On a successful request, Family Hub returns:

```json
{
  "success": true,
  "summary": {
    "processed": 5,
    "unchanged": ["2026-05-28-to-2026-06-27"],
    "updated": ["2026-06-28-to-2026-07-27"],
    "inserted": ["2026-08-28-to-2026-09-27"],
    "partialRefreshed": ["2026-09-28-to-2026-10-27"],
    "completedFromPartial": []
  }
}
```

ChatGPT should summarize this result in user-facing language: processed count; unchanged periods; historical corrections (`updated`); new completed periods (`inserted`); and current partial periods (`partialRefreshed` or `completedFromPartial`). If the service returns `success: false`, preserve its safe error code/message and do not claim the import completed.

## Reconciliation audit history

For operational troubleshooting, `spending_list_reconciliation_history` exposes one safe audit entry per reconciled period. It can be filtered with an optional `sourceProducer` and returns the source producer/document/revision, issued/imported/reconciled timestamps, importing actor, content SHA-256, logical period key, and reconciliation action. It deliberately does not return raw Markdown, category data, transactions, or transaction descriptions.

Use this read-only MCP tool to confirm the latest successful agent reconciliation and review per-period outcomes. `spending_list_imports` remains available for import provenance; reconciliation history adds the persisted action for each period.

## Sanitized workflow fixtures

`fixtures/spending-cumulative-workflow/` provides representative, non-private snapshots:

- `initial.json`: two completed historical periods and one partial period.
- `historical-correction-and-new-period.json`: unchanged history, one corrected historical period, one new completed period, and one new partial period.
- `partial-refresh.json`: a safe refresh of that partial period.
- `partial-cutoff-source.md`: a sanitized cumulative-Markdown-shaped source with completed and partial period headings, anchored category headings, dated transaction bullets, explicit category/period totals, a non-dated assumption line, and an excluded section. It contains `28 Aug 2026 - 3 Sep 2026 (partial period)` but no invented reporting-boundary metadata; the preceding completed 28th-to-27th heading establishes the cadence.
- `partial-cutoff.json` and `partial-finalized.json`: hash-valid successive structured snapshots demonstrating that a source cutoff heading first reconciles as partial and later finalizes under the same `2026-08-28-to-2026-09-27` identity. They also demonstrate stable category and source-line keys: unchanged lines retain their keys and a corrected non-dated assumption retains its key while its display text changes.

The integration test reads the Markdown-shaped source fixture and exercises its structured snapshots through the production HTTP reconciliation adapter and reconciliation service/repository. All merchant names, dates, values, and source identifiers in the fixtures are synthetic and must not be replaced with household source data.
