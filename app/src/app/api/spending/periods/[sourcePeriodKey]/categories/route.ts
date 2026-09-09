import { createSpendingRouteHandlers } from "@/lib/spending-route-handlers";
import { spendingService } from "@/lib/spending";

const handlers = createSpendingRouteHandlers(spendingService);

type Context = { params: Promise<{ sourcePeriodKey: string }> };

export async function GET(request: Request, { params }: Context) {
  const { sourcePeriodKey } = await params;
  const sourceProducer = new URL(request.url).searchParams.get("sourceProducer") ?? "";
  return handlers.listCategories(sourceProducer, sourcePeriodKey);
}
