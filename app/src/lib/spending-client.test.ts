import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePeriodComparison,
  calculateSpendingShare,
  compareDecimalStrings,
  filterSpendingTransactions,
  loadSpendingDashboard,
  loadSpendingHistory,
  loadSpendingOverview,
  previousComparablePeriod,
} from "./spending-client";

const latestPeriod = {
  sourceProducer: "bank-import",
  sourcePeriodKey: "2026/03",
  startDate: "2026-03-01",
  endDate: "2026-03-31",
  currency: "ZAR",
  total: "1234.56",
};

const categories = [
  { sourceCategoryKey: "groceries", name: "Groceries", total: "500.00" },
  { sourceCategoryKey: "travel", name: "Travel", total: "734.56" },
];

test("loads the latest spending period and every category returned by the API", async () => {
  const requestedUrls: string[] = [];
  const fetcher: typeof fetch = async (url) => {
    requestedUrls.push(String(url));
    if (String(url) === "/api/spending/periods") {
      return Response.json({ periods: [latestPeriod] });
    }
    if (String(url) === "/api/spending/periods/latest") {
      return Response.json({ period: latestPeriod });
    }
    if (String(url) === "/api/spending/periods/2026%2F03/categories?sourceProducer=bank-import") {
      return Response.json({ categories });
    }
    return new Response(null, { status: 404 });
  };

  const overview = await loadSpendingOverview(fetcher);

  assert.deepEqual(overview, { period: latestPeriod, periods: [latestPeriod], categories });
  assert.deepEqual(requestedUrls, [
    "/api/spending/periods",
    "/api/spending/periods/latest",
    "/api/spending/periods/2026%2F03/categories?sourceProducer=bank-import",
  ]);
});

test("loads a completed dashboard period, partial-period prompt, and recent transaction preview from stored API data", async () => {
  const completedPeriod = { ...latestPeriod, status: "completed", importedAt: "2026-04-01T08:00:00.000Z" };
  const partialPeriod = {
    ...latestPeriod,
    sourcePeriodKey: "2026/04",
    startDate: "2026-04-01",
    endDate: "2026-04-30",
    total: "800.00",
    status: "partial",
    importedAt: "2026-04-15T08:00:00.000Z",
  };
  const recentTransactions = [{
    sourceTransactionKey: "recent-1",
    date: "2026-03-30",
    description: "Example Market",
    amount: "-99.99",
  }];
  const requestedUrls: string[] = [];
  const fetcher: typeof fetch = async (url) => {
    const value = String(url);
    requestedUrls.push(value);
    if (value === "/api/spending/periods") return Response.json({ periods: [partialPeriod, completedPeriod] });
    if (value === "/api/spending/periods/latest") return Response.json({ period: completedPeriod });
    if (value === "/api/spending/periods/2026%2F03/categories?sourceProducer=bank-import") {
      return Response.json({ categories });
    }
    if (value === "/api/spending/periods/2026%2F03/transactions?sourceProducer=bank-import") {
      return Response.json({ transactionCount: 7, transactions: recentTransactions });
    }
    return new Response(null, { status: 404 });
  };

  const dashboard = await loadSpendingDashboard(fetcher);

  assert.deepEqual(dashboard, {
    period: completedPeriod,
    periods: [partialPeriod, completedPeriod],
    categories,
    transactionCount: 7,
    recentTransactions,
    partialPeriod,
  });
  assert.deepEqual(requestedUrls, [
    "/api/spending/periods",
    "/api/spending/periods/latest",
    "/api/spending/periods/2026%2F03/categories?sourceProducer=bank-import",
    "/api/spending/periods/2026%2F03/transactions?sourceProducer=bank-import",
  ]);
});

test("loads a user-selected historical period with its source producer and exact keys", async () => {
  const selectedPeriod = {
    ...latestPeriod,
    sourceProducer: "bank import",
    sourcePeriodKey: "2026/02",
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    total: "999.99",
  };
  const requestedUrls: string[] = [];
  const fetcher: typeof fetch = async (url) => {
    requestedUrls.push(String(url));
    if (String(url) === "/api/spending/periods") {
      return Response.json({ periods: [latestPeriod, selectedPeriod] });
    }
    if (String(url) === "/api/spending/periods/2026%2F02?sourceProducer=bank+import") {
      return Response.json({ period: selectedPeriod });
    }
    if (String(url) === "/api/spending/periods/2026%2F02/categories?sourceProducer=bank+import") {
      return Response.json({ categories: [] });
    }
    return new Response(null, { status: 404 });
  };

  const overview = await loadSpendingOverview(fetcher, selectedPeriod);

  assert.ok(overview.period);
  assert.equal(overview.period.total, "999.99");
  assert.deepEqual(requestedUrls, [
    "/api/spending/periods",
    "/api/spending/periods/2026%2F02?sourceProducer=bank+import",
    "/api/spending/periods/2026%2F02/categories?sourceProducer=bank+import",
  ]);
});

