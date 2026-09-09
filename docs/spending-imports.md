# Spending imports

## Input formats

The normal household-facing input is a completed monthly Markdown document (`.md`; `.markdown` is also accepted). The file picker also keeps `.json` support for the machine-readable `spending-import/v1` contract.

Markdown is a deterministic adapter to that same canonical contract. It does not create another database or persistence route: after preview, the existing Spending import endpoint and service validate, de-duplicate, and replace imported snapshots exactly as they do for JSON.

Family Hub treats the monthly report as the final source of truth. It does not recalculate totals from transaction rows, categorise merchants, apply exclusions, match refunds, or reinterpret financial data.

## Supported Markdown structure

The Markdown document must use this explicit structure. Values shown below are sanitized examples only.

```md
# Household Spending Budget

## Reporting period
- Period: 2026-08
- Start date: 2026-08-01
- End date: 2026-08-31
- Currency: ZAR
- Total spend: 18432.75

## Categories

### Groceries
- Total: 5634.20

| Date | Description | Amount |
| --- | --- | ---: |
| 2026-08-03 | Example Market | 742.50 |

### Housing
- Total: 12798.55
```

Requirements:

- The document has exactly one `# Household Spending Budget` heading.
- `Period` is a unique valid calendar month in `YYYY-MM` format and is the source period key.
- `Start date` and `End date` are unique ISO dates (`YYYY-MM-DD`).
- `Currency` is one ISO 4217 code, such as `ZAR`.
- `Total spend` is the authoritative final period amount.
- `## Categories` contains one or more `###` category headings, each with exactly one final `Total`.
- Optional transaction detail for a category uses a `Date | Description | Amount` Markdown table. Transaction rows are retained as supplied; they are never summed to validate or replace the category total.
- Amounts may use thousands commas and an optional `ZAR` or `R` prefix. Decimal commas, missing values, duplicate values, malformed tables, and other ambiguous values are rejected instead of coerced.

## Generated identity rules

The adapter generates the source fields necessary for the existing import model; users never need to enter IDs or hashes manually.

- `source.producer` is always `family-hub-household-spending-markdown`.
- `period.sourcePeriodKey` is the report's `Period` value.
- `source.documentId` is `household-spending-<Period>`, keeping amendments for one logical month together.
- `source.revision` is `markdown-<sha256 of exact Markdown content>`. The same file is an identical revision; changed Markdown becomes a new revision for the same period.
- `source.issuedAt` is deterministically midnight UTC on the day after the supplied period end date.
- `source.contentSha256` is SHA-256 of the canonical `spending-import/v1` payload with `source.contentSha256` omitted, matching the import contract.
- `category.sourceCategoryKey` is the stable lowercase, punctuation-normalized category heading (for example, `Pet care` becomes `pet-care`).
- `transaction.sourceTransactionKey` is `<category key>-<date>-<row number>` within the source document.

Consequences:

- Re-uploading the exact same Markdown file produces the same revision identity and is handled as a duplicate.
- Changing a document for the same `Period` produces a changed revision/content hash and goes through the existing explicit replacement confirmation before import.
- The same logical category heading produces the same category key across months.

## Preview and validation

Before persistence, the Spending page previews the detected period, authoritative total, category count, transaction count, and whether an existing period will be replaced. A replacement cannot be submitted until the user confirms it.

The 5 MB upload limit applies before JSON or Markdown parsing. If the document cannot be unambiguously mapped to the structure above, Family Hub displays a validation error and does not import it.
