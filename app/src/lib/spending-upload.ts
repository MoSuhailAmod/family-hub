export const MAX_SPENDING_UPLOAD_BYTES = 5 * 1024 * 1024;

export type SpendingUploadDocument = {
  schemaVersion: "spending-import/v1";
  source: {
    producer: string;
    documentId: string;
    revision: string;
    issuedAt: string;
    contentSha256: string;
  };
  period: {
    sourcePeriodKey: string;
    startDate: string;
    endDate: string;
    currency: string;
    total: string;
  };
  categories: Array<{
    sourceCategoryKey: string;
    name: string;
    total: string;
    transactions?: Array<{
      sourceTransactionKey: string;
      date: string;
      description: string;
      amount: string;
    }>;
  }>;
};

type ExistingSpendingPeriod = {
  sourceProducer: string;
  sourcePeriodKey: string;
};

export type SpendingUploadSummary = {
  sourceProducer: string;
  sourcePeriodKey: string;
  startDate: string;
  endDate: string;
  currency: string;
  total: string;
  categoryCount: number;
  transactionCount: number;
  replacesExistingPeriod: boolean;
};

export type SpendingUploadResult =
  | { success: true; status: "imported" | "duplicate" | "replaced" }
  | { success: false; code: "VALIDATION" | "PERSISTENCE"; error: string };

function hasRequiredStrings(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return keys.every((key) => typeof record[key] === "string" && record[key].length > 0);
}

function isDocument(value: unknown): value is SpendingUploadDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Record<string, unknown>;
  if (document.schemaVersion !== "spending-import/v1" || !Array.isArray(document.categories)) return false;
  if (!hasRequiredStrings(document.source, ["producer", "documentId", "revision", "issuedAt", "contentSha256"])) return false;
  if (!hasRequiredStrings(document.period, ["sourcePeriodKey", "startDate", "endDate", "currency", "total"])) return false;

  return document.categories.every((category) => {
    if (!hasRequiredStrings(category, ["sourceCategoryKey", "name", "total"])) return false;
    const transactions = (category as Record<string, unknown>).transactions;
    return transactions === undefined || (
      Array.isArray(transactions) && transactions.every((transaction) =>
        hasRequiredStrings(transaction, ["sourceTransactionKey", "date", "description", "amount"]),
      )
    );
  });
}

export function parseSpendingUploadDocument(content: string): SpendingUploadDocument {
  if (new TextEncoder().encode(content).byteLength > MAX_SPENDING_UPLOAD_BYTES) {
    throw new Error("The uploaded file must be 5 MB or smaller.");
  }
  let document: unknown;
  try {
    document = JSON.parse(content);
  } catch {
    throw new Error("JSON uploads must be valid Family Hub spending-import/v1 documents. Use your household .md report for the normal monthly workflow.");
  }

  if (!isDocument(document)) {
    throw new Error("JSON uploads must be Family Hub spending-import/v1 documents. Use your household .md report for the normal monthly workflow.");
  }
  return document;
}

export function isMarkdownSpendingUpload(fileName: string): boolean {
  return /\.(?:md|markdown)$/i.test(fileName);
}

export async function prepareSpendingMarkdownUpload(
  fetcher: typeof fetch,
  content: string,
): Promise<SpendingUploadDocument> {
  let response: Response;
  try {
    response = await fetcher("/api/spending/imports/prepare", {
      method: "POST",
      headers: { "content-type": "text/markdown" },
      body: content,
    });
  } catch {
    throw new Error("Unable to prepare the Markdown Spending document. Please try again.");
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("Family Hub could not prepare the Markdown Spending document. Please try again.");
  }
  if (!response.ok) {
    const error = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error
      : "Family Hub could not prepare the Markdown Spending document. Please try again.";
    throw new Error(error);
  }
  if (!isDocument(result)) {
    throw new Error("Family Hub could not prepare the Markdown Spending document. Please try again.");
  }
  return result;
}

export async function parseSpendingUploadContent(
  content: string,
  fileName: string,
): Promise<SpendingUploadDocument> {
  if (isMarkdownSpendingUpload(fileName)) {
    throw new Error("Markdown Spending documents must be prepared by Family Hub before previewing.");
  }
  if (/\.json$/i.test(fileName)) return parseSpendingUploadDocument(content);
  throw new Error("Choose a completed Spending document with a .md or .json filename.");
}

export function summarizeSpendingUpload(
  document: SpendingUploadDocument,
  existingPeriods: ExistingSpendingPeriod[],
): SpendingUploadSummary {
  return {
    sourceProducer: document.source.producer,
    sourcePeriodKey: document.period.sourcePeriodKey,
    startDate: document.period.startDate,
    endDate: document.period.endDate,
    currency: document.period.currency,
    total: document.period.total,
    categoryCount: document.categories.length,
    transactionCount: document.categories.reduce(
      (count, category) => count + (Array.isArray(category.transactions) ? category.transactions.length : 0),
      0,
    ),
    replacesExistingPeriod: existingPeriods.some(
      (period) =>
        period.sourceProducer === document.source.producer &&
        period.sourcePeriodKey === document.period.sourcePeriodKey,
    ),
  };
}

export async function submitSpendingUpload(
  fetcher: typeof fetch,
  document: SpendingUploadDocument,
): Promise<SpendingUploadResult> {
  const response = await fetcher("/api/spending/imports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(document),
  });
  const result = await response.json() as SpendingUploadResult;
  if (!response.ok && result.success) {
    throw new Error("Unable to import Spending snapshot");
  }
  return result;
}
