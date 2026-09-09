"use client";

import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  loadSpendingCategoryTransactions,
  loadSpendingOverview,
  sortSpendingTransactions,
  type SpendingCategory,
  type SpendingPeriod,
  type SpendingTransaction,
  type SpendingTransactionSort,
} from "@/lib/spending-client";

function periodId(period: SpendingPeriod) {
  return `${period.sourceProducer}\u0000${period.sourcePeriodKey}`;
}

function periodLabel(period: SpendingPeriod) {
  return `${period.startDate} – ${period.endDate}`;
}

function amount(currency: string, total: string) {
  return `${currency} ${total}`;
}

export default function SpendingPage() {
  const [periods, setPeriods] = useState<SpendingPeriod[]>([]);
  const [period, setPeriod] = useState<SpendingPeriod | null>(null);
  const [categories, setCategories] = useState<SpendingCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<SpendingCategory | null>(null);
  const [transactions, setTransactions] = useState<SpendingTransaction[]>([]);
  const [transactionSort, setTransactionSort] = useState<SpendingTransactionSort>("date");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [detailLoadFailed, setDetailLoadFailed] = useState(false);
  const detailRequestId = useRef(0);

  async function load(selectedPeriod?: SpendingPeriod) {
    detailRequestId.current += 1;
    setLoading(true);
    setSelectedCategory(null);
    try {
      const overview = await loadSpendingOverview(fetch, selectedPeriod);
      setPeriods(overview.periods);
      setPeriod(overview.period);
      setCategories(overview.categories);
      setLoadFailed(false);
    } catch (error) {
      console.error(error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  async function openCategory(category: SpendingCategory) {
    if (!period) return;

    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;
    setSelectedCategory(category);
    setTransactions([]);
    setTransactionSort("date");
    setDetailLoading(true);
    setDetailLoadFailed(false);
    try {
      const loadedTransactions = await loadSpendingCategoryTransactions(fetch, period, category);
      if (detailRequestId.current === requestId) setTransactions(loadedTransactions);
    } catch (error) {
      console.error(error);
      if (detailRequestId.current === requestId) setDetailLoadFailed(true);
    } finally {
      if (detailRequestId.current === requestId) setDetailLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, []);

  return (
    <div className="page spending-page">
      <header className="spending-header">
        <div>
          <p className="eyebrow">Household finances</p>
          <h1>Spending</h1>
          <p className="page-subtitle">Review imported monthly spending at a glance.</p>
        </div>
        {periods.length > 0 && (
          <label className="spending-period-select">
            <span>Period</span>
            <div>
              <select
                aria-label="Select spending period"
                value={period ? periodId(period) : ""}
                disabled={loading}
                onChange={(event) => {
                  const selected = periods.find((candidate) => periodId(candidate) === event.target.value);
                  if (selected) void load(selected);
                }}
              >
                {periods.map((item) => (
                  <option key={periodId(item)} value={periodId(item)}>
                    {periodLabel(item)}
                  </option>
                ))}
              </select>
              <ChevronDown size={17} aria-hidden="true" />
            </div>
          </label>
        )}
      </header>

      {loading ? (
        <section className="spending-loading" aria-live="polite">
          <p className="skeleton-line">Loading spending overview…</p>
        </section>
      ) : loadFailed ? (
        <section className="spending-empty" role="alert">
          <AlertCircle size={24} />
          <div>
            <strong>Spending overview unavailable</strong>
            <p>Try loading the latest imported period again.</p>
            <button type="button" className="secondary-button" onClick={() => void load()}>
              <RotateCcw size={16} /> Try again
            </button>
          </div>
        </section>
      ) : !period ? (
        <section className="spending-empty">
          <WalletCards size={24} />
          <div>
            <strong>No spending data yet</strong>
            <p>Import a spending snapshot to see your household overview here.</p>
          </div>
        </section>
      ) : selectedCategory ? (
        <section className="spending-category-detail" aria-labelledby="spending-category-detail-heading">
          <button
            type="button"
            className="spending-back-button"
            onClick={() => {
              detailRequestId.current += 1;
              setSelectedCategory(null);
            }}
          >
            <ArrowLeft size={16} /> Back to {periodLabel(period)}
          </button>
          <div className="spending-category-detail-heading">
            <div>
              <p className="section-label">Category</p>
              <h2 id="spending-category-detail-heading">{selectedCategory.name}</h2>
              <p>{periodLabel(period)}</p>
            </div>
            <strong>{amount(period.currency, selectedCategory.total)}</strong>
          </div>

          {detailLoading ? (
            <div className="spending-detail-state" aria-live="polite">Loading transactions…</div>
          ) : detailLoadFailed ? (
            <div className="spending-detail-state" role="alert">
              <strong>Transaction details unavailable</strong>
              <button type="button" className="secondary-button" onClick={() => void openCategory(selectedCategory)}>
                <RotateCcw size={16} /> Try again
              </button>
            </div>
          ) : selectedCategory.transactionsProvided === false ? (
            <div className="spending-detail-state">
              Transaction detail was not included in this imported category summary.
            </div>
          ) : transactions.length === 0 ? (
            <div className="spending-detail-state">No imported transactions were provided for this category.</div>
          ) : (
            <>
              <label className="spending-transaction-sort">
                <span>Sort by</span>
                <select
                  aria-label="Sort category transactions"
                  value={transactionSort}
                  onChange={(event) => setTransactionSort(event.target.value as SpendingTransactionSort)}
                >
                  <option value="date">Transaction date (oldest first)</option>
                  <option value="date-desc">Transaction date (newest first)</option>
                  <option value="amount-desc">Amount (highest first)</option>
                  <option value="amount">Amount (lowest first)</option>
                </select>
              </label>
              <div className="spending-transactions-table-wrap">
                <table className="spending-transactions-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Description</th>
                      <th scope="col">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortSpendingTransactions(transactions, transactionSort).map((transaction) => (
                      <tr key={transaction.sourceTransactionKey}>
                        <td>{transaction.date}</td>
                        <td>{transaction.description}</td>
                        <td>{amount(period.currency, transaction.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : (
        <>
          <section className="spending-summary-card" aria-labelledby="spending-total-heading">
            <div>
              <p className="section-label">Total spending</p>
              <h2 id="spending-total-heading">{amount(period.currency, period.total)}</h2>
              <p className="spending-period-dates">{periodLabel(period)}</p>
            </div>
            <div className="spending-summary-icon" aria-hidden="true">
              <ReceiptText size={25} />
            </div>
          </section>

          <section className="spending-categories" aria-labelledby="spending-categories-heading">
            <div className="spending-section-heading">
              <div>
                <p className="section-label">Breakdown</p>
                <h2 id="spending-categories-heading">Categories</h2>
              </div>
              <span>{categories.length} {categories.length === 1 ? "category" : "categories"}</span>
            </div>
            {categories.length === 0 ? (
              <p className="spending-no-categories">No category totals were provided for this period.</p>
            ) : (
              <ul className="spending-category-grid">
                {categories.map((category) => (
                  <li key={category.sourceCategoryKey}>
                    <button
                      type="button"
                      className="spending-category-card"
                      onClick={() => void openCategory(category)}
                    >
                      <span>{category.name}</span>
                      <strong>{amount(period.currency, category.total)}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
