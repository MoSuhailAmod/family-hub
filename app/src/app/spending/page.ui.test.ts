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
