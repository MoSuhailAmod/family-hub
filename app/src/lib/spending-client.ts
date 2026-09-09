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
};

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
