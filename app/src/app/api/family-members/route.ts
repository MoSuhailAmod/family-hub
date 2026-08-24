import { getFamilyMembersService } from "@/lib/calendar-service";

export async function GET() {
  try {
    const items = await getFamilyMembersService();

    return Response.json({
      items,
    });
  } catch (error) {
    console.error("Failed to load family members:", error);

    return Response.json(
      {
        error: "Failed to load family members",
      },
      {
        status: 500,
      },
    );
  }
}
