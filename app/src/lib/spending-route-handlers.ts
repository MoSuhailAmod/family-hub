import { SpendingValidationError } from "./spending-service";
import type {
  SpendingCategory,
  SpendingImportMetadata,
  SpendingPeriod,
  SpendingReportingCategory,
  SpendingReportingGroup,
  SpendingTransaction,
} from "./spending-service";

export type SpendingService = {
  listPeriods: () => Promise<SpendingPeriod[]>;
  getLatestPeriod: (sourceProducer?: string) => Promise<SpendingPeriod | null>;
  getPeriod: (sourceProducer: string, sourcePeriodKey: string) => Promise<SpendingPeriod | null>;
  listCategories: (sourceProducer: string, sourcePeriodKey: string) => Promise<SpendingCategory[]>;
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
  listCategoryHistory: (
    sourceProducer: string,
    sourceCategoryKey: string,
  ) => Promise<SpendingCategory[]>;
  listImportMetadata: (sourceProducer?: string) => Promise<SpendingImportMetadata[]>;
};

function requiredKey(value: string, name: string) {
  const normalized = value.trim();
  if (!normalized) throw new SpendingValidationError(`${name} is required`);
  return normalized;
}

function errorResponse(error: unknown, operation: string) {
  if (error instanceof SpendingValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error(`Failed to ${operation} Spending data:`, error);
  return Response.json({ error: `Failed to ${operation} Spending data` }, { status: 500 });
}

function periodNotFound() {
  return Response.json({ error: "Spending period not found" }, { status: 404 });
}

function categoryNotFound() {
  return Response.json({ error: "Spending category not found" }, { status: 404 });
}

export function createSpendingRouteHandlers(service: SpendingService) {
  return {
    async listPeriods() {
      try {
        return Response.json({ periods: await service.listPeriods() });
      } catch (error) {
        return errorResponse(error, "list");
      }
    },

    async getLatestPeriod(sourceProducer?: string) {
      try {
        const period = await service.getLatestPeriod(sourceProducer);
        return period ? Response.json({ period }) : periodNotFound();
      } catch (error) {
        return errorResponse(error, "load");
      }
    },

    async getPeriod(sourceProducer: string, sourcePeriodKey: string) {
      try {
        const period = await service.getPeriod(
          requiredKey(sourceProducer, "sourceProducer"),
          requiredKey(sourcePeriodKey, "sourcePeriodKey"),
        );
        return period ? Response.json({ period }) : periodNotFound();
      } catch (error) {
        return errorResponse(error, "load");
      }
    },

    async listCategories(sourceProducer: string, sourcePeriodKey: string) {
      try {
        const period = await service.getPeriod(
          requiredKey(sourceProducer, "sourceProducer"),
          requiredKey(sourcePeriodKey, "sourcePeriodKey"),
        );
        if (!period) return periodNotFound();
        return Response.json({ categories: await service.listCategories(sourceProducer, sourcePeriodKey) });
      } catch (error) {
        return errorResponse(error, "load");
      }
    },

    async listReportingCategories(sourceProducer: string, sourcePeriodKey: string) {
      try {
        const period = await service.getPeriod(
          requiredKey(sourceProducer, "sourceProducer"),
          requiredKey(sourcePeriodKey, "sourcePeriodKey"),
        );
        if (!period) return periodNotFound();
        return Response.json({
          categories: await service.listReportingCategories(sourceProducer, sourcePeriodKey),
        });
      } catch (error) {
        return errorResponse(error, "load");
      }
    },

    async createReportingGroup(name: string) {
      try {
        return Response.json({ reportingGroup: await service.createReportingGroup(name) }, { status: 201 });
      } catch (error) {
        return errorResponse(error, "create");
      }
    },

    async renameReportingGroup(id: string, name: string) {
      try {
        const reportingGroup = await service.renameReportingGroup(id, name);
        return reportingGroup
          ? Response.json({ reportingGroup })
          : Response.json({ error: "Spending reporting group not found" }, { status: 404 });
      } catch (error) {
        return errorResponse(error, "update");
      }
    },

    async setCategoryReportingGroup(
      sourceProducer: string,
      sourceCategoryKey: string,
      reportingGroupId: string | null,
    ) {
      try {
        await service.setCategoryReportingGroup(sourceProducer, sourceCategoryKey, reportingGroupId);
        return new Response(null, { status: 204 });
      } catch (error) {
        return errorResponse(error, "update");
      }
    },

    async listTransactions(
      sourceProducer: string,
      sourcePeriodKey: string,
      sourceCategoryKey: string,
    ) {
      try {
        const producer = requiredKey(sourceProducer, "sourceProducer");
        const periodKey = requiredKey(sourcePeriodKey, "sourcePeriodKey");
        const categoryKey = requiredKey(sourceCategoryKey, "sourceCategoryKey");
        const period = await service.getPeriod(producer, periodKey);
        if (!period) return periodNotFound();
        const categories = await service.listCategories(producer, periodKey);
        if (!categories.some((category) => category.sourceCategoryKey === categoryKey)) {
          return categoryNotFound();
        }
        return Response.json({
          transactions: await service.listTransactions(producer, periodKey, categoryKey),
        });
      } catch (error) {
        return errorResponse(error, "load");
      }
    },

    async listCategoryHistory(sourceProducer: string, sourceCategoryKey: string) {
      try {
        return Response.json({
          categories: await service.listCategoryHistory(sourceProducer, sourceCategoryKey),
        });
      } catch (error) {
        return errorResponse(error, "load");
      }
    },

    async listImportMetadata(sourceProducer?: string) {
      try {
        return Response.json({ imports: await service.listImportMetadata(sourceProducer) });
      } catch (error) {
        return errorResponse(error, "load");
      }
    },
  };
}
