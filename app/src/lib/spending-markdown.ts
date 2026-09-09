import { createHash } from "node:crypto";

import type { SpendingUploadDocument } from "./spending-upload";

const MARKDOWN_PRODUCER = "family-hub-household-spending-markdown";
const MAX_SPENDING_UPLOAD_BYTES = 5 * 1024 * 1024;
const MONTHS = new Map([
  ["jan", 0], ["feb", 1], ["mar", 2], ["apr", 3], ["may", 4], ["jun", 5],
  ["jul", 6], ["aug", 7], ["sep", 8], ["oct", 9], ["nov", 10], ["dec", 11],
]);

type Category = SpendingUploadDocument["categories"][number];
type PeriodSection = { startDate: string; endDate: string; partial: boolean; content: string };

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

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseAmount(value: string, label: string): string {
  const normalized = value.trim().replace(/^(?:ZAR\s*|R\s*)/i, "").replaceAll(",", "");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`${label} must be an unambiguous decimal amount.`);
  }
  return normalized;
}

function parseHumanDate(value: string, label: string): string {
  const match = value.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (!match) throw new Error(`${label} must use the report date format, for example 28 Jul 2026.`);
  const month = MONTHS.get(match[2].slice(0, 3).toLowerCase());
  const day = Number(match[1]);
  const year = Number(match[3]);
  if (month === undefined || day < 1 || day > 31) {
    throw new Error(`${label} must use the report date format, for example 28 Jul 2026.`);
  }
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    throw new Error(`${label} must be a valid calendar date.`);
  }
  return date.toISOString().slice(0, 10);
}

function sourceCategoryKey(name: string): string {
  const key = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!key) throw new Error(`Category name "${name}" cannot be converted into a stable category key.`);
  return key;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requireSingleMatch(content: string, label: string, expression: RegExp): string {
  const matches = Array.from(content.matchAll(expression)).map((match) => match[1].trim());
  if (matches.length !== 1) {
    throw new Error(matches.length === 0
      ? `The Markdown document is missing ${label}.`
      : `The Markdown document has ambiguous ${label}.`);
  }
  return matches[0];
}

