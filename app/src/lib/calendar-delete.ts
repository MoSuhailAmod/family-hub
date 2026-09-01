type DeleteCalendarEventResult =
  | { success: true }
  | { success: false; error: string };

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function errorFromResponse(body: unknown) {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }

  return "The event could not be deleted. Please try again.";
}

export function canDeleteCalendarEvent(seriesId: string) {
  return !seriesId.startsWith("google:");
}

export async function deleteCalendarEvent(
  seriesId: string,
  fetcher: Fetcher = fetch,
): Promise<DeleteCalendarEventResult> {
  try {
    const response = await fetcher(
      `/api/events/${encodeURIComponent(seriesId)}`,
      { method: "DELETE" },
    );

    if (response.ok) {
      return { success: true };
    }

    const body: unknown = await response.json().catch(() => null);
    return { success: false, error: errorFromResponse(body) };
  } catch {
    return {
      success: false,
      error: "The event could not be deleted. Please try again.",
    };
  }
}
