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

export type SpendingReportingCategory = {
  reportingGroupId: string | null;
  sourceCategoryKeys: string[];
  name: string;
  total: string;
};

export type SpendingHistoryView = "raw" | "normalized";

export type SpendingHistoryEntry = {
  period: SpendingPeriod;
  categories: (SpendingCategory | SpendingReportingCategory)[];
};

export type SpendingPeriodComparison = {
  absoluteChange: string;
  percentageChange: string | null;
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

function categoriesUrl(period: SpendingPeriod, view: SpendingHistoryView = "raw") {
  const params = new URLSearchParams({ sourceProducer: period.sourceProducer });
  if (view === "normalized") params.set("view", "normalized");
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

export async function loadSpendingHistory(
  fetcher: typeof fetch,
  view: SpendingHistoryView,
): Promise<SpendingHistoryEntry[]> {
  const { periods = [] } = await requestJson<{ periods?: SpendingPeriod[] }>(
    fetcher,
    "/api/spending/periods",
  );
  const entries = await Promise.all(
    periods.map(async (period) => ({
      period,
      categories: (
        await requestJson<{ categories?: (SpendingCategory | SpendingReportingCategory)[] }>(
          fetcher,
          categoriesUrl(period, view),
        )
      ).categories ?? [],
    })),
  );
  return entries.sort((a, b) =>
    b.period.endDate.localeCompare(a.period.endDate) ||
    b.period.startDate.localeCompare(a.period.startDate) ||
    a.period.sourceProducer.localeCompare(b.period.sourceProducer) ||
    a.period.sourcePeriodKey.localeCompare(b.period.sourcePeriodKey),
  );
}

function decimalParts(value: string) {
  const negative = value.startsWith("-");
  const [integer = "0", fraction = ""] = value.replace(/^[+-]/, "").split(".");
  return { negative, integer: integer.replace(/^0+(?=\d)/, ""), fraction };
}

function decimalToScaledInteger(value: string, scale: number) {
  const { negative, integer, fraction } = decimalParts(value);
  const digits = `${integer}${fraction.padEnd(scale, "0")}`.replace(/^0+(?=\d)/, "") || "0";
  const result = BigInt(digits);
  return negative ? -result : result;
}

function scaledIntegerToDecimal(value: bigint, scale: number) {
  const negative = value < BigInt(0);
  const digits = (negative ? -value : value).toString().padStart(scale + 1, "0");
  const integer = scale === 0 ? digits : digits.slice(0, -scale);
  const fraction = scale === 0 ? "" : digits.slice(-scale).replace(/0+$/, "");
  return `${negative ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
}

export function calculatePeriodComparison(
  selectedPeriod: SpendingPeriod,
  previousPeriod: SpendingPeriod | null,
): SpendingPeriodComparison | null {
  if (!previousPeriod || selectedPeriod.currency !== previousPeriod.currency) return null;
  const scale = Math.max(decimalParts(selectedPeriod.total).fraction.length, decimalParts(previousPeriod.total).fraction.length);
  const difference =
    decimalToScaledInteger(selectedPeriod.total, scale) - decimalToScaledInteger(previousPeriod.total, scale);
  const previousTotal = decimalToScaledInteger(previousPeriod.total, scale);
  const percentageScale = 1;
  const percentageNumerator = difference * BigInt(100 * 10 ** percentageScale);
  const absolutePrevious = previousTotal < BigInt(0) ? -previousTotal : previousTotal;
  const roundedPercentage = absolutePrevious === BigInt(0)
    ? null
    : (percentageNumerator < BigInt(0) ? -BigInt(1) : BigInt(1)) *
      ((percentageNumerator < BigInt(0) ? -percentageNumerator : percentageNumerator) + absolutePrevious / BigInt(2)) /
      absolutePrevious;
  return {
    absoluteChange: scaledIntegerToDecimal(difference, scale),
    percentageChange: roundedPercentage === null
      ? null
      : scaledIntegerToDecimal(roundedPercentage, percentageScale),
  };
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
