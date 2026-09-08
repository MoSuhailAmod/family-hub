import { notificationDestinationService } from "@/lib/notification-destination-data";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await notificationDestinationService.update(id, await request.json());
    return Response.json(result, {
      status: result.success ? 200 : result.code === "NOT_FOUND" ? 404 : 400,
    });
  } catch {
    return Response.json({ success: false, code: "VALIDATION", error: "Invalid JSON" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await notificationDestinationService.delete(id);
  return Response.json(result, {
    status: result.success ? 200 : result.code === "NOT_FOUND" ? 404 : 400,
  });
}
