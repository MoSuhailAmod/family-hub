export type SpendingPeriod = {
  sourceProducer: string;
  sourcePeriodKey: string;
  startDate: string;
  endDate: string;
  currency: string;
  total: string;
  sourceDocumentId: string;
  sourceRevision: string;
  sourceIssuedAt: Date;
  importedAt: Date;
  status: "partial" | "completed";
};

export type SpendingCategory = {
  sourceProducer: string;
  sourcePeriodKey: string;
  sourceCategoryKey: string;
  name: string;
  total: string;
  transactionsProvided: boolean;
};

export type SpendingReportingCategory = {
  sourceProducer: string;
  sourcePeriodKey: string;
  reportingGroupId: string | null;
  sourceCategoryKeys: string[];
  name: string;
  total: string;
};

export type SpendingReportingGroup = {
  id: string;
  name: string;
};

export type SpendingTransaction = {
  sourceProducer: string;
  sourcePeriodKey: string;
  sourceCategoryKey: string;
  sourceTransactionKey: string;
  date: string;
  description: string;
  amount: string;
};

export type SpendingImportMetadata = SpendingPeriod & {
  contentSha256: string;
};

export type SpendingRepository = {
  listPeriods: () => Promise<SpendingPeriod[]>;
  getLatestPeriod: (sourceProducer?: string) => Promise<SpendingPeriod | null>;
  getPeriod: (
    sourceProducer: string,
    sourcePeriodKey: string,
  ) => Promise<SpendingPeriod | null>;
  listCategories: (
    sourceProducer: string,
    sourcePeriodKey: string,
  ) => Promise<SpendingCategory[]>;
  listReportingCategories: (
    sourceProducer: string,
    sourcePeriodKey: string,
  ) => Promise<SpendingReportingCategory[]>;
  createReportingGroup: (name: string) => Promise<SpendingReportingGroup>;
  renameReportingGroup: (id: string, name: string) => Promise<SpendingReportingGroup | null>;
  setCategoryReportingGroup: (
    sourceProducer: string,
    sourceCategoryKey: string,
    reportingGroupId: string | null,
  ) => Promise<void>;
  listTransactions: (
    sourceProducer: string,
    sourcePeriodKey: string,
    sourceCategoryKey: string,
  ) => Promise<SpendingTransaction[]>;
  listRecentTransactions: (
    sourceProducer: string,
    sourcePeriodKey: string,
  ) => Promise<{ transactionCount: number; transactions: SpendingTransaction[] }>;
  listCategoryHistory: (
    sourceProducer: string,
    sourceCategoryKey: string,
  ) => Promise<SpendingCategory[]>;
  listImportMetadata: (sourceProducer?: string) => Promise<SpendingImportMetadata[]>;
};

export class SpendingValidationError extends Error {}

function requiredKey(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new SpendingValidationError(`${name} is required`);
  return normalized;
}

function comparePeriods(a: SpendingPeriod, b: SpendingPeriod) {
  return (
    b.endDate.localeCompare(a.endDate) ||
    b.startDate.localeCompare(a.startDate) ||
    a.sourceProducer.localeCompare(b.sourceProducer) ||
    a.sourcePeriodKey.localeCompare(b.sourcePeriodKey)
  );
}

function compareCategories(a: SpendingCategory, b: SpendingCategory) {
  return a.name.localeCompare(b.name) || a.sourceCategoryKey.localeCompare(b.sourceCategoryKey);
}

function compareReportingCategories(a: SpendingReportingCategory, b: SpendingReportingCategory) {
  return a.name.localeCompare(b.name) || (a.reportingGroupId ?? "").localeCompare(b.reportingGroupId ?? "");
}

export function createSpendingService(repository: SpendingRepository) {
  return {
    async listPeriods() {
      return (await repository.listPeriods()).sort(comparePeriods);
    },

    async getLatestPeriod(sourceProducer?: string) {
      return repository.getLatestPeriod(
        sourceProducer === undefined ? undefined : requiredKey(sourceProducer, "sourceProducer"),
      );
    },

    async getPeriod(sourceProducer: string, sourcePeriodKey: string) {
      return repository.getPeriod(
        requiredKey(sourceProducer, "sourceProducer"),
        requiredKey(sourcePeriodKey, "sourcePeriodKey"),
      );
    },

    async listCategories(sourceProducer: string, sourcePeriodKey: string) {
      return (
        await repository.listCategories(
          requiredKey(sourceProducer, "sourceProducer"),
          requiredKey(sourcePeriodKey, "sourcePeriodKey"),
        )
      ).sort(compareCategories);
    },

    async listReportingCategories(sourceProducer: string, sourcePeriodKey: string) {
      return (
        await repository.listReportingCategories(
          requiredKey(sourceProducer, "sourceProducer"),
          requiredKey(sourcePeriodKey, "sourcePeriodKey"),
        )
      ).sort(compareReportingCategories);
    },

    async createReportingGroup(name: string) {
      return repository.createReportingGroup(requiredKey(name, "name"));
    },

    async renameReportingGroup(id: string, name: string) {
      return repository.renameReportingGroup(
        requiredKey(id, "reportingGroupId"),
        requiredKey(name, "name"),
      );
    },

    async setCategoryReportingGroup(
      sourceProducer: string,
      sourceCategoryKey: string,
      reportingGroupId: string | null,
    ) {
      return repository.setCategoryReportingGroup(
        requiredKey(sourceProducer, "sourceProducer"),
        requiredKey(sourceCategoryKey, "sourceCategoryKey"),
        reportingGroupId === null ? null : requiredKey(reportingGroupId, "reportingGroupId"),
      );
    },

    async listTransactions(
      sourceProducer: string,
      sourcePeriodKey: string,
      sourceCategoryKey: string,
    ) {
      return repository.listTransactions(
        requiredKey(sourceProducer, "sourceProducer"),
        requiredKey(sourcePeriodKey, "sourcePeriodKey"),
        requiredKey(sourceCategoryKey, "sourceCategoryKey"),
      );
    },

    async listRecentTransactions(sourceProducer: string, sourcePeriodKey: string) {
      return repository.listRecentTransactions(
        requiredKey(sourceProducer, "sourceProducer"),
        requiredKey(sourcePeriodKey, "sourcePeriodKey"),
      );
    },

    async listCategoryHistory(sourceProducer: string, sourceCategoryKey: string) {
      return repository.listCategoryHistory(
        requiredKey(sourceProducer, "sourceProducer"),
        requiredKey(sourceCategoryKey, "sourceCategoryKey"),
      );
    },

    async listImportMetadata(sourceProducer?: string) {
      return repository.listImportMetadata(
        sourceProducer === undefined ? undefined : requiredKey(sourceProducer, "sourceProducer"),
      );
    },
  };
}
