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

const transactionSchema = z
  .object({
    sourceTransactionKey: z.string().min(1),
    date: isoDate,
    description: z.string().min(1),
    amount: decimal,
  })
  .strict();

const categorySchema = z
  .object({
    sourceCategoryKey: z.string().min(1),
    name: z.string().min(1),
    total: decimal,
    transactions: z.array(transactionSchema).optional(),
  })
  .strict();

export const spendingImportPayloadSchema = z
  .object({
    schemaVersion: z.literal("spending-import/v1"),
    source: z
      .object({
        producer: z.string().min(1),
        documentId: z.string().min(1),
        revision: z.string().min(1),
        issuedAt: z.string().datetime({ offset: true }),
        contentSha256: sourceHash,
      })
      .strict(),
    period: z
      .object({
        sourcePeriodKey: z.string().min(1),
        startDate: isoDate,
        endDate: isoDate,
        currency: z.string().regex(/^[A-Z]{3}$/, "Must be an ISO 4217 currency code"),
        total: decimal,
      })
      .strict(),
    categories: z.array(categorySchema),
  })
  .strict()
  .superRefine((payload, context) => {
    if (payload.period.startDate > payload.period.endDate) {
      context.addIssue({
        code: "custom",
        path: ["period", "endDate"],
        message: "Must be on or after period.startDate",
      });
    }

    const categoryKeys = new Set<string>();
    const transactionKeys = new Set<string>();
    for (const [categoryIndex, category] of payload.categories.entries()) {
      if (categoryKeys.has(category.sourceCategoryKey)) {
        context.addIssue({
          code: "custom",
          path: ["categories", categoryIndex, "sourceCategoryKey"],
          message: "Must be unique within the payload",
        });
      }
      categoryKeys.add(category.sourceCategoryKey);

      for (const [transactionIndex, transaction] of (category.transactions ?? []).entries()) {
        if (transactionKeys.has(transaction.sourceTransactionKey)) {
          context.addIssue({
            code: "custom",
            path: ["categories", categoryIndex, "transactions", transactionIndex, "sourceTransactionKey"],
            message: "Must be unique within the source period",
          });
        }
        transactionKeys.add(transaction.sourceTransactionKey);
      }
    }
  });

export type SpendingImportPayload = z.infer<typeof spendingImportPayloadSchema>;

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

export function contentSha256For(payload: SpendingImportPayload): string {
  const source = { ...payload.source };
  delete (source as Partial<typeof source>).contentSha256;
  return createHash("sha256")
    .update(canonicalize({ ...payload, source }))
    .digest("hex");
}

export class SpendingImportDocumentPeriodConflictError extends Error {
  readonly code = "SPENDING_IMPORT_DOCUMENT_PERIOD_CONFLICT";

  constructor() {
    super("A source document cannot describe multiple periods");
    this.name = "SpendingImportDocumentPeriodConflictError";
  }
}

export type SpendingImportRepository = {
  importSnapshot(
    payload: SpendingImportPayload,
  ): Promise<"imported" | "duplicate" | "replaced">;
};

type ImportResult =
  | { success: true; status: "imported" | "duplicate" | "replaced" }
  | { success: false; code: "VALIDATION" | "PERSISTENCE"; error: string };

function isDocumentPeriodConflict(
  error: unknown,
): error is { code: "SPENDING_IMPORT_DOCUMENT_PERIOD_CONFLICT" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "SPENDING_IMPORT_DOCUMENT_PERIOD_CONFLICT"
  );
}

export function createSpendingImportService(repository: SpendingImportRepository) {
  return {
    async import(input: unknown): Promise<ImportResult> {
      const parsed = spendingImportPayloadSchema.safeParse(input);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return {
          success: false,
          code: "VALIDATION",
          error: `${issue.path.join(".")}: ${issue.message}`,
        };
      }

      const payload = parsed.data;
      if (contentSha256For(payload) !== payload.source.contentSha256) {
        return {
          success: false,
          code: "VALIDATION",
          error: "source.contentSha256: Does not match the canonical payload",
        };
      }

      try {
        return { success: true, status: await repository.importSnapshot(payload) };
      } catch (error) {
        if (isDocumentPeriodConflict(error)) {
          return {
            success: false,
            code: "VALIDATION",
            error: "source.documentId: A source document cannot describe multiple periods",
          };
        }
        return {
          success: false,
          code: "PERSISTENCE",
          error: "Unable to import Spending snapshot",
        };
      }
    },
  };
}