function parsePeriodSections(content: string): PeriodSection[] {
  const headings = Array.from(content.matchAll(/^##\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s+-\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})(.*?)\s*$/gim));
  return headings.map((heading, index) => {
    const start = heading.index! + heading[0].length;
    const end = headings[index + 1]?.index ?? content.length;
    return {
      startDate: parseHumanDate(heading[1], "Period start date"),
      endDate: parseHumanDate(heading[2], "Period end date"),
      partial: /\bpartial\b/i.test(heading[3]),
      content: content.slice(start, end),
    };
  });
}

function categoryHeadingName(heading: string): string {
  return heading.replace(/^<a\b[^>]*><\/a>\s*/i, "").trim();
}

function parseTransactions(content: string, categoryKey: string): Category["transactions"] {
  const bullets = content.split("\n").filter((line) => /^\s*-\s+/.test(line));
  const transactions: NonNullable<Category["transactions"]> = [];

  for (const line of bullets) {
    const match = line.match(/^\s*-\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s+--\s+(.+)\s+--\s+((?:ZAR|R)\s*[+-]?[\d,]+(?:\.\d+)?)\s*$/i);
    if (!match) {
      if (/^\s*-\s*\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/i.test(line)) {
        throw new Error(`Transaction rows for category "${categoryKey}" must use Date -- Description -- Amount.`);
      }
      continue;
    }

    const description = match[2].trim();
    if (!description) throw new Error(`Transactions for category "${categoryKey}" must include a description.`);
    const date = parseHumanDate(match[1], `Transaction date in category "${categoryKey}"`);
    transactions.push({
      sourceTransactionKey: `${categoryKey}-${date}-${transactions.length + 1}`,
      date,
      description,
      amount: parseAmount(match[3], `Transaction amount in category "${categoryKey}"`),
    });
  }

  return transactions.length === 0 ? undefined : transactions;
}

function parseCategories(content: string): Category[] {
  const headings = Array.from(content.matchAll(/^###\s+(.+?)\s*$/gm));
  const categories: Category[] = [];
  const keys = new Set<string>();

  let excluded = false;
  for (let index = 0; index < headings.length; index += 1) {
    const name = categoryHeadingName(headings[index][1]);
    const start = headings[index].index! + headings[index][0].length;
    const end = headings[index + 1]?.index ?? content.length;
    const categoryContent = content.slice(start, end);

    if (/^excluded$/i.test(name)) {
      excluded = true;
      continue;
    }
    if (/^total spending this period\s*=/i.test(name)) continue;
    if (excluded) continue;

    const key = sourceCategoryKey(name);
    if (keys.has(key)) throw new Error(`The Markdown document has ambiguous category "${name}".`);
    keys.add(key);
    const total = parseAmount(
      requireSingleMatch(
        categoryContent,
        `a final total for category "${name}"`,
        new RegExp(`^\\s*\\*\\*\\s*Total\\s+${escapeRegExp(name)}\\s*=\\s*(.+?)\\s*\\*\\*\\s*$`, "gim"),
      ),
      `Final total for category "${name}"`,
    );
    const transactions = parseTransactions(categoryContent, key);
    categories.push({ sourceCategoryKey: key, name, total, ...(transactions === undefined ? {} : { transactions }) });
  }

  if (categories.length === 0) throw new Error("The completed reporting period must include at least one category.");
  return categories;
}

function issuedAtAfter(endDate: string): string {
  const date = new Date(`${endDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export async function parseSpendingMarkdownDocument(content: string): Promise<SpendingUploadDocument> {
  if (new TextEncoder().encode(content).byteLength > MAX_SPENDING_UPLOAD_BYTES) {
    throw new Error("The uploaded file must be 5 MB or smaller.");
  }
  const documentHeadings = Array.from(content.matchAll(/^#\s+Household Spending Budget\s*$/gim));
  if (documentHeadings.length !== 1) {
    throw new Error(documentHeadings.length === 0
      ? "The Markdown document must include a # Household Spending Budget heading."
      : "The Markdown document has an ambiguous Household Spending Budget heading.");
  }

  const completed = parsePeriodSections(content).filter((period) => !period.partial);
  if (completed.length === 0) {
    throw new Error("The Markdown document does not contain a completed reporting period; mark in-progress periods as PARTIAL.");
  }
  const selected = completed.at(-1)!;
  const periodKey = `${selected.startDate}-to-${selected.endDate}`;
  const total = parseAmount(
    requireSingleMatch(
      selected.content,
      "a final total for the completed reporting period",
      /^###\s+(?:<a\b[^>]*><\/a>\s*)?TOTAL SPENDING THIS PERIOD\s*=\s*(.+?)\s*$/gim,
    ),
    "Final total for the completed reporting period",
  );
  const categories = parseCategories(selected.content);
  const selectedPeriodSnapshot = {
    period: {
      sourcePeriodKey: periodKey,
      startDate: selected.startDate,
      endDate: selected.endDate,
      currency: "ZAR",
      total,
    },
    categories,
  };
  const source = {
    producer: MARKDOWN_PRODUCER,
    documentId: `household-spending-${periodKey}`,
    revision: `markdown-${await sha256(canonicalize(selectedPeriodSnapshot))}`,
    issuedAt: issuedAtAfter(selected.endDate),
    contentSha256: "",
  };
  const document: SpendingUploadDocument = {
    schemaVersion: "spending-import/v1",
    source,
    period: selectedPeriodSnapshot.period,
    categories,
  };
  const hashableSource = {
    producer: document.source.producer,
    documentId: document.source.documentId,
    revision: document.source.revision,
    issuedAt: document.source.issuedAt,
  };
  document.source.contentSha256 = await sha256(canonicalize({ ...document, source: hashableSource }));
  return document;
}
