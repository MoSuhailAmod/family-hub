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

const markdownDocument = `# Household Spending Budget

## Summary -- spending by category, all periods

This cumulative summary is explanatory only and must not be imported as a period.

## 28 Jun 2026 - 27 Jul 2026

### <a id="p4-groceries"></a>Groceries
- 01 Jul 2026 -- Historical Market -- R50.00
**Total Groceries = R50.00**

### <a id="p4-total"></a>TOTAL SPENDING THIS PERIOD = R50.00

## 28 Jul 2026 - 27 Aug 2026

### <a id="p5-bank-charges"></a>Bank Charges
- 30 Jul 2026 -- Service Fees -- R0.96
- 15 Aug 2026 -- Account fee -- R517.85
**Total Bank Charges = R518.81**

### <a id="p5-groceries"></a>Groceries
- 01 Aug 2026 -- Example Market -- R742.50
- 21 Aug 2026 -- Example Foods -- R4,892.20
**Total Groceries = R5,700.00**

### <a id="p5-holiday"></a>Holiday
- Monthly Holiday Savings -- R1,500.00
- 22 Aug 2026 -- Cabin booking -- R2,000.00
**Total Holiday = R3,000.00**

### <a id="p5-total"></a>TOTAL SPENDING THIS PERIOD = R9,218.81

### Excluded
- 20 Aug 2026 -- Reimbursement -- R10.00

## 28 Aug 2026 - 27 Sep 2026 (PARTIAL)

### <a id="p6-groceries"></a>Groceries
- 01 Sep 2026 -- Current-month expense -- R100.00
**Total Groceries = R100.00**

### <a id="p6-total"></a>TOTAL SPENDING THIS PERIOD = R100.00
`;

