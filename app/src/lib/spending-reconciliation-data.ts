import { and, eq, inArray, sql } from "drizzle-orm";

import {
  spendingCategories,
  spendingImports,
  spendingPeriods,
  spendingPeriodCategories,
  spendingReconciliationLog,
  spendingSourceDocuments,
  spendingTransactions,
} from "@/db/schema";
import { db } from "@/lib/db";
import type {
  SpendingReconciliationPayload,
  SpendingReconciliationRepository,
  SpendingReconciliationSummary,
} from "./spending-reconciliation";

type Period = SpendingReconciliationPayload["periods"][number];

type ExistingSnapshotRow = {
  id: string;
  status: "partial" | "completed";
  startDate: string;
  endDate: string;
  currency: string;
  total: string;
  categoryId: string | null;
  sourceCategoryKey: string | null;
  sourceCategoryName: string | null;
  categoryTotal: string | null;
  transactionsProvided: boolean | null;
  sourceTransactionKey: string | null;
  sourceTransactionDate: string | null;
  description: string | null;
  amount: string | null;
  lineType: "transaction" | "assumption" | "adjustment" | null;
  displayOrder: number | null;
};

function stablePeriod(period: Period) {
  return JSON.stringify({
    sourcePeriodKey: period.sourcePeriodKey,
    startDate: period.startDate,
    endDate: period.endDate,
    currency: period.currency,
    total: period.total,
    status: period.status,
    categories: [...period.categories]
      .map((category) => ({
        sourceCategoryKey: category.sourceCategoryKey,
        name: category.name,
        total: category.total,
        linesProvided: category.lines !== undefined,
        lines: (category.lines ?? [])
          .map((line, displayOrder) => ({ ...line, date: line.date ?? null, displayOrder }))
          .sort((left, right) => left.sourceTransactionKey.localeCompare(right.sourceTransactionKey)),
      }))
      .sort((left, right) => left.sourceCategoryKey.localeCompare(right.sourceCategoryKey)),
  });
}

function existingPeriod(rows: ExistingSnapshotRow[], sourcePeriodKey: string): Period | null {
  if (!rows.length) return null;
  const first = rows[0];
  const categories = new Map<string, NonNullable<Period["categories"]>[number]>();
  for (const row of rows) {
    if (!row.categoryId || !row.sourceCategoryKey || !row.sourceCategoryName || row.categoryTotal === null) continue;
    let category = categories.get(row.categoryId);
    if (!category) {
      category = {
        sourceCategoryKey: row.sourceCategoryKey,
        name: row.sourceCategoryName,
        total: row.categoryTotal,
        ...(row.transactionsProvided ? { lines: [] } : {}),
      };
      categories.set(row.categoryId, category);
    }
    if (row.sourceTransactionKey && row.description && row.amount !== null && row.lineType) {
      const lines = category.lines!;
      const line = {
        sourceTransactionKey: row.sourceTransactionKey,
        lineType: row.lineType,
        ...(row.sourceTransactionDate ? { date: row.sourceTransactionDate } : {}),
        description: row.description,
        amount: row.amount,
      };
      Object.defineProperty(line, "displayOrder", {
        value: row.displayOrder ?? 0,
        enumerable: false,
      });
      lines.push(line);
    }
  }
  for (const category of categories.values()) {
    if (category.lines) {
      category.lines.sort((left, right) => {
        const leftOrder = (left as typeof left & { displayOrder?: number }).displayOrder ?? 0;
        const rightOrder = (right as typeof right & { displayOrder?: number }).displayOrder ?? 0;
        return leftOrder - rightOrder || left.sourceTransactionKey.localeCompare(right.sourceTransactionKey);
      });
    }
  }
  return {
    sourcePeriodKey,
    startDate: first.startDate,
    endDate: first.endDate,
    currency: first.currency,
    total: first.total,
    status: first.status,
    categories: [...categories.values()],
  };
}

function emptySummary(processed: number): SpendingReconciliationSummary {
  return {
    processed,
    unchanged: [],
    updated: [],
    inserted: [],
    partialRefreshed: [],
    completedFromPartial: [],
  };
}

export function createSpendingReconciliationRepository<
  TDatabase extends Pick<typeof db, "select" | "transaction">,
