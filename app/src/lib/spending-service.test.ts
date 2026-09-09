import assert from "node:assert/strict";
import test from "node:test";

import {
  type SpendingCategory,
  type SpendingImportMetadata,
  type SpendingPeriod,
  type SpendingRepository,
  type SpendingReportingCategory,
  type SpendingReportingGroup,
  type SpendingTransaction,
  createSpendingService,
} from "./spending-service";

const august: SpendingPeriod = {
  sourceProducer: "household-spending-generator",
  sourcePeriodKey: "2026-08",
  startDate: "2026-08-01",
  endDate: "2026-08-31",
  currency: "ZAR",
  total: "100.00",
  sourceDocumentId: "spending-2026-08",
  sourceRevision: "1",
  sourceIssuedAt: new Date("2026-09-01T07:30:00.000Z"),
  importedAt: new Date("2026-09-01T08:00:00.000Z"),
};
const september: SpendingPeriod = {
  ...august,
  sourcePeriodKey: "2026-09",
  startDate: "2026-09-01",
  endDate: "2026-09-30",
  total: "120.00",
  sourceDocumentId: "spending-2026-09",
  sourceRevision: "2",
};
const groceries: SpendingCategory = {
  sourceProducer: august.sourceProducer,
  sourcePeriodKey: august.sourcePeriodKey,
  sourceCategoryKey: "groceries",
  name: "Groceries",
  total: "100.00",
  transactionsProvided: true,
};
const transaction: SpendingTransaction = {
  sourceProducer: august.sourceProducer,
  sourcePeriodKey: august.sourcePeriodKey,
  sourceCategoryKey: groceries.sourceCategoryKey,
  sourceTransactionKey: "grocery-1",
  date: "2026-08-03",
  description: "Example Market",
  amount: "99.99",
};
const shopping: SpendingReportingCategory = {
  sourceProducer: august.sourceProducer,
  sourcePeriodKey: august.sourcePeriodKey,
  reportingGroupId: "shopping-group",
  sourceCategoryKeys: ["clothing", "retail-online"],
  name: "Shopping",
  total: "100.00",
};
const unmappedGroceries: SpendingReportingCategory = {
  sourceProducer: august.sourceProducer,
  sourcePeriodKey: august.sourcePeriodKey,
  reportingGroupId: null,
  sourceCategoryKeys: [groceries.sourceCategoryKey],
  name: groceries.name,
  total: groceries.total,
};
const metadata: SpendingImportMetadata = {
  ...august,
  contentSha256: "a".repeat(64),
};

function repository(): SpendingRepository {
  return {
    listPeriods: async () => [august, september],
    getLatestPeriod: async (sourceProducer) =>
      sourceProducer === august.sourceProducer ? september : null,
    getPeriod: async (sourceProducer, sourcePeriodKey) =>
      sourceProducer === august.sourceProducer && sourcePeriodKey === august.sourcePeriodKey
        ? august
        : null,
    listCategories: async (sourceProducer, sourcePeriodKey) =>
      sourceProducer === august.sourceProducer && sourcePeriodKey === august.sourcePeriodKey
        ? [groceries]
        : [],
    listReportingCategories: async (sourceProducer, sourcePeriodKey) =>
      sourceProducer === august.sourceProducer && sourcePeriodKey === august.sourcePeriodKey
        ? [shopping, unmappedGroceries]
        : [],
    createReportingGroup: async (name) => ({ id: "reporting-group", name }),
    renameReportingGroup: async (id, name) => ({ id, name }),
    setCategoryReportingGroup: async () => {},
    listTransactions: async (sourceProducer, sourcePeriodKey, sourceCategoryKey) =>
      sourceProducer === august.sourceProducer &&
      sourcePeriodKey === august.sourcePeriodKey &&
      sourceCategoryKey === groceries.sourceCategoryKey
        ? [transaction]
        : [],
    listCategoryHistory: async (sourceProducer, sourceCategoryKey) =>
      sourceProducer === august.sourceProducer && sourceCategoryKey === groceries.sourceCategoryKey
        ? [groceries]
        : [],
    listImportMetadata: async (sourceProducer) =>
      sourceProducer === august.sourceProducer ? [metadata] : [],
  };
}

