"use client";

import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ReceiptText,
  RotateCcw,
  Upload,
  WalletCards,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  calculatePeriodComparison,
  loadSpendingCategoryTransactions,
  loadSpendingHistory,
  loadSpendingOverview,
  sortSpendingTransactions,
  type SpendingCategory,
  type SpendingHistoryEntry,
  type SpendingHistoryView,
  type SpendingPeriod,
  type SpendingTransaction,
  type SpendingTransactionSort,
} from "@/lib/spending-client";
import {
  parseSpendingUploadDocument,
  submitSpendingUpload,
  summarizeSpendingUpload,
  type SpendingUploadSummary,
} from "@/lib/spending-upload";

function periodId(period: SpendingPeriod) {
  return `${period.sourceProducer}\u0000${period.sourcePeriodKey}`;
}

function periodLabel(period: SpendingPeriod) {
  return `${period.startDate} – ${period.endDate}`;
}

function amount(currency: string, total: string) {
  return `${currency} ${total}`;
}

function categoryId(
  category: SpendingHistoryEntry["categories"][number],
  sourceProducer: string,
) {
  const categoryKey = "reportingGroupId" in category && category.reportingGroupId
    ? `group:${category.reportingGroupId}`
    : "sourceCategoryKey" in category
      ? `source:${category.sourceCategoryKey}`
      : `sources:${[...category.sourceCategoryKeys].sort().join("\u0000")}`;
  return `${sourceProducer}\u0000${categoryKey}`;
}

function previousComparablePeriod(history: SpendingHistoryEntry[], selected: SpendingPeriod) {
  const selectedIndex = history.findIndex((entry) => periodId(entry.period) === periodId(selected));
  if (selectedIndex < 0) return null;
  return history.slice(selectedIndex + 1).find((entry) =>
    entry.period.sourceProducer === selected.sourceProducer && entry.period.currency === selected.currency,
  )?.period ?? null;
}

function signedAmount(currency: string, value: string) {
  return `${value.startsWith("-") ? "−" : "+"}${amount(currency, value.replace(/^-/, ""))}`;
}

export default function SpendingPage() {
  const [periods, setPeriods] = useState<SpendingPeriod[]>([]);
  const [period, setPeriod] = useState<SpendingPeriod | null>(null);
  const [categories, setCategories] = useState<SpendingCategory[]>([]);
  const [history, setHistory] = useState<SpendingHistoryEntry[]>([]);
  const [historyView, setHistoryView] = useState<SpendingHistoryView>("raw");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoadFailed, setHistoryLoadFailed] = useState(false);
  const [selectedHistoryCategory, setSelectedHistoryCategory] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SpendingCategory | null>(null);
  const [transactions, setTransactions] = useState<SpendingTransaction[]>([]);
  const [transactionSort, setTransactionSort] = useState<SpendingTransactionSort>("date");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [detailLoadFailed, setDetailLoadFailed] = useState(false);
  const detailRequestId = useRef(0);
  const overviewRequestId = useRef(0);
  const historyRequestId = useRef(0);
  const uploadRequestId = useRef(0);
  const [uploadSummary, setUploadSummary] = useState<SpendingUploadSummary | null>(null);
  const [uploadDocument, setUploadDocument] = useState<ReturnType<typeof parseSpendingUploadDocument> | null>(null);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replacementConfirmed, setReplacementConfirmed] = useState(false);

  async function load(selectedPeriod?: SpendingPeriod) {
    const requestId = overviewRequestId.current + 1;
    overviewRequestId.current = requestId;
    detailRequestId.current += 1;
    setLoading(true);
    setSelectedCategory(null);
    try {
      const overview = await loadSpendingOverview(fetch, selectedPeriod);
      if (overviewRequestId.current !== requestId) return;
      setPeriods(overview.periods);
      setPeriod(overview.period);
      setCategories(overview.categories);
      setLoadFailed(false);
    } catch (error) {
      console.error(error);
      if (overviewRequestId.current === requestId) setLoadFailed(true);
    } finally {
      if (overviewRequestId.current === requestId) setLoading(false);
    }
  }

  async function loadHistory(view: SpendingHistoryView) {
    const requestId = historyRequestId.current + 1;
    historyRequestId.current = requestId;
    setHistoryLoading(true);
    try {
      const nextHistory = await loadSpendingHistory(fetch, view);
      if (historyRequestId.current !== requestId) return;
      setHistory(nextHistory);
      setSelectedHistoryCategory((selected) =>
        nextHistory.some((entry) => entry.categories.some((category) =>
          categoryId(category, entry.period.sourceProducer) === selected,
        ))
          ? selected
          : (nextHistory[0]?.categories[0]
            ? categoryId(nextHistory[0].categories[0], nextHistory[0].period.sourceProducer)
            : ""),
      );
      setHistoryLoadFailed(false);
    } catch (error) {
      console.error(error);
      if (historyRequestId.current === requestId) setHistoryLoadFailed(true);
    } finally {
      if (historyRequestId.current === requestId) setHistoryLoading(false);
    }
  }

  async function inspectUpload(file: File) {
    const requestId = uploadRequestId.current + 1;
    uploadRequestId.current = requestId;
    setUploadFileName(file.name);
    setUploadError("");
    setUploadMessage("");
    setUploadSummary(null);
    setUploadDocument(null);
    setReplacementConfirmed(false);
    try {
      const document = parseSpendingUploadDocument(await file.text());
      if (uploadRequestId.current !== requestId) return;
      const response = await fetch(
        `/api/spending/imports?sourceProducer=${encodeURIComponent(document.source.producer)}`,
      );
      if (!response.ok) throw new Error("Unable to check existing Spending periods");
      const { imports = [] } = await response.json() as {
        imports?: Array<{ sourceProducer: string; sourcePeriodKey: string }>;
      };
      if (uploadRequestId.current !== requestId) return;
      setUploadDocument(document);
      setUploadSummary(summarizeSpendingUpload(document, imports));
    } catch (error) {
      if (uploadRequestId.current === requestId) {
        setUploadError(error instanceof Error ? error.message : "Unable to read the Spending document");
      }
    }
  }

  async function importUpload() {
    if (!uploadDocument || !uploadSummary) return;
    if (uploadSummary.replacesExistingPeriod && !replacementConfirmed) {
      setUploadError("Confirm the replacement before importing this existing period.");
      return;
    }
    setUploading(true);
    setUploadError("");
    setUploadMessage("");
    try {
      const result = await submitSpendingUpload(fetch, uploadDocument);
      if (!result.success) {
        setUploadError(result.error);
        return;
      }
      setUploadMessage(
        result.status === "replaced"
          ? "The existing Spending period was safely replaced."
          : result.status === "duplicate"
            ? "This Spending document was already imported; no duplicate period was created."
            : "Spending document imported successfully.",
      );
      await Promise.all([load(), loadHistory(historyView)]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Unable to import Spending document");
    } finally {
      setUploading(false);
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
    void Promise.resolve().then(() => {
      void load();
      void loadHistory("raw");
    });
  }, []);

  const selectedHistory = period
    ? history.find((entry) => periodId(entry.period) === periodId(period))
    : undefined;
  const previousPeriod = period ? previousComparablePeriod(history, period) : null;
  const comparison = period ? calculatePeriodComparison(period, previousPeriod) : null;
  const availableHistoryCategories = Array.from(
    new Map(
      history.flatMap((entry) => entry.categories.map((category) => [
        categoryId(category, entry.period.sourceProducer),
        category,
      ] as const)),
    ).entries(),
  );
  const categoryTrend = history
    .map((entry) => ({
      period: entry.period,
      category: entry.categories.find((candidate) =>
        categoryId(candidate, entry.period.sourceProducer) === selectedHistoryCategory,
      ),
    }))
    .filter((entry): entry is { period: SpendingPeriod; category: SpendingHistoryEntry["categories"][number] } => Boolean(entry.category));

  return (
    <div className="page spending-page">
      <section className="spending-upload" aria-labelledby="spending-upload-heading">
        <div className="spending-upload-heading">
          <div>
            <p className="section-label">Monthly import</p>
            <h2 id="spending-upload-heading">Upload Spending document</h2>
            <p>Upload the processed <code>spending-import/v1</code> JSON document for the completed period.</p>
          </div>
          <label className="secondary-button spending-upload-picker">
            <Upload size={16} /> Choose document
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void inspectUpload(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        {uploadFileName && <p className="spending-upload-file">Selected: {uploadFileName}</p>}
        {uploadError && <p className="spending-upload-feedback is-error" role="alert">{uploadError}</p>}
        {uploadMessage && <p className="spending-upload-feedback is-success" role="status">{uploadMessage}</p>}
        {uploadSummary && (
          <div className="spending-upload-preview">
            <div>
              <span>Period</span>
              <strong>{uploadSummary.startDate} – {uploadSummary.endDate}</strong>
            </div>
            <div><span>Total spend</span><strong>{amount(uploadSummary.currency, uploadSummary.total)}</strong></div>
            <div><span>Categories</span><strong>{uploadSummary.categoryCount}</strong></div>
            <div><span>Transactions</span><strong>{uploadSummary.transactionCount}</strong></div>
            {uploadSummary.replacesExistingPeriod && (
              <label className="spending-upload-replace">
                <input
                  type="checkbox"
                  checked={replacementConfirmed}
                  onChange={(event) => setReplacementConfirmed(event.currentTarget.checked)}
                />
                <span>This will replace the existing {uploadSummary.sourcePeriodKey} snapshot. I understand.</span>
              </label>
            )}
            <button
              type="button"
              className="primary-button"
              disabled={uploading || (uploadSummary.replacesExistingPeriod && !replacementConfirmed)}
              onClick={() => void importUpload()}
            >
              <Upload size={16} /> {uploading ? "Importing…" : uploadSummary.replacesExistingPeriod ? "Replace period" : "Import period"}
            </button>
          </div>
        )}
      </section>
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

          <section className="spending-history" aria-labelledby="spending-history-heading">
            <div className="spending-section-heading">
              <div>
                <p className="section-label">History</p>
                <h2 id="spending-history-heading">Trends and comparison</h2>
              </div>
              <label className="spending-history-view">
                <span className="sr-only">Historical reporting view</span>
                <select
                  aria-label="Historical reporting view"
                  value={historyView}
                  disabled={historyLoading}
                  onChange={(event) => {
                    const view = event.target.value as SpendingHistoryView;
                    setHistoryView(view);
                    void loadHistory(view);
                  }}
                >
                  <option value="raw">Source categories</option>
                  <option value="normalized">Reporting groups</option>
                </select>
              </label>
            </div>
            {historyLoading ? (
              <p className="spending-history-state" aria-live="polite">Loading imported history…</p>
            ) : historyLoadFailed ? (
              <div className="spending-history-state" role="alert">
                <strong>Historical spending is unavailable</strong>
                <button type="button" className="secondary-button" onClick={() => void loadHistory(historyView)}>
                  <RotateCcw size={16} /> Try again
                </button>
              </div>
            ) : history.length < 2 ? (
              <p className="spending-history-state">Import another completed period to compare spending over time.</p>
            ) : (
              <div className="spending-history-content">
                <div className="spending-comparison-card">
                  <p className="section-label">Compared with previous period</p>
                  {comparison && previousPeriod ? (
                    <>
                      <strong className={comparison.absoluteChange.startsWith("-") ? "spending-change-down" : "spending-change-up"}>
                        {signedAmount(period.currency, comparison.absoluteChange)}
                      </strong>
                      <p>
                        {comparison.percentageChange === null
                          ? `Previous total was zero (${periodLabel(previousPeriod)}).`
                          : `${comparison.percentageChange.startsWith("-") ? "" : "+"}${comparison.percentageChange}% from ${periodLabel(previousPeriod)}.`}
                      </p>
                    </>
                  ) : (
                    <p>No comparable earlier period is available for this source and currency.</p>
                  )}
                </div>

                <div className="spending-trend-table-wrap">
                  <table className="spending-trend-table">
                    <caption>Total spending by imported period</caption>
                    <thead><tr><th scope="col">Period</th><th scope="col">Total</th></tr></thead>
                    <tbody>{history.map((entry) => (
                      <tr key={periodId(entry.period)} className={period && periodId(entry.period) === periodId(period) ? "is-selected" : undefined}>
                        <td>{periodLabel(entry.period)}</td><td>{amount(entry.period.currency, entry.period.total)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>

                {selectedHistory && (
                  <div className="spending-history-categories">
                    <h3>{historyView === "raw" ? "Source category totals" : "Reporting group totals"}</h3>
                    <p>{periodLabel(selectedHistory.period)} — original source values remain available in Source categories.</p>
                    <ul className="spending-history-category-list">
                      {selectedHistory.categories.map((category) => (
                        <li key={categoryId(category, selectedHistory.period.sourceProducer)}><span>{category.name}</span><strong>{amount(selectedHistory.period.currency, category.total)}</strong></li>
                      ))}
                    </ul>
                  </div>
                )}

                {availableHistoryCategories.length > 0 && (
                  <div className="spending-category-trend">
                    <label>
                      <span>Category trend</span>
                      <select aria-label="Select category trend" value={selectedHistoryCategory} onChange={(event) => setSelectedHistoryCategory(event.target.value)}>
                        {availableHistoryCategories.map(([id, category]) => <option key={id} value={id}>{category.name}</option>)}
                      </select>
                    </label>
                    <ul>{categoryTrend.map(({ period: trendPeriod, category }) => (
                      <li key={periodId(trendPeriod)}><span>{periodLabel(trendPeriod)}</span><strong>{amount(trendPeriod.currency, category.total)}</strong></li>
                    ))}</ul>
                  </div>
                )}
              </div>
            )}
            <p className="spending-history-note">Every imported spending period currently represents a completed period under the import contract.</p>
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
