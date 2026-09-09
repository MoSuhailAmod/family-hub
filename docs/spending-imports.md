# Spending imports

## Input formats

The normal household-facing input is a completed household Spending Markdown document (`.md`; `.markdown` is also accepted). The file picker also keeps `.json` support for the machine-readable `spending-import/v1` contract.

Markdown is a deterministic adapter to that same canonical contract. It does not create another database or persistence route: after preview, the existing Spending import endpoint and service validate, de-duplicate, and replace imported snapshots exactly as they do for JSON.

Family Hub treats the completed report as the final source of truth. It does not recalculate totals from transaction rows, categorise merchants, apply exclusions, match refunds, or reinterpret financial data.

## Supported household Markdown structure

The parser accepts the established `Household Spending Budget.md` report shape. Values below are sanitized examples only.

```md
# Household Spending Budget

## Summary -- spending by category, all periods

This cumulative summary is ignored.

## 28 Jul 2026 - 27 Aug 2026

### <a id="p5-bank-charges"></a>Bank Charges
- 30 Jul 2026 -- Service Fees -- R0.96
- 15 Aug 2026 -- Account fee -- R517.85
**Total Bank Charges = R518.81**

### <a id="p5-groceries"></a>Groceries
- 01 Aug 2026 -- Example Market -- R742.50
**Total Groceries = R742.50**

### <a id="p5-total"></a>TOTAL SPENDING THIS PERIOD = R1,261.31

### Excluded
- 20 Aug 2026 -- Reimbursement -- R10.00

## 28 Aug 2026 - 27 Sep 2026 (PARTIAL)

This in-progress period is ignored.
```

Requirements:

- The document has exactly one `# Household Spending Budget` heading.
- A period heading uses `## <start date> - <end date>`, with report dates such as `28 Jul 2026`.
- The document may contain completed historical periods plus a trailing `PARTIAL` in-progress period. Family Hub selects the newest completed period in document order and never imports a `PARTIAL` period.
- The completed period has anchored (or plain) `###` category headings, an explicit `**Total <category> = R...**` for every category, and one `TOTAL SPENDING THIS PERIOD = R...` heading.
- Dated transaction detail uses `- <date> -- <description> -- R<amount>` bullet rows. Dated rows are retained as supplied and are never summed to validate or replace the category total. Other non-dated category bullets are not invented as transactions and do not prevent importing the explicit authoritative category total.
- `### Excluded` and its contents, plus the cumulative summary section, are ignored. They are never treated as spending.
- Amounts may use thousands commas and an `R` or `ZAR` prefix. Missing/duplicate totals, malformed transaction rows, unsupported dates, and other ambiguous values are rejected rather than coerced.

## Generated identity rules

The adapter generates the source fields necessary for the existing import model; users never need to enter IDs or hashes manually.

- `source.producer` is always `family-hub-household-spending-markdown`.
- `period.sourcePeriodKey` is `<start ISO date>-to-<end ISO date>` from the selected completed report heading, for example `2026-07-28-to-2026-08-27`.
- `source.documentId` is `household-spending-<sourcePeriodKey>`, keeping amendments for one logical report period together.
- `source.revision` is `markdown-<sha256 of the canonical selected-period payload>`. Changes to unrelated cumulative summary, historical, or `PARTIAL` content leave the selected period identity unchanged; changes to the selected period become a new revision.
- `source.issuedAt` is deterministically midnight UTC on the day after the selected period end date.
- `source.contentSha256` is SHA-256 of the canonical `spending-import/v1` payload with `source.contentSha256` omitted, matching the import contract.
- `category.sourceCategoryKey` is the stable lowercase, punctuation-normalized category heading (for example, `Pet care` becomes `pet-care`).
- `transaction.sourceTransactionKey` is `<category key>-<date>-<row number>` within the selected source period.

Consequences:

- Re-uploading the exact same Markdown file produces the same revision identity and is handled as a duplicate.
- Changing a document for the same selected period produces a changed revision/content hash and goes through the existing explicit replacement confirmation before import.
- The same logical category heading produces the same category key across periods.

## Preview and validation

Before persistence, the Spending page previews the detected period, authoritative total, category count, transaction count, and whether an existing period will be replaced. A replacement cannot be submitted until the user confirms it.

The 5 MB upload limit applies before JSON or Markdown parsing. If the document cannot be unambiguously mapped to the structure above, Family Hub displays a validation error and does not import it.
