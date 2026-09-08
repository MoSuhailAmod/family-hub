import { notificationDestinationService } from "@/lib/notification-destination-data";
function response(result: { success: boolean; code?: string }) { return Response.json(result, { status: result.success ? 200 : result.code === "NOT_FOUND" ? 404 : 400 }); }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ success: false, code: "VALIDATION", error: "Invalid JSON" }, { status: 400 }); }
  try { return response(await notificationDestinationService.update((await params).id, body as never)); }
  catch { return Response.json({ success: false, error: "Failed to update notification destination" }, { status: 500 }); }
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return response(await notificationDestinationService.delete((await params).id)); }
  catch { return Response.json({ success: false, error: "Failed to delete notification destination" }, { status: 500 }); }
}
