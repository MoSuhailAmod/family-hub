import { pool } from "@/lib/db";

import type {
  SpendingCategory,
  SpendingImportMetadata,
  SpendingPeriod,
  SpendingReconciliationHistoryEntry,
  SpendingRepository,
  SpendingReportingCategory,
  SpendingReportingGroup,
  SpendingTransaction,
} from "./spending-service";

type PeriodRow = {
  source_producer: string;
  source_period_key: string;
  start_date: string;
  end_date: string;
  currency: string;
  total: string;
  source_document_id: string;
  source_revision: string;
  source_issued_at: Date;
  imported_at: Date;
  status: "partial" | "completed";
};

type CategoryRow = {
  source_producer: string;
  source_period_key: string;
  source_category_key: string;
  name: string;
  total: string;
  transactions_provided: boolean;
};

type ReportingCategoryRow = {
  source_producer: string;
  source_period_key: string;
  reporting_group_id: string | null;
  source_category_keys: string[];
  name: string;
  total: string;
};

type ReportingGroupRow = { id: string; name: string };

type TransactionRow = {
  source_producer: string;
  source_period_key: string;
  source_category_key: string;
  source_transaction_key: string;
  date: string | null;
  description: string;
  amount: string;
  line_type: "transaction" | "assumption" | "adjustment";
};

type ImportRow = PeriodRow & { source_content_sha256: string };
type ReconciliationHistoryRow = {
  source_producer: string;
  source_document_id: string;
  source_revision: string;
  source_issued_at: Date;
  imported_at: Date;
  imported_by: string;
  source_content_sha256: string;
  source_period_key: string;
  action: SpendingReconciliationHistoryEntry["action"];
  reconciled_at: Date;
};

function mapPeriod(row: PeriodRow): SpendingPeriod {
  return {
    sourceProducer: row.source_producer,
    sourcePeriodKey: row.source_period_key,
    startDate: row.start_date,
    endDate: row.end_date,
    currency: row.currency,
    total: row.total,
    sourceDocumentId: row.source_document_id,
    sourceRevision: row.source_revision,
    sourceIssuedAt: row.source_issued_at,
    importedAt: row.imported_at,
    status: row.status,
  };
}

function mapCategory(row: CategoryRow): SpendingCategory {
  return {
    sourceProducer: row.source_producer,
    sourcePeriodKey: row.source_period_key,
    sourceCategoryKey: row.source_category_key,
    name: row.name,
    total: row.total,
    transactionsProvided: row.transactions_provided,
  };
}

function mapReportingCategory(row: ReportingCategoryRow): SpendingReportingCategory {
  return {
    sourceProducer: row.source_producer,
    sourcePeriodKey: row.source_period_key,
    reportingGroupId: row.reporting_group_id,
    sourceCategoryKeys: row.source_category_keys,
    name: row.name,
    total: row.total,
  };
}

function mapTransaction(row: TransactionRow): SpendingTransaction {
  return {
    sourceProducer: row.source_producer,
    sourcePeriodKey: row.source_period_key,
    sourceCategoryKey: row.source_category_key,
    sourceTransactionKey: row.source_transaction_key,
    date: row.date,
    description: row.description,
    amount: row.amount,
    lineType: row.line_type,
  };
}

function mapReconciliationHistory(row: ReconciliationHistoryRow): SpendingReconciliationHistoryEntry {
  return {
    sourceProducer: row.source_producer,
    sourceDocumentId: row.source_document_id,
    sourceRevision: row.source_revision,
    sourceIssuedAt: row.source_issued_at,
    importedAt: row.imported_at,
    importedBy: row.imported_by,
    contentSha256: row.source_content_sha256,
    sourcePeriodKey: row.source_period_key,
    action: row.action,
    reconciledAt: row.reconciled_at,
  };
}

const periodFields = `
  p.source_producer, p.source_period_key, p.start_date, p.end_date, p.currency, p.total, p.status,
  i.source_document_id, i.source_revision, i.source_issued_at, i.imported_at`;
const periodJoin = `
  FROM spending_periods p
  INNER JOIN spending_imports i ON i.id = p.import_id`;