test("parses a supported Spending document into a non-financial upload summary", () => {
  const summary = summarizeSpendingUpload(parseSpendingUploadDocument(document), [
    { sourceProducer: "household-spending-generator", sourcePeriodKey: "2026-07" },
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
    { sourceProducer: "household-spending-generator", sourcePeriodKey: "2026-08" },
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
      period: { sourcePeriodKey: "2026-08", startDate: "2026-08-01", endDate: "2026-08-31", currency: "ZAR", total: "100.00" },
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

test("selects the newest completed period from a cumulative household report", async () => {
  const payload = await parseSpendingMarkdownDocument(markdownDocument);

  assert.deepEqual(payload.period, {
    sourcePeriodKey: "2026-07-28-to-2026-08-27",
    startDate: "2026-07-28",
    endDate: "2026-08-27",
    currency: "ZAR",
    total: "9218.81",
  });
  assert.deepEqual(payload.categories, [
    {
      sourceCategoryKey: "bank-charges",
      name: "Bank Charges",
      total: "518.81",
      transactions: [
        { sourceTransactionKey: "bank-charges-2026-07-30-1", date: "2026-07-30", description: "Service Fees", amount: "0.96" },
        { sourceTransactionKey: "bank-charges-2026-08-15-2", date: "2026-08-15", description: "Account fee", amount: "517.85" },
      ],
    },
    {
      sourceCategoryKey: "groceries",
      name: "Groceries",
      total: "5700.00",
      transactions: [
        { sourceTransactionKey: "groceries-2026-08-01-1", date: "2026-08-01", description: "Example Market", amount: "742.50" },
        { sourceTransactionKey: "groceries-2026-08-21-2", date: "2026-08-21", description: "Example Foods", amount: "4892.20" },
      ],
    },
    {
      sourceCategoryKey: "holiday",
      name: "Holiday",
      total: "3000.00",
      transactions: [
        { sourceTransactionKey: "holiday-2026-08-22-1", date: "2026-08-22", description: "Cabin booking", amount: "2000.00" },
      ],
    },
  ]);
  assert.equal(payload.source.producer, "family-hub-household-spending-markdown");
  assert.equal(payload.source.documentId, "household-spending-2026-07-28-to-2026-08-27");
  assert.match(payload.source.revision, /^markdown-[a-f0-9]{64}$/);
  assert.match(payload.source.issuedAt, /^2026-08-28T00:00:00\.000Z$/);
  assert.equal(payload.source.contentSha256, contentSha256For(payload as SpendingImportPayload));
});

test("does not import a trailing partial period", async () => {
  const payload = await parseSpendingMarkdownDocument(markdownDocument);
  assert.equal(payload.period.sourcePeriodKey, "2026-07-28-to-2026-08-27");
  assert.notEqual(payload.period.sourcePeriodKey, "2026-08-28-to-2026-09-27");
});

test("rejects a report with no completed period or missing required totals", async () => {
  const allPartial = markdownDocument
    .replace("## 28 Jun 2026 - 27 Jul 2026", "## 28 Jun 2026 - 27 Jul 2026 (PARTIAL)")
    .replace("## 28 Jul 2026 - 27 Aug 2026", "## 28 Jul 2026 - 27 Aug 2026 (PARTIAL)");
  await assert.rejects(
    () => parseSpendingMarkdownDocument(allPartial),
    /completed .*period/i,
  );
  await assert.rejects(
    () => parseSpendingMarkdownDocument(markdownDocument.replace("TOTAL SPENDING THIS PERIOD = R9,218.81", "Total pending")),
    /final total/i,
  );
  await assert.rejects(
    () => parseSpendingMarkdownDocument(markdownDocument.replace("**Total Groceries = R5,700.00**", "")),
    /final total for category/i,
  );
});

test("rejects a malformed dated transaction while allowing non-dated category bullets", async () => {
  await assert.rejects(
    () => parseSpendingMarkdownDocument(markdownDocument.replace(
      "- 30 Jul 2026 -- Service Fees -- R0.96",
      "- 30 Jul 2026 -- Service Fees -- amount pending",
    )),
    /transaction rows/i,
  );
});

test("selects Markdown and JSON documents by filename without changing the JSON contract", async () => {
  const markdown = await parseSpendingUploadContent(markdownDocument, "Household Spending Budget.md");
  const json = await parseSpendingUploadContent(document, "spending-import.json");
  assert.equal(markdown.period.sourcePeriodKey, "2026-07-28-to-2026-08-27");
  assert.deepEqual(json, parseSpendingUploadDocument(document));
  await assert.rejects(
    () => parseSpendingUploadContent(markdownDocument, "Household Spending Budget.txt"),
    /\.md or \.json/i,
  );
});

test("uses selected-period identity so unrelated cumulative content does not create revisions", async () => {
  const exactRepeat = await parseSpendingMarkdownDocument(markdownDocument);
  const original = await parseSpendingMarkdownDocument(markdownDocument);
  const summaryChanged = await parseSpendingMarkdownDocument(markdownDocument.replace(
    "This cumulative summary is explanatory only and must not be imported as a period.",
    "This updated cumulative summary is still explanatory only.",
  ));
  const partialChanged = await parseSpendingMarkdownDocument(markdownDocument.replace(
    "Current-month expense -- R100.00",
    "Updated current-month expense -- R101.00",
  ));
  const selectedPeriodRevised = await parseSpendingMarkdownDocument(markdownDocument.replace("R9,218.81", "R9,200.00"));

  assert.equal(exactRepeat.source.contentSha256, original.source.contentSha256);
  assert.equal(exactRepeat.source.revision, original.source.revision);
  assert.equal(summaryChanged.source.revision, original.source.revision);
  assert.equal(summaryChanged.source.contentSha256, original.source.contentSha256);
  assert.equal(partialChanged.source.revision, original.source.revision);
  assert.equal(partialChanged.source.contentSha256, original.source.contentSha256);
  assert.equal(selectedPeriodRevised.source.documentId, original.source.documentId);
  assert.notEqual(selectedPeriodRevised.source.revision, original.source.revision);
  assert.notEqual(selectedPeriodRevised.source.contentSha256, original.source.contentSha256);
});
