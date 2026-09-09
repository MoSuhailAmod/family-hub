import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import EmbeddedPostgres from "embedded-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Client } from "pg";

import { createSpendingReconciliationHttpHandler } from "@/app/api/spending/reconcile/route";
import * as schema from "@/db/schema";
import {
  contentSha256For,
  createSpendingReconciliationService,
  type SpendingReconciliationPayload,
} from "./spending-reconciliation";
import { createSpendingReconciliationRepository } from "./spending-reconciliation-data";

const migrationsFolder = join(process.cwd(), "drizzle");
const fixtureDirectory = join(process.cwd(), "..", "docs", "fixtures", "spending-cumulative-workflow");
let databaseDir: string;
let postgres: EmbeddedPostgres;
let client: Client;

before(async () => {
  databaseDir = await mkdtemp(join(tmpdir(), "family-hub-cumulative-workflow-"));
  postgres = new EmbeddedPostgres({ databaseDir, port: 55436, persistent: false, onLog: () => {}, onError: () => {} });
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("cumulative_workflow");
  client = postgres.getPgClient("cumulative_workflow");
  await client.connect();
  await migrate(drizzle(client), { migrationsFolder });
});

after(async () => {
  await client.end();
  await postgres.stop();
  await rm(databaseDir, { recursive: true, force: true });
});

async function fixture(name: string): Promise<SpendingReconciliationPayload> {
  const value = JSON.parse(await readFile(join(fixtureDirectory, name), "utf8")) as SpendingReconciliationPayload;
  assert.equal(value.source.contentSha256, contentSha256For(value), `${name} must include its canonical content hash`);
  return value;
}

function reconciliationService() {
  return createSpendingReconciliationService(
    createSpendingReconciliationRepository(drizzle(client, { schema })),
  );
}

async function reconcile(snapshot: SpendingReconciliationPayload) {
  const response = await createSpendingReconciliationHttpHandler(reconciliationService())(
    new Request("http://family-hub.test/api/spending/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    }),
  );
  assert.equal(response.status, 200);
  return response.json();
}

test("finalizes a cutoff-dated Markdown partial under its stable reporting-period key", async () => {
  const sourceMarkdown = await readFile(join(fixtureDirectory, "partial-cutoff-source.md"), "utf8");
  assert.match(sourceMarkdown, /28 Aug 2026 - 3 Sep 2026 \(partial period\)/);
  assert.match(sourceMarkdown, /Reporting period: 28 Aug 2026 - 27 Sep 2026/);

  const partial = await fixture("partial-cutoff.json");
  const completed = await fixture("partial-finalized.json");
  assert.equal(partial.periods[0].sourcePeriodKey, "2026-08-28-to-2026-09-27");
  assert.equal(completed.periods[0].sourcePeriodKey, partial.periods[0].sourcePeriodKey);

  assert.deepEqual(await reconcile(partial), {
    success: true,
    summary: {
      processed: 1,
      unchanged: [],
      updated: [],
      inserted: [],
      partialRefreshed: ["2026-08-28-to-2026-09-27"],
      completedFromPartial: [],
    },
  });
  assert.deepEqual(await reconcile(completed), {
    success: true,
    summary: {
      processed: 1,
      unchanged: [],
      updated: [],
      inserted: [],
      partialRefreshed: [],
      completedFromPartial: ["2026-08-28-to-2026-09-27"],
    },
  });
});

test("reconciles sanitized cumulative ChatGPT snapshots through the HTTP adapter without duplicate history", async () => {
  const initial = await fixture("initial.json");
  assert.deepEqual(await reconcile(initial), {
    success: true,
    summary: {
      processed: 3,
      unchanged: [],
      updated: [],
      inserted: ["2026-05-28-to-2026-06-27", "2026-06-28-to-2026-07-27"],
      partialRefreshed: ["2026-07-28-to-2026-08-27"],
      completedFromPartial: [],
    },
  });

  assert.deepEqual(await reconcile(initial), {
    success: true,
    summary: {
      processed: 3,
      unchanged: [
        "2026-05-28-to-2026-06-27",
        "2026-06-28-to-2026-07-27",
        "2026-07-28-to-2026-08-27",
      ],
      updated: [],
      inserted: [],
      partialRefreshed: [],
      completedFromPartial: [],
    },
  });

  assert.deepEqual(await reconcile(await fixture("historical-correction-and-new-period.json")), {
    success: true,
    summary: {
      processed: 5,
      unchanged: ["2026-05-28-to-2026-06-27", "2026-07-28-to-2026-08-27"],
      updated: ["2026-06-28-to-2026-07-27"],
      inserted: ["2026-08-28-to-2026-09-27"],
      partialRefreshed: ["2026-09-28-to-2026-10-27"],
      completedFromPartial: [],
    },
  });

  assert.deepEqual(await reconcile(await fixture("partial-refresh.json")), {
    success: true,
    summary: {
      processed: 5,
      unchanged: [
        "2026-05-28-to-2026-06-27",
        "2026-06-28-to-2026-07-27",
        "2026-07-28-to-2026-08-27",
        "2026-08-28-to-2026-09-27",
      ],
      updated: [],
      inserted: [],
      partialRefreshed: ["2026-09-28-to-2026-10-27"],
      completedFromPartial: [],
    },
  });

  const periods = await client.query<{ source_period_key: string; status: string; total: string }>(
    `select source_period_key, status, total
       from spending_periods
      where source_producer = 'chatgpt-household-spending'
      order by source_period_key`,
  );
  assert.deepEqual(periods.rows, [
    { source_period_key: "2026-05-28-to-2026-06-27", status: "completed", total: "1250.00" },
    { source_period_key: "2026-06-28-to-2026-07-27", status: "completed", total: "1495.00" },
    { source_period_key: "2026-07-28-to-2026-08-27", status: "partial", total: "640.00" },
    { source_period_key: "2026-08-28-to-2026-09-27", status: "completed", total: "1630.00" },
    { source_period_key: "2026-09-28-to-2026-10-27", status: "partial", total: "710.00" },
  ]);
});