export const spendingRepository: SpendingRepository = {
  async listPeriods() {
    const result = await pool.query<PeriodRow>(
      `SELECT ${periodFields} ${periodJoin}
       ORDER BY p.end_date DESC, p.start_date DESC, p.source_producer, p.source_period_key`,
    );
    return result.rows.map(mapPeriod);
  },

  async getLatestPeriod(sourceProducer) {
    const result = await pool.query<PeriodRow>(
      `SELECT ${periodFields} ${periodJoin}
       WHERE ($1::text IS NULL OR p.source_producer = $1) AND p.status = 'completed'
       ORDER BY p.end_date DESC, p.start_date DESC, p.source_producer, p.source_period_key
       LIMIT 1`,
      [sourceProducer ?? null],
    );
    return result.rows[0] ? mapPeriod(result.rows[0]) : null;
  },

  async getPeriod(sourceProducer, sourcePeriodKey) {
    const result = await pool.query<PeriodRow>(
      `SELECT ${periodFields} ${periodJoin}
       WHERE p.source_producer = $1 AND p.source_period_key = $2`,
      [sourceProducer, sourcePeriodKey],
    );
    return result.rows[0] ? mapPeriod(result.rows[0]) : null;
  },

  async listCategories(sourceProducer, sourcePeriodKey) {
    const result = await pool.query<CategoryRow>(
      `SELECT p.source_producer, p.source_period_key, c.source_category_key,
              pc.source_category_name AS name, pc.total, pc.transactions_provided
       FROM spending_period_categories pc
       INNER JOIN spending_periods p ON p.id = pc.period_id
       INNER JOIN spending_categories c ON c.id = pc.category_id
       WHERE p.source_producer = $1 AND p.source_period_key = $2
       ORDER BY pc.source_category_name, c.source_category_key`,
      [sourceProducer, sourcePeriodKey],
    );
    return result.rows.map(mapCategory);
  },

  async listReportingCategories(sourceProducer, sourcePeriodKey) {
    const result = await pool.query<ReportingCategoryRow>(
      `SELECT p.source_producer, p.source_period_key, rg.id::text AS reporting_group_id,
              array_agg(c.source_category_key ORDER BY c.source_category_key) AS source_category_keys,
              rg.name, SUM(pc.total) AS total
       FROM spending_period_categories pc
       INNER JOIN spending_periods p ON p.id = pc.period_id
       INNER JOIN spending_categories c ON c.id = pc.category_id
       INNER JOIN spending_category_reporting_groups crg ON crg.category_id = c.id
       INNER JOIN spending_reporting_groups rg ON rg.id = crg.reporting_group_id
       WHERE p.source_producer = $1 AND p.source_period_key = $2
       GROUP BY p.source_producer, p.source_period_key, rg.id, rg.name
       UNION ALL
       SELECT p.source_producer, p.source_period_key, NULL AS reporting_group_id,
              ARRAY[c.source_category_key] AS source_category_keys,
              pc.source_category_name AS name, pc.total
       FROM spending_period_categories pc
       INNER JOIN spending_periods p ON p.id = pc.period_id
       INNER JOIN spending_categories c ON c.id = pc.category_id
       WHERE p.source_producer = $1 AND p.source_period_key = $2
         AND NOT EXISTS (
           SELECT 1 FROM spending_category_reporting_groups crg WHERE crg.category_id = c.id
         )
       ORDER BY name, reporting_group_id, source_category_keys`,
      [sourceProducer, sourcePeriodKey],
    );
    return result.rows.map(mapReportingCategory);
  },

  async createReportingGroup(name) {
    const result = await pool.query<ReportingGroupRow>(
      `INSERT INTO spending_reporting_groups (name) VALUES ($1) RETURNING id::text, name`,
      [name],
    );
    return result.rows[0] as SpendingReportingGroup;
  },

  async renameReportingGroup(id, name) {
    const result = await pool.query<ReportingGroupRow>(
      `UPDATE spending_reporting_groups SET name = $2 WHERE id = $1::uuid RETURNING id::text, name`,
      [id, name],
    );
    return (result.rows[0] as SpendingReportingGroup | undefined) ?? null;
  },

  async setCategoryReportingGroup(sourceProducer, sourceCategoryKey, reportingGroupId) {
    if (reportingGroupId === null) {
      await pool.query(
        `DELETE FROM spending_category_reporting_groups crg
         USING spending_categories c
         WHERE crg.category_id = c.id AND c.source_producer = $1 AND c.source_category_key = $2`,
        [sourceProducer, sourceCategoryKey],
      );
      return;
    }

    await pool.query(
      `WITH category AS (
         SELECT id FROM spending_categories WHERE source_producer = $1 AND source_category_key = $2
       ), removed AS (
         DELETE FROM spending_category_reporting_groups
         WHERE category_id IN (SELECT id FROM category)
       )
       INSERT INTO spending_category_reporting_groups (category_id, reporting_group_id)
       SELECT id, $3::uuid FROM category`,
      [sourceProducer, sourceCategoryKey, reportingGroupId],
    );
  },

  async listTransactions(sourceProducer, sourcePeriodKey, sourceCategoryKey) {
    const result = await pool.query<TransactionRow>(
      `SELECT p.source_producer, p.source_period_key, c.source_category_key,
              t.source_transaction_key, t.source_transaction_date AS date, t.description, t.amount, t.line_type
       FROM spending_transactions t
       INNER JOIN spending_periods p ON p.id = t.period_id
       INNER JOIN spending_period_categories pc ON pc.id = t.period_category_id
       INNER JOIN spending_categories c ON c.id = pc.category_id
       WHERE p.source_producer = $1 AND p.source_period_key = $2 AND c.source_category_key = $3
       ORDER BY t.source_transaction_date, t.source_transaction_key`,
      [sourceProducer, sourcePeriodKey, sourceCategoryKey],
    );
    return result.rows.map(mapTransaction);
  },

  async listRecentTransactions(sourceProducer, sourcePeriodKey) {
    const [countResult, transactionsResult] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM spending_transactions t
         INNER JOIN spending_periods p ON p.id = t.period_id
         WHERE p.source_producer = $1 AND p.source_period_key = $2 AND t.line_type = 'transaction'`,
        [sourceProducer, sourcePeriodKey],
      ),
      pool.query<TransactionRow>(
        `SELECT p.source_producer, p.source_period_key, c.source_category_key,
                t.source_transaction_key, t.source_transaction_date AS date, t.description, t.amount, t.line_type
         FROM spending_transactions t
         INNER JOIN spending_periods p ON p.id = t.period_id
         INNER JOIN spending_period_categories pc ON pc.id = t.period_category_id
         INNER JOIN spending_categories c ON c.id = pc.category_id
         WHERE p.source_producer = $1 AND p.source_period_key = $2 AND t.line_type = 'transaction'
         ORDER BY t.source_transaction_date DESC, t.source_transaction_key DESC
         LIMIT 5`,
        [sourceProducer, sourcePeriodKey],
      ),
    ]);
    return { transactionCount: Number(countResult.rows[0]?.count ?? 0), transactions: transactionsResult.rows.map(mapTransaction) };
  },

  async listCategoryHistory(sourceProducer, sourceCategoryKey) {
    const result = await pool.query<CategoryRow>(
      `SELECT p.source_producer, p.source_period_key, c.source_category_key,
              pc.source_category_name AS name, pc.total, pc.transactions_provided
       FROM spending_period_categories pc
       INNER JOIN spending_periods p ON p.id = pc.period_id
       INNER JOIN spending_categories c ON c.id = pc.category_id
       WHERE p.source_producer = $1 AND c.source_category_key = $2
       ORDER BY p.end_date DESC, p.start_date DESC, p.source_period_key DESC`,
      [sourceProducer, sourceCategoryKey],
    );
    return result.rows.map(mapCategory);
  },

  async listImportMetadata(sourceProducer) {
    const result = await pool.query<ImportRow>(
      `SELECT ${periodFields}, i.source_content_sha256 ${periodJoin}
       WHERE $1::text IS NULL OR p.source_producer = $1
       ORDER BY i.imported_at DESC, p.source_producer, p.source_period_key`,
      [sourceProducer ?? null],
    );
    return result.rows.map((row): SpendingImportMetadata => ({
      ...mapPeriod(row),
      contentSha256: row.source_content_sha256,
    }));
  },

  async listReconciliationHistory(sourceProducer) {
    const result = await pool.query<ReconciliationHistoryRow>(
      `SELECT log.source_producer, i.source_document_id, i.source_revision, i.source_issued_at,
              i.imported_at, i.imported_by, i.source_content_sha256, log.source_period_key,
              log.action, log.created_at AS reconciled_at
       FROM spending_reconciliation_log log
       INNER JOIN spending_imports i ON i.id = log.import_id
       WHERE $1::text IS NULL OR log.source_producer = $1
       ORDER BY log.created_at DESC, i.imported_at DESC, log.source_producer, log.source_period_key`,
      [sourceProducer ?? null],
    );
    return result.rows.map(mapReconciliationHistory);
  },
};
