import { createMcpHandler } from "@modelcontextprotocol/server";

import { requireExternalToken } from "@/lib/external-auth";
import { createFamilyHubMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";

const handler = createMcpHandler(
  createFamilyHubMcpServer,
);

export async function GET(request: Request) {
  const denied = requireExternalToken(request);
  if (denied) return denied;
  return handler.fetch(request);
}

export async function POST(request: Request) {
  const denied = requireExternalToken(request);
  if (denied) return denied;
  return handler.fetch(request);
}

export async function DELETE(request: Request) {
  const denied = requireExternalToken(request);
  if (denied) return denied;
  return handler.fetch(request);
}
