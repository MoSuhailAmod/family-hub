# Issue #61: Spending import contract v1

**Status:** Approved import-boundary design for the Spending feature. This document defines the payload that a future Spending importer will consume. It does not add a database table, migration, upload endpoint, UI, categorisation rule, or calculation.

## Scope and boundaries

A payload represents exactly one completed spending period. The upstream spending-generation process remains the source of truth: its period dates, period total, category totals, transaction rows, category names, and category keys are imported as supplied.

Family Hub consumes this normalized output only. It must not accept a raw bank-statement format or recreate categorisation, exclusions, hidden-item handling, refund resolution, credit-card reconciliation, or arithmetic that belongs upstream. In particular, a later importer must never calculate a period or category total by summing transaction rows.

Amounts are decimal strings rather than JavaScript numbers, so the producer's authoritative decimal value is not changed through binary floating-point conversion. The `currency` applies to every amount in the payload.

## Canonical payload

```json
{
  "schemaVersion": "spending-import/v1",
  "source": {
    "producer": "household-spending-generator",
    "documentId": "spending-2026-08",
    "revision": "2",
    "issuedAt": "2026-09-01T07:30:00Z",
    "contentSha256": "c5f7681ed2a34543bccdc3e22833aacfca15f32e6c6c8f84ae4fd6bbe74392e2"
  },
  "period": {
    "sourcePeriodKey": "2026-08",
    "startDate": "2026-08-01",
    "endDate": "2026-08-31",
    "currency": "ZAR",
    "total": "18432.75"
  },
  "categories": [
    {
      "sourceCategoryKey": "groceries",
      "name": "Groceries",
      "total": "5634.20",
      "transactions": [
        {
          "sourceTransactionKey": "2026-08-03-001",
          "date": "2026-08-03",
          "description": "Example Market",
          "amount": "742.50"
        },
        {
          "sourceTransactionKey": "2026-08-21-014",
          "date": "2026-08-21",
          "description": "Example Foods",
          "amount": "4891.70"
        }
      ]
    },
    {
      "sourceCategoryKey": "pet-care",
      "name": "Pet care",
      "total": "850.00"
    },
    {
      "sourceCategoryKey": "housing",
      "name": "Housing",
      "total": "11633.05"
    },
    {
      "sourceCategoryKey": "new-category-from-a-future-period",
      "name": "New category from a future period",
      "total": "315.50",
      "transactions": []
    }
  ]
}
```

`categories` is an array of data, not a fixed object with category-named fields. The final example entry is intentionally a category not known by earlier imports; it is valid without a Family Hub schema or code change.

## Required and optional fields

