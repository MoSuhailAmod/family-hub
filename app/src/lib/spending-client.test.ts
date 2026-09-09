import assert from "node:assert/strict";
import test from "node:test";

import { loadSpendingOverview } from "./spending-client";

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
