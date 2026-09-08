import { pool } from "@/lib/db";

import type {
  SpendingCategory,
  SpendingImportMetadata,
  SpendingPeriod,
  SpendingRepository,
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
};

type CategoryRow = {
  source_producer: string;
  source_period_key: string;
  source_category_key: string;
  name: string;
  total: string;
  transactions_provided: boolean;
};

type TransactionRow = {
  source_producer: string;
  source_period_key: string;
  source_category_key: string;
  source_transaction_key: string;
  date: string;
  description: string;
  amount: string;
};

type ImportRow = PeriodRow & { source_content_sha256: string };

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

function mapTransaction(row: TransactionRow): SpendingTransaction {
  return {
    sourceProducer: row.source_producer,
    sourcePeriodKey: row.source_period_key,
    sourceCategoryKey: row.source_category_key,
    sourceTransactionKey: row.source_transaction_key,
    date: row.date,
    description: row.description,
    amount: row.amount,
  };
}

const periodFields = `
  p.source_producer, p.source_period_key, p.start_date, p.end_date, p.currency, p.total,
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
       WHERE $1::text IS NULL OR p.source_producer = $1
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

  async listTransactions(sourceProducer, sourcePeriodKey, sourceCategoryKey) {
    const result = await pool.query<TransactionRow>(
      `SELECT p.source_producer, p.source_period_key, c.source_category_key,
              t.source_transaction_key, t.source_transaction_date AS date, t.description, t.amount
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
};
