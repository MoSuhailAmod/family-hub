import { db } from "@/lib/db";
import { spendingRepository } from "./spending-data";
import { createSpendingImportRepository } from "./spending-import-data";
import { createSpendingImportService } from "./spending-import";
import { createSpendingService } from "./spending-service";

/** Shared Spending read service for HTTP and future MCP adapters. */
export const spendingService = createSpendingService(spendingRepository);

/** Shared Spending import service for HTTP and future MCP adapters. */
export const spendingImportService = createSpendingImportService(
  createSpendingImportRepository(db),
);
