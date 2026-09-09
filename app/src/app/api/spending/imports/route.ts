import { createSpendingImportRouteHandlers } from "@/lib/spending-import-route-handlers";
import { MAX_SPENDING_UPLOAD_BYTES } from "@/lib/spending-upload";
import { createSpendingRouteHandlers } from "@/lib/spending-route-handlers";
import { spendingImportService, spendingService } from "@/lib/spending";

const handlers = createSpendingRouteHandlers(spendingService);
const importHandlers = createSpendingImportRouteHandlers(spendingImportService);

export async function GET(request: Request) {
  return handlers.listImportMetadata(
    new URL(request.url).searchParams.get("sourceProducer") ?? undefined,
  );
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SPENDING_UPLOAD_BYTES) {
    return Response.json({ error: "The uploaded file must be 5 MB or smaller" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "The uploaded file must be valid JSON" }, { status: 400 });
  }
  return importHandlers.importSnapshot(payload);
}
