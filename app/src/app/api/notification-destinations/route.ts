import { notificationDestinationService } from "@/lib/notification-destination-data";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function resultResponse(result: { success: boolean; code?: string }) { return Response.json(result, { status: result.success ? 201 : result.code === "NOT_FOUND" ? 404 : 400 }); }

export async function GET(request: Request) {
  const memberId = new URL(request.url).searchParams.get("familyMemberId") ?? undefined;
  if (memberId && !uuid.test(memberId)) return Response.json({ success: false, code: "VALIDATION", error: "Invalid family member id" }, { status: 400 });
  try { return Response.json({ items: await notificationDestinationService.list(memberId) }); }
  catch { return Response.json({ success: false, error: "Failed to load notification destinations" }, { status: 500 }); }
}
export async function POST(request: Request) {
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ success: false, code: "VALIDATION", error: "Invalid JSON" }, { status: 400 }); }
  try { return resultResponse(await notificationDestinationService.create(body as never)); }
  catch { return Response.json({ success: false, error: "Failed to create notification destination" }, { status: 500 }); }
}
