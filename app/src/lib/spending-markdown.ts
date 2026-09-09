import type { SpendingUploadDocument } from "./spending-upload";

const MARKDOWN_PRODUCER = "family-hub-household-spending-markdown";
const MAX_SPENDING_UPLOAD_BYTES = 5 * 1024 * 1024;

type Category = SpendingUploadDocument["categories"][number];

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

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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

function parseDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be an ISO date in YYYY-MM-DD format.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be an ISO date in YYYY-MM-DD format.`);
  }
  return value;
}

function parseAmount(value: string, label: string): string {
  const normalized = value.trim().replace(/^(?:ZAR\s*|R\s*)/i, "").replaceAll(",", "");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`${label} must be an unambiguous decimal amount.`);
  }
  return normalized;
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

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function isTableDivider(row: string[]) {
  return row.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseTransactions(lines: string[], categoryKey: string): Category["transactions"] {
  const tables = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.trim().startsWith("|"));
  if (tables.length === 0) return undefined;

  const firstIndex = tables[0].index;
  const header = splitTableRow(lines[firstIndex]);
  if (header.length !== 3 || header.map((cell) => cell.toLowerCase()).join("\u0000") !== "date\u0000description\u0000amount") {
    throw new Error(`Transactions for category "${categoryKey}" must use a Date, Description, Amount table.`);
  }
  if (!lines[firstIndex + 1] || !isTableDivider(splitTableRow(lines[firstIndex + 1]))) {
    throw new Error(`Transactions for category "${categoryKey}" must include a Markdown table divider.`);
  }

  const transactions: NonNullable<Category["transactions"]> = [];
  for (let index = firstIndex + 2; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (!line.startsWith("|")) {
      throw new Error(`Transactions for category "${categoryKey}" must be Markdown table rows.`);
    }
    const row = splitTableRow(line);
    if (row.length !== 3) throw new Error(`Transactions for category "${categoryKey}" has an invalid table row.`);
    const date = parseDate(row[0], `Transaction date in category "${categoryKey}"`);
    const description = row[1];
    if (!description) throw new Error(`Transactions for category "${categoryKey}" must include a description.`);
    transactions.push({
      sourceTransactionKey: `${categoryKey}-${date}-${transactions.length + 1}`,
      date,
      description,
      amount: parseAmount(row[2], `Transaction amount in category "${categoryKey}"`),
    });
  }
  return transactions;
}

function parseCategories(content: string): Category[] {
  const categorySections = Array.from(content.matchAll(/^##\s+Categories\s*$/gim));
  if (categorySections.length !== 1) {
    throw new Error(categorySections.length === 0
      ? "The Markdown document is missing the ## Categories section."
      : "The Markdown document has ambiguous ## Categories sections.");
  }
  const categoriesIndex = categorySections[0].index!;
  const section = content.slice(categoriesIndex).split(/\n(?=##\s+)/)[0];
  const headings = Array.from(section.matchAll(/^###\s+(.+?)\s*$/gm));
  if (headings.length === 0) throw new Error("The Markdown document must include at least one ### category.");

  const keys = new Set<string>();
  return headings.map((heading, index) => {
    const name = heading[1].trim();
    const key = sourceCategoryKey(name);
    if (keys.has(key)) throw new Error(`The Markdown document has ambiguous category "${name}".`);
    keys.add(key);
    const start = heading.index! + heading[0].length;
    const end = headings[index + 1]?.index ?? section.length;
    const categoryContent = section.slice(start, end);
    const total = parseAmount(
      requireSingleMatch(categoryContent, `a final total for category "${name}"`, /^\s*(?:[-*]\s*)?Total\s*:\s*(.+?)\s*$/gim),
      `Final total for category "${name}"`,
    );
    const transactions = parseTransactions(categoryContent.split("\n"), key);
    return { sourceCategoryKey: key, name, total, ...(transactions === undefined ? {} : { transactions }) };
  });
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

  const period = requireSingleMatch(content, "reporting period", /^\s*(?:[-*]\s*)?Period\s*:\s*(.+?)\s*$/gim);
  if (!/^\d{4}-\d{2}$/.test(period) || Number(period.slice(5, 7)) < 1 || Number(period.slice(5, 7)) > 12) {
    throw new Error("Reporting period must be a valid calendar month in YYYY-MM format.");
  }
  const startDate = parseDate(requireSingleMatch(content, "start date", /^\s*(?:[-*]\s*)?Start date\s*:\s*(.+?)\s*$/gim), "Start date");
  const endDate = parseDate(requireSingleMatch(content, "end date", /^\s*(?:[-*]\s*)?End date\s*:\s*(.+?)\s*$/gim), "End date");
  if (startDate > endDate) throw new Error("End date must be on or after start date.");
  const currency = requireSingleMatch(content, "currency", /^\s*(?:[-*]\s*)?Currency\s*:\s*(.+?)\s*$/gim);
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO 4217 code.");
  const total = parseAmount(
    requireSingleMatch(content, "final total spend", /^\s*(?:[-*]\s*)?Total spend\s*:\s*(.+?)\s*$/gim),
    "Final total spend",
  );

  const source = {
    producer: MARKDOWN_PRODUCER,
    documentId: `household-spending-${period}`,
    revision: `markdown-${await sha256(content)}`,
    issuedAt: issuedAtAfter(endDate),
    contentSha256: "",
  };
  const document: SpendingUploadDocument = {
    schemaVersion: "spending-import/v1",
    source,
    period: { sourcePeriodKey: period, startDate, endDate, currency, total },
    categories: parseCategories(content),
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
