import { createSpendingRouteHandlers } from "@/lib/spending-route-handlers";
import { spendingService } from "@/lib/spending";

const handlers = createSpendingRouteHandlers(spendingService);

type Context = { params: Promise<{ sourceCategoryKey: string }> };

export async function GET(request: Request, { params }: Context) {
  const { sourceCategoryKey } = await params;
  const sourceProducer = new URL(request.url).searchParams.get("sourceProducer") ?? "";
  return handlers.listCategoryHistory(sourceProducer, sourceCategoryKey);
}
