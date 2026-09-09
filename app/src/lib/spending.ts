import { db } from "@/lib/db";
import { spendingRepository } from "./spending-data";
import { createSpendingImportRepository } from "./spending-import-data";
import { createSpendingImportService } from "./spending-import";
import { createSpendingReconciliationRepository } from "./spending-reconciliation-data";
import { createSpendingReconciliationService } from "./spending-reconciliation";
import { createSpendingService } from "./spending-service";

/** Shared Spending read service for HTTP and future MCP adapters. */
export const spendingService = createSpendingService(spendingRepository);

/** Shared Spending import service for HTTP and future MCP adapters. */
export const spendingImportService = createSpendingImportService(
  createSpendingImportRepository(db),
);

/** Shared Spending reconciliation service for HTTP and MCP adapters. */
export const spendingReconciliationService = createSpendingReconciliationService(
  createSpendingReconciliationRepository(db),
);
