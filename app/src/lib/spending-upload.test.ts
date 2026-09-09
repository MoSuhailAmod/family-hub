import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_SPENDING_UPLOAD_BYTES,
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
