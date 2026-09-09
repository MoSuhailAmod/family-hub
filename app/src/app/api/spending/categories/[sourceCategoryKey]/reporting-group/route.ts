import { createSpendingRouteHandlers } from "@/lib/spending-route-handlers";
import { spendingService } from "@/lib/spending";

const handlers = createSpendingRouteHandlers(spendingService);

type Context = { params: Promise<{ sourceCategoryKey: string }> };

export async function PUT(request: Request, { params }: Context) {
  const { sourceCategoryKey } = await params;
  const sourceProducer = new URL(request.url).searchParams.get("sourceProducer") ?? "";
  const body: unknown = await request.json().catch(() => null);
  const reportingGroupId =
    typeof body === "object" && body !== null && "reportingGroupId" in body
      ? body.reportingGroupId
      : undefined;

  if (reportingGroupId !== null && typeof reportingGroupId !== "string") {
    return Response.json({ error: "reportingGroupId must be a string or null" }, { status: 400 });
  }

  return handlers.setCategoryReportingGroup(sourceProducer, sourceCategoryKey, reportingGroupId);
}