test("returns an empty overview when no imported spending periods exist", async () => {
  const fetcher: typeof fetch = async () => Response.json({ periods: [] });

  assert.deepEqual(await loadSpendingOverview(fetcher), {
    period: null,
    periods: [],
    categories: [],
  });
});

test("loads dynamically returned raw or normalized categories for every historical period", async () => {
  const historicalPeriod = {
    ...latestPeriod,
    sourcePeriodKey: "2026/02",
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    total: "900.00",
  };
  const requestedUrls: string[] = [];
  const fetcher: typeof fetch = async (url) => {
    const value = String(url);
    requestedUrls.push(value);
    if (value === "/api/spending/periods") return Response.json({ periods: [historicalPeriod, latestPeriod] });
    if (value === "/api/spending/periods/2026%2F03/categories?sourceProducer=bank-import") {
      return Response.json({ categories: [{ ...categories[0], sourceCategoryKeys: ["groceries"] }] });
    }
    if (value === "/api/spending/periods/2026%2F02/categories?sourceProducer=bank-import") {
      return Response.json({ categories: [{ sourceCategoryKey: "clothing", name: "Clothing", total: "200.00" }] });
    }
    if (value === "/api/spending/periods/2026%2F03/categories?sourceProducer=bank-import&view=normalized") {
      return Response.json({ categories: [{ reportingGroupId: "shopping", sourceCategoryKeys: ["groceries"], name: "Shopping", total: "500.00" }] });
    }
    if (value === "/api/spending/periods/2026%2F02/categories?sourceProducer=bank-import&view=normalized") {
      return Response.json({ categories: [{ reportingGroupId: "shopping", sourceCategoryKeys: ["clothing"], name: "Shopping", total: "200.00" }] });
    }
    return new Response(null, { status: 404 });
  };

  const rawHistory = await loadSpendingHistory(fetcher, "raw");
  const normalizedHistory = await loadSpendingHistory(fetcher, "normalized");

  assert.deepEqual(rawHistory.map((entry) => entry.categories.map((category) => category.name)), [
    ["Groceries"],
    ["Clothing"],
  ]);
  assert.deepEqual(normalizedHistory.map((entry) => entry.categories.map((category) => category.name)), [
    ["Shopping"],
    ["Shopping"],
  ]);
  assert.deepEqual(requestedUrls, [
    "/api/spending/periods",
    "/api/spending/periods/2026%2F02/categories?sourceProducer=bank-import",
    "/api/spending/periods/2026%2F03/categories?sourceProducer=bank-import",
    "/api/spending/periods",
    "/api/spending/periods/2026%2F02/categories?sourceProducer=bank-import&view=normalized",
    "/api/spending/periods/2026%2F03/categories?sourceProducer=bank-import&view=normalized",
  ]);
});

test("compares only completed same-currency source periods", () => {
  const previous = { ...latestPeriod, sourcePeriodKey: "2026/02", total: "900.00" };
  const current = { ...latestPeriod, total: "1234.56" };

  assert.deepEqual(calculatePeriodComparison(current, previous), {
    absoluteChange: "334.56",
    percentageChange: "37.2",
  });
  assert.equal(calculatePeriodComparison(current, { ...previous, currency: "USD" }), null);
  assert.equal(calculatePeriodComparison({ ...current, status: "partial" }, { ...previous, status: "completed" }), null);
  assert.equal(calculatePeriodComparison({ ...current, status: "completed" }, { ...previous, status: "partial" }), null);
  assert.equal(calculatePeriodComparison(current, null), null);
});

test("does not select a completed comparison period for a selected partial period", () => {
  const completed = { ...latestPeriod, sourcePeriodKey: "2026/02", status: "completed" as const };
  const partial = { ...latestPeriod, sourcePeriodKey: "2026/03", status: "partial" as const };

  assert.equal(previousComparablePeriod([partial, completed].map((period) => ({ period, categories: [] })), partial), null);
});

