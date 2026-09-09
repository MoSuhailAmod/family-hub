import assert from "node:assert/strict";
import test from "node:test";

import {
  contentSha256For,
  createSpendingReconciliationService,
  type SpendingReconciliationPayload,
  type SpendingReconciliationRepository,
} from "./spending-reconciliation";

function snapshot(
  overrides: Partial<SpendingReconciliationPayload> = {},
): SpendingReconciliationPayload {
  const value = {
    schemaVersion: "spending-reconciliation/v1",
    source: {
      producer: "household-spending-generator",
      documentId: "household-spending-budget",
      revision: "2026-09-01",
      issuedAt: "2026-09-01T07:30:00Z",
      importedBy: "chatgpt",
      contentSha256: "",
    },
    periods: [
      {
        sourcePeriodKey: "2026-08-01-to-2026-08-31",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        currency: "ZAR",
        total: "100.00",
        status: "completed",
        categories: [
          {
            sourceCategoryKey: "groceries",
            name: "Groceries",
            total: "100.00",
            lines: [
              {
                sourceTransactionKey: "grocery-1",
                lineType: "transaction",
                date: "2026-08-03",
                description: "Example Market",
                amount: "100.00",
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  } as SpendingReconciliationPayload;
  value.source.contentSha256 = contentSha256For(value);
  return value;
}

test("reconciles a cumulative snapshot and returns concise per-period outcomes", async () => {
  const imported = snapshot();
  let received: SpendingReconciliationPayload | undefined;
  const repository: SpendingReconciliationRepository = {
    async reconcile(next) {
      received = next;
      return {
        processed: 3,
        unchanged: ["2026-06-01-to-2026-06-30"],
        updated: ["2026-07-01-to-2026-07-31"],
        inserted: ["2026-08-01-to-2026-08-31"],
        partialRefreshed: [],
        completedFromPartial: [],
      };
    },
  };

  const result = await createSpendingReconciliationService(repository).reconcile(imported);

  assert.deepEqual(result, {
    success: true,
    summary: {
      processed: 3,
      unchanged: ["2026-06-01-to-2026-06-30"],
      updated: ["2026-07-01-to-2026-07-31"],
      inserted: ["2026-08-01-to-2026-08-31"],
      partialRefreshed: [],
      completedFromPartial: [],
    },
  });
  assert.deepEqual(received, imported);
});

test("rejects duplicate logical periods before reconciliation", async () => {
  const imported = snapshot({
    periods: [
      snapshot().periods[0],
      { ...snapshot().periods[0], categories: [] },
    ],
  });
  const repository: SpendingReconciliationRepository = {
    async reconcile() {
      throw new Error("must not persist invalid input");
    },
  };

  const result = await createSpendingReconciliationService(repository).reconcile(imported);

  assert.deepEqual(result, {
    success: false,
    code: "VALIDATION",
    error: "periods.1.sourcePeriodKey: Must be unique within the snapshot",
  });
});

test("rejects a source hash that does not match the structured snapshot", async () => {
  const repository: SpendingReconciliationRepository = {
    async reconcile() {
      throw new Error("must not persist invalid input");
    },
  };
  const imported = snapshot();
  imported.source.contentSha256 = "0".repeat(64);

  const result = await createSpendingReconciliationService(repository).reconcile(imported);

  assert.deepEqual(result, {
    success: false,
    code: "VALIDATION",
    error: "source.contentSha256: Does not match the canonical payload",
  });
});
