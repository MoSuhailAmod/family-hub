import { db } from "@/lib/db";

export async function GET() {
  try {
    const result = await db.query(
      "SELECT current_database() AS database, current_user AS user, NOW() AS time"
    );

    return Response.json({
      ok: true,
      database: result.rows[0].database,
      user: result.rows[0].user,
      time: result.rows[0].time,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return Response.json(
      {
        ok: false,
        error: "Database connection failed",
      },
      { status: 500 }
    );
  }
}
