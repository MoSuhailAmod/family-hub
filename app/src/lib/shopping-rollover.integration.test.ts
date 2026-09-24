import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import EmbeddedPostgres from "embedded-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Client } from "pg";

const migrationsFolder = join(process.cwd(), "drizzle");
let databaseDir: string;
let postgres: EmbeddedPostgres;
let client: Client;
let closeApplicationPool: (() => Promise<void>) | undefined;

before(async () => {
  databaseDir = await mkdtemp(join(tmpdir(), "family-hub-shopping-rollover-"));
  postgres = new EmbeddedPostgres({
    databaseDir,
    port: 55437,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("shopping_rollover");
  client = postgres.getPgClient("shopping_rollover");
  await client.connect();
  await migrate(drizzle(client), { migrationsFolder });
  process.env.DATABASE_URL = "postgresql://postgres:password@localhost:55437/shopping_rollover";
});

after(async () => {
  await closeApplicationPool?.();
  await client.end();
  await postgres.stop();
  await rm(databaseDir, { recursive: true, force: true });
});

test("rollover deletes only completed items and runs at most once per week against a real database", async () => {
  const { shoppingRepository } = await import("./shopping-data");
  const { createPostgresShoppingRolloverWorkerDependencies } = await import("./shopping-rollover-worker-data");
  const { createShoppingRolloverWorker } = await import("./shopping-rollover-worker");
  const { pool } = await import("./db");
  closeApplicationPool = () => pool.end();

  const active = await shoppingRepository.create({ name: "Milk", quantity: null, notes: null });
  const completed = await shoppingRepository.create({ name: "Bread", quantity: null, notes: null });
  await shoppingRepository.setCompletion(completed.id, new Date());

  const worker = createShoppingRolloverWorker(createPostgresShoppingRolloverWorkerDependencies());
  const monday = new Date("2026-09-07T05:00:00.000Z"); // Monday 07:00 Africa/Johannesburg

  const first = await worker.run(monday);
  assert.deepEqual(first, { ran: true, deleted: 1 });

  const remaining = await shoppingRepository.list();
  assert.deepEqual(remaining.map((item) => item.id), [active.id]);

  const secondActive = await shoppingRepository.create({ name: "Eggs", quantity: null, notes: null });
  await shoppingRepository.setCompletion(secondActive.id, new Date());

  const second = await worker.run(new Date("2026-09-07T12:00:00.000Z")); // same Africa/Johannesburg Monday
  assert.deepEqual(second, { ran: false, deleted: 0 });

  const afterSecondRun = await shoppingRepository.list();
  assert.deepEqual(afterSecondRun.map((item) => item.id).sort(), [active.id, secondActive.id].sort());
});
