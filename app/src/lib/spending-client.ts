export type SpendingPeriod = {
  sourceProducer: string;
  sourcePeriodKey: string;
  startDate: string;
  endDate: string;
  currency: string;
  total: string;
};

export type SpendingCategory = {
  sourceCategoryKey: string;
  name: string;
  total: string;
  transactionsProvided?: boolean;
};

export type SpendingTransaction = {
  sourceTransactionKey: string;
  date: string;
  description: string;
  amount: string;
};

export type SpendingTransactionSort = "date" | "date-desc" | "amount-desc" | "amount";

export type SpendingOverview = {
  period: SpendingPeriod | null;
  periods: SpendingPeriod[];
  categories: SpendingCategory[];
};

async function requestJson<T>(fetcher: typeof fetch, url: string): Promise<T> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error("Unable to load spending data");
  return response.json() as Promise<T>;
}

function periodUrl(period: SpendingPeriod) {
  const params = new URLSearchParams({ sourceProducer: period.sourceProducer });
  return `/api/spending/periods/${encodeURIComponent(period.sourcePeriodKey)}?${params}`;
}

function categoriesUrl(period: SpendingPeriod) {
  const params = new URLSearchParams({ sourceProducer: period.sourceProducer });
  return `/api/spending/periods/${encodeURIComponent(period.sourcePeriodKey)}/categories?${params}`;
}

function transactionsUrl(period: SpendingPeriod, category: SpendingCategory) {
  const params = new URLSearchParams({ sourceProducer: period.sourceProducer });
  return `/api/spending/periods/${encodeURIComponent(period.sourcePeriodKey)}/categories/${encodeURIComponent(category.sourceCategoryKey)}/transactions?${params}`;
}

export async function loadSpendingCategoryTransactions(
  fetcher: typeof fetch,
  period: SpendingPeriod,
  category: SpendingCategory,
): Promise<SpendingTransaction[]> {
  return (
    await requestJson<{ transactions?: SpendingTransaction[] }>(fetcher, transactionsUrl(period, category))
  ).transactions ?? [];
}

function compareDecimalStrings(a: string, b: string) {
  const parse = (value: string) => {
    const negative = value.startsWith("-");
    const unsigned = value.replace(/^[+-]/, "");
    const [integerPart, fractionalPart = ""] = unsigned.split(".");
    const integer = integerPart.replace(/^0+(?=\d)/, "");
    const fraction = fractionalPart.replace(/0+$/, "");
    const zero = integer === "0" && fraction === "";
    return { integer, fraction, negative: negative && !zero };
  };
  const left = parse(a);
  const right = parse(b);
  if (left.negative !== right.negative) return left.negative ? -1 : 1;

  const integerDifference =
    left.integer.length - right.integer.length || left.integer.localeCompare(right.integer);
  const paddedLength = Math.max(left.fraction.length, right.fraction.length);
  const fractionDifference = left.fraction.padEnd(paddedLength, "0").localeCompare(
    right.fraction.padEnd(paddedLength, "0"),
  );
  const magnitudeDifference = integerDifference || fractionDifference;
  return left.negative ? -magnitudeDifference : magnitudeDifference;
}

export function sortSpendingTransactions(
  transactions: SpendingTransaction[],
  sort: SpendingTransactionSort,
): SpendingTransaction[] {
  return [...transactions].sort((a, b) => {
    if (sort === "amount" || sort === "amount-desc") {
      const amountDifference = compareDecimalStrings(a.amount, b.amount);
      return sort === "amount-desc" ? -amountDifference : amountDifference;
    }

    const dateDifference = a.date.localeCompare(b.date) || a.sourceTransactionKey.localeCompare(b.sourceTransactionKey);
    return sort === "date-desc" ? -dateDifference : dateDifference;
  });
}

export async function loadSpendingOverview(
  fetcher: typeof fetch,
  selectedPeriod?: SpendingPeriod,
): Promise<SpendingOverview> {
  const periodsResponse = await requestJson<{ periods?: SpendingPeriod[] }>(
    fetcher,
    "/api/spending/periods",
  );
  const periods = periodsResponse.periods ?? [];
  if (periods.length === 0) return { period: null, periods, categories: [] };

  const period = selectedPeriod
    ? (await requestJson<{ period: SpendingPeriod }>(fetcher, periodUrl(selectedPeriod))).period
    : (await requestJson<{ period: SpendingPeriod }>(fetcher, "/api/spending/periods/latest")).period;
  const categories = (
    await requestJson<{ categories?: SpendingCategory[] }>(fetcher, categoriesUrl(period))
  ).categories ?? [];

  return { period, periods, categories };
}
