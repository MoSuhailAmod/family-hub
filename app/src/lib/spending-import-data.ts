import { and, eq, inArray, sql } from "drizzle-orm";

import {
  spendingCategories,
  spendingImports,
  spendingPeriods,
  spendingPeriodCategories,
  spendingSourceDocuments,
  spendingTransactions,
} from "@/db/schema";
import { db } from "@/lib/db";
import { SpendingImportDocumentPeriodConflictError } from "./spending-import";
import type { SpendingImportPayload, SpendingImportRepository } from "./spending-import";

export function createSpendingImportRepository<
  TDatabase extends Pick<typeof db, "select" | "transaction">,
>(database: TDatabase): SpendingImportRepository {
  return {
    async importSnapshot(payload: SpendingImportPayload) {
      return database.transaction(async (transaction) => {
        const { source, period, categories } = payload;
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtext(${source.producer}), hashtext(${source.documentId}))`,
        );
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtext(${source.producer}), hashtext(${period.sourcePeriodKey}))`,
        );
        const [matchingRevision] = await transaction
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
        if (matchingRevision) return "duplicate" as const;
        const [document] = await transaction
          .select({ sourcePeriodKey: spendingSourceDocuments.sourcePeriodKey })
          .from(spendingSourceDocuments)
          .where(
            and(
              eq(spendingSourceDocuments.sourceProducer, source.producer),
              eq(spendingSourceDocuments.sourceDocumentId, source.documentId),
            ),
          )
          .limit(1);

        if (document && document.sourcePeriodKey !== period.sourcePeriodKey) {
          throw new SpendingImportDocumentPeriodConflictError();
        }

        if (!document) {
          await transaction.insert(spendingSourceDocuments).values({
            sourceProducer: source.producer,
            sourceDocumentId: source.documentId,
            sourcePeriodKey: period.sourcePeriodKey,
          });
        }

        const [imported] = await transaction
          .insert(spendingImports)
          .values({
            sourceProducer: source.producer,
            sourceDocumentId: source.documentId,
            sourcePeriodKey: period.sourcePeriodKey,
            sourceRevision: source.revision,
            sourceContentSha256: source.contentSha256,
            sourceIssuedAt: new Date(source.issuedAt),
          })
          .returning({ id: spendingImports.id });

        const [existingPeriod] = await transaction
          .select({ id: spendingPeriods.id })
          .from(spendingPeriods)
          .where(
            and(
              eq(spendingPeriods.sourceProducer, source.producer),
              eq(spendingPeriods.sourcePeriodKey, period.sourcePeriodKey),
            ),
          )
          .limit(1);
        const replacementStatus = existingPeriod ? "replaced" : "imported";
        if (existingPeriod) {
          await transaction
            .delete(spendingPeriods)
            .where(eq(spendingPeriods.id, existingPeriod.id));
        }

        const [snapshot] = await transaction
          .insert(spendingPeriods)
          .values({
            importId: imported.id,
            sourceProducer: source.producer,
            sourcePeriodKey: period.sourcePeriodKey,
            startDate: period.startDate,
            endDate: period.endDate,
            currency: period.currency,
            total: period.total,
          })
          .returning({ id: spendingPeriods.id });

        if (!categories.length) return replacementStatus;

        await transaction
          .insert(spendingCategories)
          .values(
            categories.map((category) => ({
              sourceProducer: source.producer,
              sourceCategoryKey: category.sourceCategoryKey,
            })),
          )
          .onConflictDoNothing();

        const categoryRows = await transaction
          .select({ id: spendingCategories.id, sourceCategoryKey: spendingCategories.sourceCategoryKey })
          .from(spendingCategories)
          .where(
            and(
              eq(spendingCategories.sourceProducer, source.producer),
              inArray(
                spendingCategories.sourceCategoryKey,
                categories.map((category) => category.sourceCategoryKey),
              ),
            ),
          );
        const categoryIds = new Map(
          categoryRows.map((category) => [category.sourceCategoryKey, category.id]),
        );

        const periodCategories = await transaction
          .insert(spendingPeriodCategories)
          .values(
            categories.map((category) => ({
              periodId: snapshot.id,
              categoryId: categoryIds.get(category.sourceCategoryKey)!,
              sourceProducer: source.producer,
              sourceCategoryName: category.name,
              total: category.total,
              transactionsProvided: category.transactions !== undefined,
            })),
          )
          .returning({ id: spendingPeriodCategories.id, categoryId: spendingPeriodCategories.categoryId });
        const periodCategoryIds = new Map(
          periodCategories.map((category) => [category.categoryId, category.id]),
        );

        const transactions = categories.flatMap((category) => {
          const categoryId = categoryIds.get(category.sourceCategoryKey)!;
          const periodCategoryId = periodCategoryIds.get(categoryId)!;
          return (category.transactions ?? []).map((item) => ({
            periodId: snapshot.id,
            periodCategoryId,
            sourceTransactionKey: item.sourceTransactionKey,
            sourceTransactionDate: item.date,
            description: item.description,
            amount: item.amount,
          }));
        });
        if (transactions.length) {
          await transaction.insert(spendingTransactions).values(transactions);
        }
        return replacementStatus;
      });
    },
  };
}
