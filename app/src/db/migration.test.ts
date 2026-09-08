import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

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

async function applyMigrations(migrationsFolder: string) {
  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder });
  return client;
}

async function assertSpendingTablesExist(client: PGlite) {
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

test("applies Spending migration through Drizzle on a fresh PostgreSQL-compatible database", async () => {
  const client = await applyMigrations(migrationsFolder);

  try {
    await assertSpendingTablesExist(client);
  } finally {
    await client.close();
  }
});

test("upgrades an existing Drizzle database through the Spending migration", async () => {
  const legacyMigrationsFolder = await mkdtemp(join(tmpdir(), "family-hub-drizzle-"));
  const legacyMetaFolder = join(legacyMigrationsFolder, "meta");

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

    const client = await applyMigrations(legacyMigrationsFolder);
    try {
      await migrate(drizzle(client), { migrationsFolder });
      await assertSpendingTablesExist(client);
    } finally {
      await client.close();
    }
  } finally {
    await rm(legacyMigrationsFolder, { recursive: true, force: true });
  }
});
