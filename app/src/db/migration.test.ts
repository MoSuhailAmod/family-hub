import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import EmbeddedPostgres from "embedded-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Client } from "pg";

const migrationsFolder = join(process.cwd(), "drizzle");
const spendingTableNames = [
  "spending_imports",
  "spending_periods",
  "spending_categories",
  "spending_period_categories",
  "spending_transactions",
  "spending_reporting_groups",
  "spending_category_reporting_groups",
];

let databaseDir: string;
let postgres: EmbeddedPostgres;

before(async () => {
  databaseDir = await mkdtemp(join(tmpdir(), "family-hub-postgres-"));
  postgres = new EmbeddedPostgres({
    databaseDir,
    port: 55432,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await postgres.initialise();
  await postgres.start();
});

after(async () => {
  await postgres.stop();
  await rm(databaseDir, { recursive: true, force: true });
});

async function databaseClient(name: string) {
  await postgres.createDatabase(name);
  const client = postgres.getPgClient(name);
  await client.connect();
  return client;
}

async function applyMigrations(client: Client, folder: string) {
  await migrate(drizzle(client), { migrationsFolder: folder });
}

async function assertSpendingTablesExist(client: Client) {
  const result = await client.query<{ table_name: string }>(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1)
      order by table_name`,
    [spendingTableNames],
  );

  assert.deepEqual(
    result.rows.map((row) => row.table_name),
    [...spendingTableNames].sort(),
  );
}

test("applies Spending migration through Drizzle on a fresh PostgreSQL 17 database", async () => {
  const client = await databaseClient("family_hub_fresh");

  try {
    await applyMigrations(client, migrationsFolder);
    await assertSpendingTablesExist(client);
  } finally {
    await client.end();
  }
});

test("upgrades an existing PostgreSQL 17 database through the Spending migration", async () => {
  const legacyMigrationsFolder = await mkdtemp(join(tmpdir(), "family-hub-drizzle-"));
  const legacyMetaFolder = join(legacyMigrationsFolder, "meta");
  const client = await databaseClient("family_hub_existing");

  try {
    await cp(join(migrationsFolder, "meta"), legacyMetaFolder, { recursive: true });
    for (const tag of [
      "0000_eminent_silverclaw",
      "0001_pink_skin",
      "0002_first_annihilus",
      "0003_odd_scream",
    ]) {
      await cp(
        join(migrationsFolder, `${tag}.sql`),
        join(legacyMigrationsFolder, `${tag}.sql`),
      );
    }

    const journal = JSON.parse(
      await readFile(join(legacyMetaFolder, "_journal.json"), "utf8"),
    ) as { entries: unknown[] };
    journal.entries = journal.entries.slice(0, 4);
    await writeFile(
      join(legacyMetaFolder, "_journal.json"),
      `${JSON.stringify(journal, null, 2)}\n`,
    );

    await applyMigrations(client, legacyMigrationsFolder);
    await applyMigrations(client, migrationsFolder);
    await assertSpendingTablesExist(client);
  } finally {
    await client.end();
    await rm(legacyMigrationsFolder, { recursive: true, force: true });
  }
});
