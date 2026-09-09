import assert from "node:assert/strict";
import test from "node:test";

import {
  type SpendingService,
  createSpendingRouteHandlers,
} from "./spending-route-handlers";

const period = {
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
const category = {
  sourceProducer: period.sourceProducer,
  sourcePeriodKey: period.sourcePeriodKey,
  sourceCategoryKey: "groceries",
  name: "Groceries",
  total: "100.00",
  transactionsProvided: true,
};

function service(overrides: Partial<SpendingService> = {}): SpendingService {
  return {
    listPeriods: async () => [period],
    getLatestPeriod: async () => period,
    getPeriod: async () => period,
    listCategories: async () => [category],
    listReportingCategories: async () => [],
    createReportingGroup: async (name) => ({ id: "reporting-group", name }),
    renameReportingGroup: async (id, name) => ({ id, name }),
    setCategoryReportingGroup: async () => {},
    listTransactions: async () => [],
    listCategoryHistory: async () => [category],
    listImportMetadata: async () => [],
    ...overrides,
  };
}

test("exposes spending overview and category reads through the shared service", async () => {
  const handlers = createSpendingRouteHandlers(service());

  const [periods, latest, categories, history] = await Promise.all([
    handlers.listPeriods(),
    handlers.getLatestPeriod("household-spending-generator"),
    handlers.listCategories(period.sourceProducer, period.sourcePeriodKey),
    handlers.listCategoryHistory(period.sourceProducer, category.sourceCategoryKey),
  ]);

  assert.deepEqual((await periods.json()).periods[0].total, "100.00");
  assert.deepEqual((await latest.json()).period.sourcePeriodKey, period.sourcePeriodKey);
  assert.deepEqual((await categories.json()).categories[0].sourceCategoryKey, "groceries");
  assert.deepEqual((await history.json()).categories[0].name, "Groceries");
});

test("exposes raw and normalised Spending categories separately", async () => {
  const normalised = {
    sourceProducer: period.sourceProducer,
    sourcePeriodKey: period.sourcePeriodKey,
    reportingGroupId: "shopping-group",
    sourceCategoryKeys: ["clothing", "retail-online"],
    name: "Shopping",
    total: "100.00",
  };
  const handlers = createSpendingRouteHandlers(service({ listReportingCategories: async () => [normalised] }));

  const response = await handlers.listReportingCategories(period.sourceProducer, period.sourcePeriodKey);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { categories: [normalised] });
});

test("rejects invalid category keys and distinguishes missing categories from empty drill-downs", async () => {
  const handlers = createSpendingRouteHandlers(service());

  const invalid = await handlers.listTransactions(
    period.sourceProducer,
    period.sourcePeriodKey,
    " ",
  );
  const empty = await handlers.listTransactions(
    period.sourceProducer,
    period.sourcePeriodKey,
    category.sourceCategoryKey,
  );
  const missing = await createSpendingRouteHandlers(
    service({ listCategories: async () => [] }),
  ).listTransactions(period.sourceProducer, period.sourcePeriodKey, "missing");

  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { error: "sourceCategoryKey is required" });
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { transactions: [] });
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "Spending category not found" });
});