| Path | Required | Contract |
| --- | --- | --- |
| `schemaVersion` | yes | Exact value `spending-import/v1`. A different version must be rejected or handled by an explicitly added version adapter. |
| `source.producer` | yes | Stable identifier for the system/process that produced the document. It scopes source keys and prevents unrelated producers from colliding. |
| `source.documentId` | yes | Producer-assigned identifier for this logical monthly document. It remains the same when that document is amended. |
| `source.revision` | yes | Producer-assigned revision/version for `documentId`. A changed value denotes an amended document. It is a string because upstream may use values such as `final`, `2`, or a timestamp. |
| `source.issuedAt` | yes | ISO-8601 instant at which the producer emitted this revision. |
| `source.contentSha256` | yes | Lowercase SHA-256 digest used to detect repeated identical payloads. Compute it from the RFC 8785 JSON Canonicalization Scheme serialization of the complete payload after omitting `source.contentSha256` itself. A future importer verifies it before persisting; it does not derive values or alter the payload. |
| `period.sourcePeriodKey` | yes | Producer-assigned stable key for the represented period, for example `2026-08`. It identifies the logical period within a producer. |
| `period.startDate` | yes | Period-start date exactly as emitted upstream, normally an ISO date (`YYYY-MM-DD`). Family Hub stores/displays this supplied value; it does not infer or normalize another start date. |
| `period.endDate` | yes | Period-end date exactly as emitted upstream, normally an ISO date (`YYYY-MM-DD`). Family Hub stores/displays this supplied value; it does not infer or normalize another end date. |
| `period.currency` | yes | ISO 4217 currency code used by all totals and transaction amounts in this payload. |
| `period.total` | yes | Authoritative upstream period total as a signed decimal string. It is never recalculated by Family Hub. |
| `categories` | yes | Array containing every category present in the source document for this period. It may be empty only when the source document itself has no categories. |
| `categories[].sourceCategoryKey` | yes | Stable producer-defined category identifier, unique within `source.producer`. It is data, not a Family Hub enum or generated slug. It may survive a display-name rename when the producer defines it that way. |
| `categories[].name` | yes | Category display name exactly supplied for this historical period. A later rename must not overwrite this value on prior imports. |
| `categories[].total` | yes | Authoritative upstream category total as a signed decimal string. It is never recalculated from transactions. |
| `categories[].transactions` | no | Underlying normalized transaction rows for that category when the source document supplies them. Omit it when the source does not supply rows; use `[]` when it explicitly supplies none. |
| `transactions[].sourceTransactionKey` | yes, when a transaction row is present | Producer-defined row/transaction key, unique within `(source.producer, period.sourcePeriodKey)`. It is the row identity for display, de-duplication, and a future drill-down—not a Family Hub-generated UUID. |
| `transactions[].date` | yes, when a transaction row is present | Transaction date exactly supplied upstream, normally `YYYY-MM-DD`. |
| `transactions[].description` | yes, when a transaction row is present | Source-supplied transaction description/display text. |
| `transactions[].amount` | yes, when a transaction row is present | Authoritative source amount as a signed decimal string. It is retained as a row value and is not used to recompute a category or period total. |

No additional derived totals, category groups, budget targets, merchant classifications, raw-statement fields, or reconciliation flags belong in v1. A future contract version may add optional fields only with an explicit compatibility decision.

## Identity, repeat delivery, and amendments

### Period identity

The logical period identity is the tuple:

```text
(source.producer, period.sourcePeriodKey)
```

`startDate` and `endDate` are required authoritative attributes of that identity, but they are not substituted for `sourcePeriodKey`: upstream remains responsible for deciding period boundaries and its stable key. A re-import for the same logical period replaces the stored snapshot rather than creating a second historical period.

### Source document and re-import identity

The producer document identity is:

```text
(source.producer, source.documentId)
```

The revision identity is:

```text
(source.producer, source.documentId, source.revision, source.contentSha256)
```

A future importer must record all four values. A delivery with the same revision identity is a repeated import and is idempotent. A payload for the same period identity with a changed `revision` or `contentSha256` is an amended re-import: it replaces that period's imported snapshot while retaining audit metadata for the prior import according to the later persistence design. A payload that reuses a revision identity but changes any payload bytes is invalid because its digest no longer matches.

A producer must not use one `documentId` for different `sourcePeriodKey` values. A future importer must reject that collision rather than guessing which period to replace.

## Category and transaction semantics

- Category identity is `sourceCategoryKey`, scoped by `source.producer`; category names are historical display data, not identifiers.
- The category array is complete for the period. An omitted category is not a zero-total category created by Family Hub; it simply was not present in that source period.
- The same `sourceCategoryKey` may be absent, newly introduced, renamed, retired, split, or combined in later periods. Family Hub preserves the category key and name received with each period. Later reporting-group/lifecycle work may relate categories without rewriting the source snapshot.
- Transaction identity is `sourceTransactionKey`, scoped by the producer and period. It must be unique even if two rows have the same date, description, and amount.
- Transaction rows are optional supporting detail. Their absence does not invalidate an authoritative category total, and their sum is not a validation or replacement total.

## Implementation guardrails for later Spending tasks

- Issue #62 may design a flexible schema from this contract; it must not create one column per category.
- Issue #63 may implement ingestion/re-import handling using the identities above; it must not parse raw statements or recalculate authoritative values.
- Issues #64 through #69 may expose, browse, and report on imported data without changing the imported category names, totals, period dates, or transaction values.
- Future normalized reporting/group mappings are separate Family Hub-owned relationships. They must not replace historical source category keys or names stored for a period.
