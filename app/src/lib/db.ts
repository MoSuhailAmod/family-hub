import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, types } from "pg";
import * as schema from "@/db/schema";

// node-postgres parses `date` columns as local-timezone Date objects by default, which
// Drizzle's string-mode date column then re-serializes through `.toISOString()` (UTC) --
// silently shifting the calendar date whenever the server's local offset isn't zero.
// Returning the raw "YYYY-MM-DD" wire value keeps it exact regardless of server timezone.
types.setTypeParser(types.builtins.DATE, (value) => value);

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema });
