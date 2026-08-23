import { listEventCategories } from "@/lib/calendar-data";

export async function GET() {
  try {
    const items = await listEventCategories();

    return Response.json({
      items,
    });
  } catch (error) {
    console.error("Failed to load event categories:", error);

    return Response.json(
      {
        error: "Failed to load event categories",
      },
      {
        status: 500,
      },
    );
  }
}
