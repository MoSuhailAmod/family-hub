import { createShoppingRolloverWorker } from "@/lib/shopping-rollover-worker";
import { createPostgresShoppingRolloverWorkerDependencies } from "@/lib/shopping-rollover-worker-data";

const cadenceMs = 15 * 60_000;
const worker = createShoppingRolloverWorker(createPostgresShoppingRolloverWorkerDependencies());

async function cycle() {
  const startedAt = new Date();
  try { console.info("shopping rollover worker cycle started", { startedAt: startedAt.toISOString() }); console.info("shopping rollover worker cycle complete", await worker.run(startedAt)); }
  catch (error) { console.error("shopping rollover worker cycle failed", error instanceof Error ? error.message : "unknown failure"); }
}

void cycle();
setInterval(cycle, cadenceMs);
