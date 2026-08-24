import { createMcpHandler } from "@modelcontextprotocol/server";

import { createFamilyHubMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";

const handler = createMcpHandler(
  createFamilyHubMcpServer,
);

export async function GET(request: Request) {
  return handler.fetch(request);
}

export async function POST(request: Request) {
  return handler.fetch(request);
}

export async function DELETE(request: Request) {
  return handler.fetch(request);
}
