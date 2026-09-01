export function canEditCalendarEvent(seriesId: string) {
  return !seriesId.startsWith("google:");
}
