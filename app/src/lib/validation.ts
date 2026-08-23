import { RRule } from "rrule";
import { z } from "zod";

const uuid = z.string().uuid();

const nullableText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === null || value === "") {
        return null;
      }

      return value;
    });

const isoDateString = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "Must be a valid ISO date/time",
);

const baseEventSchema = z.object({
  title: z.string().trim().min(1).max(200),

  description: nullableText(5000),

  startAt: isoDateString,

  endAt: isoDateString,

  allDay: z.boolean().optional().default(false),

  location: nullableText(500),

  categoryId: z.union([uuid, z.null()]).optional().default(null),

  recurrenceRule: nullableText(1000),

  participantIds: z.array(uuid).optional().default([]),
});

export const eventInputSchema = baseEventSchema.superRefine((data, ctx) => {
  const start = new Date(data.startAt);
  const end = new Date(data.endAt);

  if (end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endAt"],
      message: "End date/time must be after start date/time",
    });
  }

  if (data.recurrenceRule) {
    try {
      const ruleText = data.recurrenceRule.replace(/^RRULE:/i, "");
      const options = RRule.parseString(ruleText);

      const frequency = options.freq;

      if (
        frequency === undefined ||
        ![
          RRule.DAILY,
          RRule.WEEKLY,
          RRule.MONTHLY,
          RRule.YEARLY,
        ].includes(frequency)
      ) {
        throw new Error("Unsupported recurrence frequency");
      }

      new RRule({
        ...options,
        dtstart: start,
      });
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrenceRule"],
        message: "Invalid recurrence rule",
      });
    }
  }
});

export type EventInput = z.infer<typeof eventInputSchema>;

export function parseEventInput(input: unknown) {
  const parsed = eventInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false as const,
      errors: parsed.error.flatten(),
    };
  }

  return {
    success: true as const,
    data: {
      ...parsed.data,
      participantIds: [...new Set(parsed.data.participantIds)],
      recurrenceRule: parsed.data.recurrenceRule
        ? parsed.data.recurrenceRule.replace(/^RRULE:/i, "")
        : null,
    },
  };
}
