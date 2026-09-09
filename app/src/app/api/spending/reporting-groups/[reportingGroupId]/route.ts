import { createSpendingRouteHandlers } from "@/lib/spending-route-handlers";
import { spendingService } from "@/lib/spending";

const handlers = createSpendingRouteHandlers(spendingService);

type Context = { params: Promise<{ reportingGroupId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { reportingGroupId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const name =
    typeof body === "object" && body !== null && "name" in body && typeof body.name === "string"
      ? body.name
      : "";
  return handlers.renameReportingGroup(reportingGroupId, name);
}
