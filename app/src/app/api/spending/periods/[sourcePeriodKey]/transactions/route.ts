import { createSpendingRouteHandlers } from "@/lib/spending-route-handlers";
import { spendingService } from "@/lib/spending";

const handlers = createSpendingRouteHandlers(spendingService);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sourcePeriodKey: string }> },
) {
  const { sourcePeriodKey } = await params;
  return handlers.listRecentTransactions(
    new URL(request.url).searchParams.get("sourceProducer") ?? "",
    sourcePeriodKey,
  );
}
