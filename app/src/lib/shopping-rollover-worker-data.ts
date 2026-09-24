import { pool } from "@/lib/db";

import { shoppingRepository } from "./shopping-data";
import { runShoppingRolloverService } from "./shopping-service";
import type { ShoppingRolloverWorkerDependencies } from "./shopping-rollover-worker";

export function createPostgresShoppingRolloverWorkerDependencies(): ShoppingRolloverWorkerDependencies {
  return {
    async claimWeek(weekKey) {
      const result = await pool.query(
        `INSERT INTO shopping_rollover_runs (week_key)
         VALUES ($1)
         ON CONFLICT (week_key) DO NOTHING
         RETURNING id`,
        [weekKey],
      );
      return result.rows.length > 0;
    },

    async runRollover() {
      return runShoppingRolloverService(shoppingRepository);
    },
  };
}
