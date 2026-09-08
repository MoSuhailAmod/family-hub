import { notificationDestinationService } from "@/lib/notification-destination-data";

function response(result: Awaited<ReturnType<typeof notificationDestinationService.create>>) {
  return result.success
    ? Response.json(result, { status: 201 })
    : Response.json(result, { status: result.code === "NOT_FOUND" ? 404 : 400 });
}

export async function GET(request: Request) {
  const memberId = new URL(request.url).searchParams.get("familyMemberId") ?? undefined;
  return Response.json({ items: await notificationDestinationService.list(memberId) });
}

export async function POST(request: Request) {
  try {
    return response(await notificationDestinationService.create(await request.json()));
  } catch {
    return Response.json({ success: false, code: "VALIDATION", error: "Invalid JSON" }, { status: 400 });
  }
}
