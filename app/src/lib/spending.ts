import { spendingRepository } from "./spending-data";
import { createSpendingService } from "./spending-service";

/** Shared Spending read service for HTTP and future MCP adapters. */
export const spendingService = createSpendingService(spendingRepository);
