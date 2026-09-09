import assert from "node:assert/strict";
import test from "node:test";

import {
  contentSha256For,
  type SpendingImportPayload,
} from "./spending-import";
import {
  MAX_SPENDING_UPLOAD_BYTES,
  parseSpendingMarkdownDocument,
  parseSpendingUploadContent,
  parseSpendingUploadDocument,
  submitSpendingUpload,
  summarizeSpendingUpload,
} from "./spending-upload";

const document = JSON.stringify({
  schemaVersion: "spending-import/v1",
  source: {
    producer: "household-spending-generator",
    documentId: "spending-2026-08",
    revision: "1",
    issuedAt: "2026-09-01T07:30:00Z",
    contentSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  },
  period: {
    sourcePeriodKey: "2026-08",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    currency: "ZAR",
    total: "18432.75",
  },
  categories: [
    {
      sourceCategoryKey: "groceries",
      name: "Groceries",
      total: "5634.20",
      transactions: [{
        sourceTransactionKey: "1",
        date: "2026-08-03",
        description: "Example Market",
        amount: "5634.20",
      }],
    },
    { sourceCategoryKey: "housing", name: "Housing", total: "12798.55" },
  ],
});

test("parses a supported Spending document into a non-financial upload summary", () => {
  const summary = summarizeSpendingUpload(parseSpendingUploadDocument(document), [
    {
      sourceProducer: "household-spending-generator",
      sourcePeriodKey: "2026-07",
    },
  ]);

  assert.deepEqual(summary, {
    sourceProducer: "household-spending-generator",
    sourcePeriodKey: "2026-08",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    currency: "ZAR",
    total: "18432.75",
    categoryCount: 2,
    transactionCount: 1,
    replacesExistingPeriod: false,
  });
});

test("identifies an uploaded Spending document that will replace an existing period", () => {
  const summary = summarizeSpendingUpload(parseSpendingUploadDocument(document), [
    {
      sourceProducer: "household-spending-generator",
      sourcePeriodKey: "2026-08",
    },
  ]);

  assert.equal(summary.replacesExistingPeriod, true);
});

test("rejects malformed and unsupported upload documents before import", () => {
  assert.throws(() => parseSpendingUploadDocument("not JSON"), /valid JSON/i);
  assert.throws(
    () => parseSpendingUploadDocument(JSON.stringify({ schemaVersion: "other" })),
    /spending-import\/v1/i,
  );
  assert.throws(
    () => parseSpendingUploadDocument(JSON.stringify({
      schemaVersion: "spending-import/v1",
      source: { producer: "generator" },
      period: {
        sourcePeriodKey: "2026-08",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        currency: "ZAR",
        total: "100.00",
      },
      categories: [],
    })),
    /supported spending-import\/v1/i,
  );
});

test("rejects oversized upload documents before parsing", () => {
  assert.throws(
    () => parseSpendingUploadDocument(" ".repeat(MAX_SPENDING_UPLOAD_BYTES + 1)),
    /5 MB/i,
  );
});

test("submits the exact uploaded payload to the Spending import endpoint", async () => {
  const requested: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    requested.push({ url: String(url), init });
    return Response.json({ success: true, status: "imported" });
  };
  const payload = parseSpendingUploadDocument(document);

  assert.deepEqual(await submitSpendingUpload(fetcher, payload), { success: true, status: "imported" });
  assert.deepEqual(requested, [{
    url: "/api/spending/imports",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: document,
    },
  }]);
});

const markdownDocument = `# Household Spending Budget

## Reporting period
- Period: 2026-08
- Start date: 2026-08-01
- End date: 2026-08-31
- Currency: ZAR
- Total spend: 18,432.75

## Categories

### Groceries
- Total: 5,634.20

| Date | Description | Amount |
| --- | --- | ---: |
| 2026-08-03 | Example Market | 742.50 |
| 2026-08-21 | Example Foods | 4,892.20 |

### Housing
- Total: 12,798.55
`;

