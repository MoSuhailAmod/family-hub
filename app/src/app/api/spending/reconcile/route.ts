import { createSpendingReconciliationRouteHandlers } from "@/lib/spending-reconciliation-route-handlers";
import { spendingReconciliationService } from "@/lib/spending";

const MAX_SPENDING_RECONCILIATION_BYTES = 5 * 1024 * 1024;
const handlers = createSpendingReconciliationRouteHandlers(spendingReconciliationService);

function payloadTooLarge() {
  return Response.json({
    success: false,
    code: "VALIDATION",
    error: "The Spending reconciliation payload must be 5 MB or smaller",
  }, { status: 413 });
}

async function parsePayload(request: Request): Promise<unknown | Response> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SPENDING_RECONCILIATION_BYTES) {
    return payloadTooLarge();
  }

  try {
    const reader = request.body?.getReader();
    if (!reader) throw new SyntaxError("Request body is required");

    const chunks: Uint8Array[] = [];
    let bytesRead = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > MAX_SPENDING_RECONCILIATION_BYTES) return payloadTooLarge();
      chunks.push(value);
    }

    const payloadBytes = new Uint8Array(bytesRead);
    let offset = 0;
    for (const chunk of chunks) {
      payloadBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return Response.json({
      success: false,
      code: "VALIDATION",
      error: "The Spending reconciliation payload must be valid JSON",
    }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const payload = await parsePayload(request);
  if (payload instanceof Response) return payload;

  return handlers.reconcileSnapshot(payload);
}