>(database: TDatabase): SpendingReconciliationRepository {
  return {
    async reconcile(payload) {
      return database.transaction(async (transaction) => {
        const { source } = payload;
        const summary = emptySummary(payload.periods.length);
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtext(${source.producer}), hashtext(${source.documentId}))`,
        );
        for (const period of payload.periods) {
          await transaction.execute(
            sql`select pg_advisory_xact_lock(hashtext(${source.producer}), hashtext(${period.sourcePeriodKey}))`,
          );
        }

        const [matchingImport] = await transaction
          .select({ id: spendingImports.id })
          .from(spendingImports)
          .where(
            and(
              eq(spendingImports.sourceProducer, source.producer),
              eq(spendingImports.sourceDocumentId, source.documentId),
              eq(spendingImports.sourceRevision, source.revision),
              eq(spendingImports.sourceContentSha256, source.contentSha256),
            ),
          )
          .limit(1);

        let importId = matchingImport?.id;
        if (!importId) {
          const [document] = await transaction
            .select({ sourceProducer: spendingSourceDocuments.sourceProducer })
            .from(spendingSourceDocuments)
            .where(
              and(
                eq(spendingSourceDocuments.sourceProducer, source.producer),
                eq(spendingSourceDocuments.sourceDocumentId, source.documentId),
              ),
            )
            .limit(1);
          if (!document) {
            await transaction.insert(spendingSourceDocuments).values({
              sourceProducer: source.producer,
              sourceDocumentId: source.documentId,
            });
          }
          const [created] = await transaction
            .insert(spendingImports)
            .values({
              sourceProducer: source.producer,
              sourceDocumentId: source.documentId,
              sourceRevision: source.revision,
              sourceContentSha256: source.contentSha256,
              sourceIssuedAt: new Date(source.issuedAt),
              importedBy: source.importedBy,
              sourcePeriodCount: payload.periods.length,
            })
            .returning({ id: spendingImports.id });
          importId = created.id;
        }

        for (const period of payload.periods) {
          const rows = await transaction
            .select({
              id: spendingPeriods.id,
              status: spendingPeriods.status,
              startDate: spendingPeriods.startDate,
              endDate: spendingPeriods.endDate,
              currency: spendingPeriods.currency,
              total: spendingPeriods.total,
              categoryId: spendingPeriodCategories.id,
              sourceCategoryKey: spendingCategories.sourceCategoryKey,
              sourceCategoryName: spendingPeriodCategories.sourceCategoryName,
              categoryTotal: spendingPeriodCategories.total,
              transactionsProvided: spendingPeriodCategories.transactionsProvided,
              sourceTransactionKey: spendingTransactions.sourceTransactionKey,
              sourceTransactionDate: spendingTransactions.sourceTransactionDate,
              description: spendingTransactions.description,
              amount: spendingTransactions.amount,
              lineType: spendingTransactions.lineType,
              displayOrder: spendingTransactions.displayOrder,
            })
            .from(spendingPeriods)
            .leftJoin(spendingPeriodCategories, eq(spendingPeriodCategories.periodId, spendingPeriods.id))
            .leftJoin(spendingCategories, eq(spendingCategories.id, spendingPeriodCategories.categoryId))
            .leftJoin(
              spendingTransactions,
              eq(spendingTransactions.periodCategoryId, spendingPeriodCategories.id),
            )
            .where(
              and(
                eq(spendingPeriods.sourceProducer, source.producer),
                eq(spendingPeriods.sourcePeriodKey, period.sourcePeriodKey),
              ),
            );
          const existing = existingPeriod(rows as ExistingSnapshotRow[], period.sourcePeriodKey);
          const existingId = rows[0]?.id;
          let action: "insert" | "update" | "unchanged" | "partial-refresh" | "completed-from-partial";
          let periodId = existingId ?? null;

          if (existing && stablePeriod(existing) === stablePeriod(period)) {
            action = "unchanged";
            summary.unchanged.push(period.sourcePeriodKey);
          } else {
            if (!existing) {
              action = period.status === "partial" ? "partial-refresh" : "insert";
            } else if (existing.status === "partial" && period.status === "completed") {
              action = "completed-from-partial";
            } else if (period.status === "partial") {
              action = "partial-refresh";
            } else {
              action = "update";
            }

            if (existingId) {
              await transaction.delete(spendingPeriods).where(eq(spendingPeriods.id, existingId));
            }
            const [createdPeriod] = await transaction
              .insert(spendingPeriods)
              .values({
                importId,
                sourceProducer: source.producer,
                sourcePeriodKey: period.sourcePeriodKey,
                startDate: period.startDate,
                endDate: period.endDate,
                currency: period.currency,
                total: period.total,
                status: period.status,
              })
              .returning({ id: spendingPeriods.id });
            periodId = createdPeriod.id;

            if (period.categories.length) {
              await transaction
                .insert(spendingCategories)
                .values(period.categories.map((category) => ({
                  sourceProducer: source.producer,
                  sourceCategoryKey: category.sourceCategoryKey,
                })))
                .onConflictDoNothing();
              const categoryRows = await transaction
                .select({ id: spendingCategories.id, sourceCategoryKey: spendingCategories.sourceCategoryKey })
                .from(spendingCategories)
                .where(and(
                  eq(spendingCategories.sourceProducer, source.producer),
                  inArray(spendingCategories.sourceCategoryKey, period.categories.map((category) => category.sourceCategoryKey)),
                ));
              const categoryIds = new Map(categoryRows.map((category) => [category.sourceCategoryKey, category.id]));
              const periodCategories = await transaction
                .insert(spendingPeriodCategories)
                .values(period.categories.map((category) => ({
                  periodId: periodId!,
                  categoryId: categoryIds.get(category.sourceCategoryKey)!,
                  sourceProducer: source.producer,
                  sourceCategoryName: category.name,
                  total: category.total,
                  transactionsProvided: category.lines !== undefined,
                })))
                .returning({ id: spendingPeriodCategories.id, categoryId: spendingPeriodCategories.categoryId });
              const periodCategoryIds = new Map(periodCategories.map((category) => [category.categoryId, category.id]));
              const lines = period.categories.flatMap((category) => {
                const categoryId = categoryIds.get(category.sourceCategoryKey)!;
                return (category.lines ?? []).map((line, displayOrder) => ({
                  periodId: periodId!,
                  periodCategoryId: periodCategoryIds.get(categoryId)!,
                  sourceTransactionKey: line.sourceTransactionKey,
                  sourceTransactionDate: line.date ?? null,
                  description: line.description,
                  amount: line.amount,
                  lineType: line.lineType,
                  displayOrder,
                }));
              });
              if (lines.length) await transaction.insert(spendingTransactions).values(lines);
            }

            if (action === "insert") summary.inserted.push(period.sourcePeriodKey);
            else if (action === "update") summary.updated.push(period.sourcePeriodKey);
            else if (action === "partial-refresh") summary.partialRefreshed.push(period.sourcePeriodKey);
            else summary.completedFromPartial.push(period.sourcePeriodKey);
          }

          await transaction.insert(spendingReconciliationLog).values({
            importId,
            periodId,
            sourceProducer: source.producer,
            sourcePeriodKey: period.sourcePeriodKey,
            action,
          });
        }
        return summary;
      });
    },
  };
}
