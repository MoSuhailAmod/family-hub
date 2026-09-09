import { createHash } from "node:crypto";

import { z } from "zod";

const decimal = z
  .string()
  .regex(/^[+-]?\d+(?:\.\d+)?$/, "Must be a signed decimal string");
const isoDate = z.string().refine(
  (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  },
  "Must be an ISO date in YYYY-MM-DD format",
);
const sourceHash = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "Must be a lowercase SHA-256 digest");

const sourceLineSchema = z
  .object({
    sourceTransactionKey: z.string().min(1),
    lineType: z.enum(["transaction", "assumption", "adjustment"]),
    date: isoDate.optional(),
    description: z.string().min(1),
    amount: decimal,
  })
  .strict()
  .superRefine((line, context) => {
    if (line.lineType === "transaction" && !line.date) {
      context.addIssue({
        code: "custom",
        path: ["date"],
        message: "Is required for transaction lines",
      });
    }
  });

const categorySchema = z
  .object({
    sourceCategoryKey: z.string().min(1),
    name: z.string().min(1),
    total: decimal,
    lines: z.array(sourceLineSchema).optional(),
  })
  .strict();

const periodSchema = z
  .object({
    sourcePeriodKey: z.string().min(1),
    startDate: isoDate,
    endDate: isoDate,
    currency: z.string().regex(/^[A-Z]{3}$/, "Must be an ISO 4217 currency code"),
    total: decimal,
    status: z.enum(["partial", "completed"]),
    categories: z.array(categorySchema),
  })
  .strict()
  .superRefine((period, context) => {
    if (period.startDate > period.endDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Must be on or after startDate",
      });
    }

    const categoryKeys = new Set<string>();
    const lineKeys = new Set<string>();
    for (const [categoryIndex, category] of period.categories.entries()) {
      if (categoryKeys.has(category.sourceCategoryKey)) {
        context.addIssue({
          code: "custom",
          path: ["categories", categoryIndex, "sourceCategoryKey"],
          message: "Must be unique within the period",
        });
      }
      categoryKeys.add(category.sourceCategoryKey);

      for (const [lineIndex, line] of (category.lines ?? []).entries()) {
        if (lineKeys.has(line.sourceTransactionKey)) {
          context.addIssue({
            code: "custom",
            path: ["categories", categoryIndex, "lines", lineIndex, "sourceTransactionKey"],
            message: "Must be unique within the period",
          });
        }
        lineKeys.add(line.sourceTransactionKey);
      }
    }
  });

export const spendingReconciliationPayloadSchema = z
  .object({
    schemaVersion: z.literal("spending-reconciliation/v1"),
    source: z
      .object({
        producer: z.string().min(1),
        documentId: z.string().min(1),
        revision: z.string().min(1),
        issuedAt: z.string().datetime({ offset: true }),
        importedBy: z.string().min(1),
        contentSha256: sourceHash,
      })
      .strict(),
    periods: z.array(periodSchema).min(1),
  })
  .strict()
  .superRefine((payload, context) => {
    const periodKeys = new Set<string>();
    for (const [index, period] of payload.periods.entries()) {
      if (periodKeys.has(period.sourcePeriodKey)) {
        context.addIssue({
          code: "custom",
          path: ["periods", index, "sourcePeriodKey"],
          message: "Must be unique within the snapshot",
        });
      }
      periodKeys.add(period.sourcePeriodKey);
    }
  });

export type SpendingReconciliationPayload = z.infer<
  typeof spendingReconciliationPayloadSchema
>;

export type SpendingReconciliationSummary = {
  processed: number;
  unchanged: string[];
  updated: string[];
  inserted: string[];
  partialRefreshed: string[];
  completedFromPartial: string[];
};

export type SpendingReconciliationRepository = {
  reconcile(payload: SpendingReconciliationPayload): Promise<SpendingReconciliationSummary>;
};

export class SpendingReconciliationDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpendingReconciliationDomainError";
  }
}

type ReconciliationResult =
  | { success: true; summary: SpendingReconciliationSummary }
  | { success: false; code: "VALIDATION" | "DOMAIN" | "PERSISTENCE"; error: string };

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

export function contentSha256For(payload: SpendingReconciliationPayload): string {
  const source = { ...payload.source };
  delete (source as Partial<typeof source>).contentSha256;
  return createHash("sha256")
    .update(canonicalize({ ...payload, source }))
    .digest("hex");
}

export function createSpendingReconciliationService(
  repository: SpendingReconciliationRepository,
) {
  return {
    async reconcile(input: unknown): Promise<ReconciliationResult> {
      const parsed = spendingReconciliationPayloadSchema.safeParse(input);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return {
          success: false,
          code: "VALIDATION",
          error: `${issue.path.join(".")}: ${issue.message}`,
        };
      }
      if (contentSha256For(parsed.data) !== parsed.data.source.contentSha256) {
        return {
          success: false,
          code: "VALIDATION",
          error: "source.contentSha256: Does not match the canonical payload",
        };
      }

      try {
        return { success: true, summary: await repository.reconcile(parsed.data) };
      } catch (error) {
        if (error instanceof SpendingReconciliationDomainError) {
          return {
            success: false,
            code: "DOMAIN",
            error: error.message,
          };
        }
        return {
          success: false,
          code: "PERSISTENCE",
          error: "Unable to reconcile Spending snapshot",
        };
      }
    },
  };
}