test("adapts a completed household Markdown document to the canonical Spending import payload", async () => {
  const payload = await parseSpendingMarkdownDocument(markdownDocument);

  assert.deepEqual(payload.period, {
    sourcePeriodKey: "2026-08",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    currency: "ZAR",
    total: "18432.75",
  });
  assert.deepEqual(payload.categories, [
    {
      sourceCategoryKey: "groceries",
      name: "Groceries",
      total: "5634.20",
      transactions: [
        {
          sourceTransactionKey: "groceries-2026-08-03-1",
          date: "2026-08-03",
          description: "Example Market",
          amount: "742.50",
        },
        {
          sourceTransactionKey: "groceries-2026-08-21-2",
          date: "2026-08-21",
          description: "Example Foods",
          amount: "4892.20",
        },
      ],
    },
    { sourceCategoryKey: "housing", name: "Housing", total: "12798.55" },
  ]);
  assert.equal(payload.source.producer, "family-hub-household-spending-markdown");
  assert.equal(payload.source.documentId, "household-spending-2026-08");
  assert.match(payload.source.revision, /^markdown-[a-f0-9]{64}$/);
  assert.match(payload.source.issuedAt, /^2026-09-01T00:00:00\.000Z$/);
  assert.equal(payload.source.contentSha256, contentSha256For(payload as SpendingImportPayload));
});

test("selects Markdown and JSON documents by filename without changing the JSON contract", async () => {
  const markdown = await parseSpendingUploadContent(markdownDocument, "Household Spending Budget.md");
  const json = await parseSpendingUploadContent(document, "spending-import.json");

  assert.equal(markdown.period.sourcePeriodKey, "2026-08");
  assert.deepEqual(json, parseSpendingUploadDocument(document));
  await assert.rejects(
    () => parseSpendingUploadContent(markdownDocument, "Household Spending Budget.txt"),
    /\.md or \.json/i,
  );
});

test("uses stable source and category identities while recognizing revisions for the same period", async () => {
  const exactRepeat = await parseSpendingMarkdownDocument(markdownDocument);
  const original = await parseSpendingMarkdownDocument(markdownDocument);
  const revised = await parseSpendingMarkdownDocument(markdownDocument.replace("18,432.75", "18,500.00"));
  const nextMonth = await parseSpendingMarkdownDocument(markdownDocument
    .replace("2026-08-31", "2026-09-30")
    .replaceAll("2026-08", "2026-09"));

  assert.equal(exactRepeat.source.contentSha256, original.source.contentSha256);
  assert.equal(exactRepeat.source.revision, original.source.revision);
  assert.equal(revised.source.documentId, original.source.documentId);
  assert.notEqual(revised.source.revision, original.source.revision);
  assert.notEqual(revised.source.contentSha256, original.source.contentSha256);
  assert.equal(nextMonth.categories[0].sourceCategoryKey, original.categories[0].sourceCategoryKey);
  assert.notEqual(nextMonth.source.documentId, original.source.documentId);
});

test("rejects missing, unsupported, and ambiguous household Markdown values instead of guessing", async () => {
  await assert.rejects(
    () => parseSpendingMarkdownDocument(markdownDocument.replace("- Period: 2026-08\n", "")),
    /missing reporting period/i,
  );
  await assert.rejects(
    () => parseSpendingMarkdownDocument(markdownDocument.replace("- Total spend: 18,432.75", "")),
    /missing final total spend/i,
  );
  await assert.rejects(
    () => parseSpendingMarkdownDocument(markdownDocument.replace(/## Categories[\s\S]*/, "## Categories\n")),
    /at least one ### category/i,
  );
  await assert.rejects(
    () => parseSpendingMarkdownDocument(markdownDocument.replace("- Period: 2026-08", "- Period: 2026-99")),
    /Reporting period must be a valid calendar month/i,
  );
  await assert.rejects(
    () => parseSpendingMarkdownDocument(markdownDocument.replace("- Period: 2026-08", "- Period: 2026-08\n- Period: 2026-09")),
    /ambiguous reporting period/i,
  );
  await assert.rejects(
    () => parseSpendingMarkdownDocument(markdownDocument.replace("## Categories", "## Categories\n\n## Categories")),
    /ambiguous .*categories/i,
  );
  await assert.rejects(
    () => parseSpendingMarkdownDocument(markdownDocument.replace("# Household Spending Budget", "# Household Spending Budget\n# Household Spending Budget")),
    /ambiguous .*heading/i,
  );
  await assert.rejects(
    () => parseSpendingMarkdownDocument(markdownDocument.replace("# Household Spending Budget", "# Other Report")),
    /Household Spending Budget heading/i,
  );
});
