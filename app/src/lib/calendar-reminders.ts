export const reminderPresetOptions = [
  { offsetMinutes: 10, label: "10 minutes before" },
  { offsetMinutes: 30, label: "30 minutes before" },
  { offsetMinutes: 60, label: "1 hour before" },
  { offsetMinutes: 1440, label: "1 day before" },
  { offsetMinutes: 10080, label: "1 week before" },
] as const;

export const approvedReminderOffsets = reminderPresetOptions.map(
  ({ offsetMinutes }) => offsetMinutes,
) as [10, 30, 60, 1440, 10080];

const reminderLabelByOffset = new Map<number, string>(
  reminderPresetOptions.map(({ offsetMinutes, label }) => [offsetMinutes, label]),
);

export function formatReminderOffsets(offsets: number[]) {
  return [...offsets]
    .sort((a, b) => b - a)
    .flatMap((offset) => reminderLabelByOffset.get(offset) ?? []);
}
