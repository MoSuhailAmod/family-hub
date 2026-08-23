import { listFamilyMembers } from "@/lib/calendar-data";

export async function GET() {
  try {
    const items = await listFamilyMembers();

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