test("returns current and historical spending periods with authoritative source totals", async () => {
  const service = createSpendingService(repository());

  assert.deepEqual(await service.listPeriods(), [september, august]);
  assert.equal(await service.getLatestPeriod(august.sourceProducer), september);
  assert.equal(
    await service.getPeriod(august.sourceProducer, august.sourcePeriodKey),
    august,
  );
});

test("returns dynamic category totals and selected category transactions without recalculation", async () => {
  const service = createSpendingService(repository());

  assert.deepEqual(
    await service.listCategories(august.sourceProducer, august.sourcePeriodKey),
    [groceries],
  );
  assert.deepEqual(
    await service.listTransactions(
      august.sourceProducer,
      august.sourcePeriodKey,
      groceries.sourceCategoryKey,
    ),
    [transaction],
  );
});

test("returns raw source categories separately from current normalised reporting groups", async () => {
  const service = createSpendingService(repository());

  assert.deepEqual(await service.listCategories(august.sourceProducer, august.sourcePeriodKey), [
    groceries,
  ]);
  assert.deepEqual(
    await service.listReportingCategories(august.sourceProducer, august.sourcePeriodKey),
    [unmappedGroceries, shopping],
  );
});

test("manages current reporting groups without changing imported source categories", async () => {
  const calls: unknown[][] = [];
  const service = createSpendingService({
    ...repository(),
    createReportingGroup: async (name): Promise<SpendingReportingGroup> => {
      calls.push(["create", name]);
      return { id: "shopping-group", name };
    },
    renameReportingGroup: async (id, name): Promise<SpendingReportingGroup | null> => {
      calls.push(["rename", id, name]);
      return id === "shopping-group" ? { id, name } : null;
    },
    setCategoryReportingGroup: async (sourceProducer, sourceCategoryKey, reportingGroupId) => {
      calls.push(["map", sourceProducer, sourceCategoryKey, reportingGroupId]);
    },
  });

  assert.deepEqual(await service.createReportingGroup("Shopping"), {
    id: "shopping-group",
    name: "Shopping",
  });
  assert.deepEqual(await service.renameReportingGroup("shopping-group", "Household Shopping"), {
    id: "shopping-group",
    name: "Household Shopping",
  });
  await service.setCategoryReportingGroup(august.sourceProducer, "clothing", "shopping-group");
  await service.setCategoryReportingGroup(august.sourceProducer, "clothing", null);

  assert.deepEqual(calls, [
    ["create", "Shopping"],
    ["rename", "shopping-group", "Household Shopping"],
    ["map", august.sourceProducer, "clothing", "shopping-group"],
    ["map", august.sourceProducer, "clothing", null],
  ]);
  assert.deepEqual(await service.listCategories(august.sourceProducer, august.sourcePeriodKey), [
    groceries,
  ]);
});

test("preserves repository category-history chronology when source period keys are not sortable dates", async () => {
  const newest = { ...groceries, sourcePeriodKey: "archived-export" };
  const oldest = { ...groceries, sourcePeriodKey: "zulu-ledger" };
  const baseRepository = repository();
  const service = createSpendingService({
    ...baseRepository,
    listCategoryHistory: async () => [newest, oldest],
  });

  assert.deepEqual(
    await service.listCategoryHistory(august.sourceProducer, groceries.sourceCategoryKey),
    [newest, oldest],
  );
});

test("returns category history and import metadata while validating lookup keys", async () => {
  const service = createSpendingService(repository());

  assert.deepEqual(
    await service.listCategoryHistory(august.sourceProducer, groceries.sourceCategoryKey),
    [groceries],
  );
  assert.deepEqual(await service.listImportMetadata(august.sourceProducer), [metadata]);
  await assert.rejects(() => service.getPeriod("", august.sourcePeriodKey), {
    message: "sourceProducer is required",
  });
});
