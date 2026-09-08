import assert from "node:assert/strict";
import test from "node:test";

import {
  contentSha256For,
  createSpendingImportService,
  type SpendingImportPayload,
  type SpendingImportRepository,
} from "./spending-import";

function payload(overrides: Partial<SpendingImportPayload> = {}): SpendingImportPayload {
  const base = {
    schemaVersion: "spending-import/v1",
    source: {
      producer: "household-spending-generator",
      documentId: "spending-2026-08",
      revision: "1",
      issuedAt: "2026-09-01T07:30:00Z",
      contentSha256: "",
    },
    period: {
      sourcePeriodKey: "2026-08",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      currency: "ZAR",
      total: "100.00",
    },
    categories: [
      {
        sourceCategoryKey: "groceries",
        name: "Groceries",
        total: "100.00",
        transactions: [
          {
            sourceTransactionKey: "grocery-1",
            date: "2026-08-03",
            description: "Example Market",
            amount: "99.99",
          },
        ],
      },
    ],
    ...overrides,
  } as SpendingImportPayload;
  base.source.contentSha256 = contentSha256For(base);

  return base;
}

type Snapshot = SpendingImportPayload;

function repository(initial: Snapshot[] = [], failure?: Error): SpendingImportRepository & { snapshots(): Snapshot[] } {
  let values = structuredClone(initial);

  return {
    async importSnapshot(next) {
      const duplicate = values.some(
        (item) =>
          item.source.producer === next.source.producer &&
          item.source.documentId === next.source.documentId &&
          item.source.revision === next.source.revision &&
          item.source.contentSha256 === next.source.contentSha256,
      );
      if (duplicate) return "duplicate" as const;
      const before = structuredClone(values);
      try {
        if (failure) throw failure;
        const existing = values.findIndex(
          (item) =>
            item.source.producer === next.source.producer &&
            item.period.sourcePeriodKey === next.period.sourcePeriodKey,
        );
        if (existing >= 0) values[existing] = structuredClone(next);
        else values.push(structuredClone(next));
        return existing >= 0 ? "replaced" as const : "imported" as const;
      } catch (error) {
        values = before;
        throw error;
      }
    },
    snapshots: () => structuredClone(values),
  };
}

test("imports a new authoritative monthly snapshot with dynamically supplied categories", async () => {
  const store = repository();
  const service = createSpendingImportService(store);
  const imported = payload({
    categories: [
      {
        sourceCategoryKey: "new-future-category",
        name: "New future category",
        total: "100.00",
        transactions: [],
      },
    ],
  });

  const result = await service.import(imported);

  assert.deepEqual(result, { success: true, status: "imported" });
  assert.deepEqual(store.snapshots(), [imported]);
});

test("treats an identical source revision as an idempotent repeated delivery", async () => {
  const imported = payload();
  const store = repository([imported]);
  const result = await createSpendingImportService(store).import(imported);

  assert.deepEqual(result, { success: true, status: "duplicate" });
  assert.deepEqual(store.snapshots(), [imported]);
});

test("replaces an amended snapshot for the same authoritative period", async () => {
  const original = payload();
  const amended = payload({
    source: { ...original.source, revision: "2", contentSha256: "" },
    period: { ...original.period, total: "125.00" },
    categories: [
      {
        sourceCategoryKey: "pet-care",
        name: "Pet care",
        total: "125.00",
      },
    ],
  });
  const store = repository([original]);

  const result = await createSpendingImportService(store).import(amended);

  assert.deepEqual(result, { success: true, status: "replaced" });
  assert.deepEqual(store.snapshots(), [amended]);
});

test("returns clear validation failures before writing an invalid import", async () => {
  const store = repository();
  const invalid = payload({ period: { ...payload().period, startDate: "2026-08-32" } });

  const result = await createSpendingImportService(store).import(invalid);

  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error, /period\.startDate/i);
  }
  assert.deepEqual(store.snapshots(), []);
});

test("does not expose a partial replacement when persistence fails", async () => {
  const original = payload();
  const store = repository([original], new Error("database write failed"));

  const result = await createSpendingImportService(store).import(payload({
    source: { ...original.source, revision: "2", contentSha256: "" },
  }));

  assert.deepEqual(result, {
    success: false,
    code: "PERSISTENCE",
    error: "Unable to import Spending snapshot",
  });
  assert.deepEqual(store.snapshots(), [original]);
});