test("loads every source transaction for a selected category without changing imported values", async () => {
  const selectedPeriod = {
    ...latestPeriod,
    sourceProducer: "bank import",
    sourcePeriodKey: "2026/02",
  };
  const selectedCategory = {
    sourceCategoryKey: "fuel & travel",
    name: "Fuel & travel",
    total: "734.56",
  };
  const transactions = [
    {
      sourceTransactionKey: "garage-1",
      date: "2026-02-03",
      description: "Coastal Garage",
      amount: "-250.00",
    },
    {
      sourceTransactionKey: "toll-1",
      date: "2026-02-14",
      description: "Metro Toll",
      amount: "34.56",
    },
  ];
  const requestedUrls: string[] = [];
  const fetcher: typeof fetch = async (url) => {
    requestedUrls.push(String(url));
    if (
      String(url) ===
      "/api/spending/periods/2026%2F02/categories/fuel%20%26%20travel/transactions?sourceProducer=bank+import"
    ) {
      return Response.json({ transactions });
    }
    return new Response(null, { status: 404 });
  };

  const { loadSpendingCategoryTransactions } = await import("./spending-client");
  const result = await loadSpendingCategoryTransactions(fetcher, selectedPeriod, selectedCategory);

  assert.deepEqual(result, transactions);
  assert.deepEqual(requestedUrls, [
    "/api/spending/periods/2026%2F02/categories/fuel%20%26%20travel/transactions?sourceProducer=bank+import",
  ]);
});

test("filters persisted source lines by description and preserves their source line type", () => {
  const transactions = [
    {
      sourceTransactionKey: "grocery-1",
      date: "2026-02-03",
      description: "Example Market",
      amount: "-250.00",
      lineType: "transaction" as const,
    },
    {
      sourceTransactionKey: "maintenance-adjustment",
      date: null,
      description: "Monthly maintenance adjustment",
      amount: "25.00",
      lineType: "adjustment" as const,
    },
    {
      sourceTransactionKey: "budget-assumption",
      date: null,
      description: "Budget allocation assumption",
      amount: "0.00",
      lineType: "assumption" as const,
    },
  ];

  assert.deepEqual(filterSpendingTransactions(transactions, "maintenance", "all"), [transactions[1]]);
  assert.deepEqual(filterSpendingTransactions(transactions, "", "transaction"), [transactions[0]]);
  assert.deepEqual(filterSpendingTransactions(transactions, "", "assumption"), [transactions[2]]);
});

test("sorts transaction rows by their source date by default and supports amount sorting", async () => {
  const { sortSpendingTransactions } = await import("./spending-client");
  const transactions = [
    { sourceTransactionKey: "later", date: "2026-02-14", description: "Later", amount: "5.00" },
    { sourceTransactionKey: "earlier", date: "2026-02-03", description: "Earlier", amount: "20.00" },
  ];

  assert.deepEqual(
    sortSpendingTransactions(transactions, "date"),
    [transactions[1], transactions[0]],
  );
  assert.deepEqual(
    sortSpendingTransactions(transactions, "amount-desc"),
    [transactions[1], transactions[0]],
  );
});

test("keeps undated assumptions and adjustments after dated transactions when sorting by date", async () => {
  const { sortSpendingTransactions } = await import("./spending-client");
  const transactions = [
    { sourceTransactionKey: "undated", date: null, description: "Assumption", amount: "0.00", lineType: "assumption" as const },
    { sourceTransactionKey: "dated", date: "2026-02-03", description: "Market", amount: "20.00", lineType: "transaction" as const },
  ];

  assert.deepEqual(sortSpendingTransactions(transactions, "date"), [transactions[1], transactions[0]]);
  assert.deepEqual(sortSpendingTransactions(transactions, "date-desc"), [transactions[1], transactions[0]]);
});

test("sorts arbitrary-precision imported decimal amounts without rounding them", async () => {
  const { sortSpendingTransactions } = await import("./spending-client");
  const transactions = [
    {
      sourceTransactionKey: "larger",
      date: "2026-02-02",
      description: "Larger",
      amount: "9007199254740993.00",
    },
    {
      sourceTransactionKey: "smaller",
      date: "2026-02-01",
      description: "Smaller",
      amount: "9007199254740992.99",
    },
  ];

  assert.deepEqual(sortSpendingTransactions(transactions, "amount"), [transactions[1], transactions[0]]);
});

test("calculates category shares from arbitrary-precision persisted decimals", () => {
  assert.equal(calculateSpendingShare("9007199254740992.99", "9007199254740993.00"), "100");
  assert.equal(calculateSpendingShare("1.005", "3.00"), "33.5");
  assert.equal(calculateSpendingShare("-10.00", "100.00"), "-10");
  assert.ok(compareDecimalStrings(calculateSpendingShare(`1${"0".repeat(400)}`, "1") ?? "0", "100") > 0);
  assert.equal(calculateSpendingShare("10.00", "0.00"), null);
  assert.equal(calculateSpendingShare("10.00", "-100.00"), null);
});
