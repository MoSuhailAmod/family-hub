import { createShoppingRouteHandlers } from "@/lib/shopping-route-handlers";
import { shoppingService } from "@/lib/shopping";

const handlers = createShoppingRouteHandlers(shoppingService);

export const GET = handlers.list;
export const POST = handlers.create;
