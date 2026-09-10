import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import EmbeddedPostgres from "embedded-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Client } from "pg";

import * as schema from "@/db/schema";
import {
  contentSha256For,
  createSpendingReconciliationService,
  type SpendingReconciliationPayload,
} from "./spending-reconciliation";
import { createSpendingReconciliationRepository } from "./spending-reconciliation-data";

const migrationsFolder = join(process.cwd(), "drizzle");
let databaseDir: string;
let postgres: EmbeddedPostgres;
let client: Client;

before(async () => {
  databaseDir = await mkdtemp(join(tmpdir(), "family-hub-spending-reconciliation-"));
  postgres = new EmbeddedPostgres({ databaseDir, port: 55435, persistent: false, onLog: () => {}, onError: () => {} });
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("spending_reconciliation");
  client = postgres.getPgClient("spending_reconciliation");
  await client.connect();
  await migrate(drizzle(client), { migrationsFolder });
});

after(async () => {
  await client.end();
  await postgres.stop();
  await rm(databaseDir, { recursive: true, force: true });
});

function snapshot(
  revision: string,
  periods: SpendingReconciliationPayload["periods"],
): SpendingReconciliationPayload {
  const value: SpendingReconciliationPayload = {
    schemaVersion: "spending-reconciliation/v1",
    source: { producer: "household-spending-generator", documentId: "household-budget", revision, issuedAt: "2026-09-01T07:30:00Z", importedBy: "chatgpt", contentSha256: "" },
    periods,
  };
  value.source.contentSha256 = contentSha256For(value);
  return value;
}

function period(
  key: string,
  status: "partial" | "completed" = "completed",
  total = "100.00",
): SpendingReconciliationPayload["periods"][number] {
  return {
    sourcePeriodKey: key,
    startDate: `${key}-01`,
    endDate: `${key}-28`,
    currency: "ZAR",
    total,
    status,
    categories: [{
      sourceCategoryKey: "groceries",
      name: "Groceries",
      total,
      lines: [{ sourceTransactionKey: `${key}-grocery`, lineType: "transaction", date: `${key}-02`, description: "Example Market", amount: total }],
    }],
  };
}

function service() {
  return createSpendingReconciliationService(
    createSpendingReconciliationRepository(drizzle(client, { schema })),
  );
}

test("reconciles all-new, unchanged, changed, partial, and completed periods without duplicating history", async () => {
  const first = snapshot("1", [period("2026-06"), period("2026-07"), period("2026-08", "partial")]);
  assert.deepEqual(await service().reconcile(first), {
    success: true,
    summary: { processed: 3, unchanged: [], updated: [], inserted: ["2026-06", "2026-07"], partialRefreshed: ["2026-08"], completedFromPartial: [] },
  });
  assert.deepEqual(await service().reconcile(first), {
    success: true,
    summary: { processed: 3, unchanged: ["2026-06", "2026-07", "2026-08"], updated: [], inserted: [], partialRefreshed: [], completedFromPartial: [] },
  });

  const changedJuly = period("2026-07", "completed", "120.00");
  changedJuly.categories.push({
    sourceCategoryKey: "pets",
    name: "Pet care",
    total: "20.00",
    lines: [{
      sourceTransactionKey: "2026-07-opening-adjustment",
      lineType: "adjustment",
      description: "Opening balance adjustment",
      amount: "20.00",
    }],
  });
  const second = snapshot("2", [period("2026-06"), changedJuly, period("2026-08", "completed"), period("2026-09", "completed"), period("2026-10", "partial")]);
  assert.deepEqual(await service().reconcile(second), {
    success: true,
    summary: { processed: 5, unchanged: ["2026-06"], updated: ["2026-07"], inserted: ["2026-09"], partialRefreshed: ["2026-10"], completedFromPartial: ["2026-08"] },
  });

  const refreshedPartial = snapshot("3", [period("2026-06"), changedJuly, period("2026-08", "completed"), period("2026-09", "completed"), period("2026-10", "partial", "110.00")]);
  assert.deepEqual(await service().reconcile(refreshedPartial), {
    success: true,
    summary: { processed: 5, unchanged: ["2026-06", "2026-07", "2026-08", "2026-09"], updated: [], inserted: [], partialRefreshed: ["2026-10"], completedFromPartial: [] },
  });

  const rows = await client.query<{ source_period_key: string; status: string; total: string; categories: string }>(
    `select period.source_period_key, period.status, period.total, count(category.id)::text as categories
       from spending_periods period left join spending_period_categories category on category.period_id = period.id
      where period.source_producer = 'household-spending-generator'
      group by period.source_period_key, period.status, period.total order by period.source_period_key`,
  );
  assert.deepEqual(rows.rows, [
    { source_period_key: "2026-06", status: "completed", total: "100.00", categories: "1" },
    { source_period_key: "2026-07", status: "completed", total: "120.00", categories: "2" },
    { source_period_key: "2026-08", status: "completed", total: "100.00", categories: "1" },
    { source_period_key: "2026-09", status: "completed", total: "100.00", categories: "1" },
    { source_period_key: "2026-10", status: "partial", total: "110.00", categories: "1" },
  ]);
});

test("rolls back a changed-period replacement when a persistence write fails", async () => {
  const original = snapshot("3", [period("2026-11", "completed", "100.00")]);
  assert.equal((await service().reconcile(original)).success, true);
  await client.query(`create function fail_spending_replacement() returns trigger language plpgsql as $$ begin raise exception 'forced failure'; end; $$`);
  await client.query(`create trigger fail_spending_replacement before insert on spending_period_categories for each row execute function fail_spending_replacement()`);

  const replacement = snapshot("4", [period("2026-11", "completed", "200.00")]);
  assert.deepEqual(await service().reconcile(replacement), {
    success: false,
    code: "PERSISTENCE",
    error: "Unable to reconcile Spending snapshot",
  });
  await client.query("drop trigger fail_spending_replacement on spending_period_categories");

  const stored = await client.query<{ total: string }>("select total from spending_periods where source_period_key = '2026-11'");
  assert.deepEqual(stored.rows, [{ total: "100.00" }]);

  const failedImport = await client.query<{ count: string }>(
    "select count(*)::text as count from spending_imports where source_revision = '4'",
  );
  const history = await client.query<{ action: string }>(
    "select action from spending_reconciliation_log where source_period_key = '2026-11' order by created_at",
  );
  assert.deepEqual(failedImport.rows, [{ count: "0" }]);
  assert.deepEqual(history.rows, [{ action: "insert" }]);
});

test("rejects completed-to-partial regressions without changing finalized history", async () => {
  const completed = snapshot("5", [period("2026-12", "completed", "100.00")]);
  assert.equal((await service().reconcile(completed)).success, true);

  const regression = snapshot("6", [period("2026-12", "partial", "120.00")]);
  assert.deepEqual(await service().reconcile(regression), {
    success: false,
    code: "DOMAIN",
    error: "Period 2026-12 cannot transition from completed to partial",
  });

  const stored = await client.query<{ status: string; total: string }>(
    "select status, total from spending_periods where source_period_key = '2026-12'",
  );
  assert.deepEqual(stored.rows, [{ status: "completed", total: "100.00" }]);
});
