import { createShoppingRouteHandlers } from "@/lib/shopping-route-handlers";
import { shoppingService } from "@/lib/shopping";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const handlers = createShoppingRouteHandlers(shoppingService);

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const { id } = await context.params;
  return handlers.get(id);
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  const { id } = await context.params;
  return handlers.update(id, request);
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  const { id } = await context.params;
  return handlers.delete(id);
}
