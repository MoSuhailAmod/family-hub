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

test("preserves amended-import period identity and rejects document-period collisions", async () => {
  const client = await databaseClient("family_hub_import_audit");

  try {
    await applyMigrations(client, migrationsFolder);

    await client.query(
      `insert into spending_source_documents (
         source_producer, source_document_id, source_period_key
       ) values ($1, $2, $3)`,
      ["argent", "spending-2026-08", "2026-08"],
    );
    await client.query(
      `insert into spending_imports (
         id, source_producer, source_document_id, source_period_key,
         source_revision, source_content_sha256, source_issued_at
       ) values
         ('00000000-0000-0000-0000-000000000001', $1, $2, $3, '1', 'sha-1', now()),
         ('00000000-0000-0000-0000-000000000002', $1, $2, $3, '2', 'sha-2', now())`,
      ["argent", "spending-2026-08", "2026-08"],
    );
    await client.query(
      `insert into spending_periods (
         id, import_id, source_producer, source_period_key,
         start_date, end_date, currency, total
       ) values (
         '00000000-0000-0000-0000-000000000003',
         '00000000-0000-0000-0000-000000000001',
         'argent', '2026-08', '2026-08-01', '2026-08-31', 'ZAR', 100
       )`,
    );
    await client.query(
      `update spending_periods
          set import_id = '00000000-0000-0000-0000-000000000002'
        where id = '00000000-0000-0000-0000-000000000003'`,
    );

    const imports = await client.query<{ source_period_key: string }>(
      `select source_period_key
         from spending_imports
        where source_producer = 'argent'
          and source_document_id = 'spending-2026-08'
        order by source_revision`,
    );
    assert.deepEqual(imports.rows, [
      { source_period_key: "2026-08" },
      { source_period_key: "2026-08" },
    ]);
    await assert.rejects(
      client.query(
        `insert into spending_source_documents (
           source_producer, source_document_id, source_period_key
         ) values ('argent', 'spending-2026-08', '2026-09')`,
      ),
      { code: "23505" },
    );
    await client.query(
      `insert into spending_source_documents (
         source_producer, source_document_id, source_period_key
       ) values ('argent', 'spending-2026-09', '2026-09')`,
    );
    await client.query(
      `insert into spending_imports (
         id, source_producer, source_document_id, source_period_key,
         source_revision, source_content_sha256, source_issued_at
       ) values (
         '00000000-0000-0000-0000-000000000004',
         'argent', 'spending-2026-09', '2026-09', '1', 'sha-3', now()
       )`,
    );
    await assert.rejects(
      client.query(
        `insert into spending_periods (
           id, import_id, source_producer, source_period_key,
           start_date, end_date, currency, total
         ) values (
           '00000000-0000-0000-0000-000000000005',
           '00000000-0000-0000-0000-000000000001',
           'argent', '2026-09', '2026-09-01', '2026-09-30', 'ZAR', 100
         )`,
      ),
      { code: "23503" },
    );
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
