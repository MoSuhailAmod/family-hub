import { createSpendingRouteHandlers } from "@/lib/spending-route-handlers";
import { spendingService } from "@/lib/spending";

const handlers = createSpendingRouteHandlers(spendingService);

export async function GET(request: Request) {
  return handlers.listImportMetadata(
    new URL(request.url).searchParams.get("sourceProducer") ?? undefined,
  );
}
