import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const pagePath = new URL("./page.tsx", import.meta.url);

test("Spending dashboard renders the approved period hero and period controls", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /spending-period-hero/);
  assert.match(page, /spending-period-label/);
  assert.match(page, /spending-status-pill/);
  assert.match(page, /Previous spending period/);
  assert.match(page, /Next spending period/);
  assert.match(page, /Select spending period/);
  assert.match(page, /Last synced/);
});

test("Spending dashboard gives every summary metric its own card and shows percentage change", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /spending-metric-card/);
  assert.match(page, /spending-metric-icon/);
  assert.match(page, /<Tags size=\{18\}/);
  assert.match(page, /<ReceiptText size=\{18\}/);
  assert.match(page, /<TrendingUp size=\{18\}/);
  assert.match(page, /Compared with prior completed period/);
  assert.match(page, /percentageChange/);
  assert.match(page, /spending-partial-banner-icon/);
});

test("Spending dashboard uses the approved V2 header subtitle", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /Track and understand your household spending\./);
  assert.doesNotMatch(page, /Review household spending at a glance\./);
});

test("Spending dashboard renders dynamic category cards with an accessible ring breakdown", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /spending-category-overview/);
  assert.match(page, /spending-category-ring/);
  assert.match(page, /aria-label="Spending by category"/);
  assert.match(page, /categoryShare/);
  assert.match(page, /spending-top-categories/);
  assert.match(page, /Top categories/);
  assert.match(page, /onClick=\{\(\) => void openCategory\(category\)\}/);
});

test("Spending dashboard renders recent transactions as compact source-aware rows", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /spending-recent-transaction-icon/);
  assert.match(page, /spending-recent-transaction-content/);
  assert.match(page, /transaction\.lineType/);
});

test("Spending dashboard uses a compact, accessible history chart in its lower card row", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /spending-dashboard-lower-row/);
  assert.match(page, /className="spending-history-chart"/);
  assert.match(page, /Spending history/);
  assert.match(page, /\{`\$\{periodMonthLabel\(entry\.period\)\}: \$\{amount\(entry\.period\.currency, entry\.period\.total\)\}`\}/);
  assert.match(page, /spending-history-bar\$\{selected \? " is-selected"/);
  assert.match(page, /<details className="spending-history-details">/);
  assert.match(page, /spending-history-period-list/);
  assert.doesNotMatch(page, /spending-trend-table/);
});

test("Spending dashboard formats API ISO dates without appending a second time component", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.doesNotMatch(page, /new Date\(`\$\{(?:period|entry\.period)\.startDate\}T12:00:00`\)/);
});
