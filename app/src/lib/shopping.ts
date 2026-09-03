import { shoppingRepository } from "./shopping-data";
import { createShoppingService } from "./shopping-service";

/**
 * Default shared service for future HTTP and MCP adapters.
 * Adapters should call this rather than duplicating shopping rules.
 */
export const shoppingService = createShoppingService(shoppingRepository);
