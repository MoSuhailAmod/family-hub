import { NextResponse } from "next/server";
import ical from "node-ical";

export const dynamic = "force-dynamic";

export async function GET() {
  const url =
    process.env.GOOGLE_FAMILY_CALENDAR_ICS_URL;

  if (!url) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Google Family Calendar feed is not configured",
      },
      { status: 503 },
    );
  }

  try {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      10000,
    );

    let response: Response;

    try {
      response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(
        `Google Calendar returned HTTP ${response.status}`,
      );
    }

    const icsText = await response.text();

    const calendar =
      await ical.async.parseICS(icsText);

    const eventCount = Object.values(
      calendar,
    ).filter(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        item.type === "VEVENT",
    ).length;

    return NextResponse.json({
      ok: true,
      source: "google-family-calendar",
      eventCount,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Google Calendar ICS check failed:",
      error instanceof Error
        ? error.message
        : error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Unable to read Google Family Calendar feed",
      },
      { status: 502 },
    );
  }
}
