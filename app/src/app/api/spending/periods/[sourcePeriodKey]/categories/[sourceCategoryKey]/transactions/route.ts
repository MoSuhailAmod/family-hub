import { createSpendingRouteHandlers } from "@/lib/spending-route-handlers";
import { spendingService } from "@/lib/spending";

const handlers = createSpendingRouteHandlers(spendingService);

type Context = {
  params: Promise<{ sourcePeriodKey: string; sourceCategoryKey: string }>;
};

export async function GET(request: Request, { params }: Context) {
  const { sourcePeriodKey, sourceCategoryKey } = await params;
  const sourceProducer = new URL(request.url).searchParams.get("sourceProducer") ?? "";
  return handlers.listTransactions(sourceProducer, sourcePeriodKey, sourceCategoryKey);
}
