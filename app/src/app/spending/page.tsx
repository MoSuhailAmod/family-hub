"use client";

import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  calculateSpendingShare,
  compareDecimalStrings,
  filterSpendingTransactions,
  loadSpendingCategoryTransactions,
  loadSpendingDashboard,
  loadSpendingHistory,
  sortSpendingTransactions,
  type SpendingCategory,
  type SpendingHistoryEntry,
  type SpendingPeriod,
  type SpendingTransaction,
  type SpendingTransactionSort,
} from "@/lib/spending-client";

function periodId(period: SpendingPeriod) {
  return `${period.sourceProducer}\u0000${period.sourcePeriodKey}`;
}

function formatDate(value: string) {
  const date = value.length <= 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function periodLabel(period: SpendingPeriod) {
  return `${formatDate(period.startDate)} – ${formatDate(period.endDate)}`;
}

function periodMonthLabel(period: SpendingPeriod) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
    new Date(`${period.startDate.slice(0, 10)}T12:00:00`),
  );
}

function amount(currency: string, total: string) {
  const value = Number(total);

  const formatted = new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return currency === "ZAR" ? `R ${formatted}` : `${currency} ${formatted}`;
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

export default function SpendingPage() {
  const [periods, setPeriods] = useState<SpendingPeriod[]>([]);
  const [period, setPeriod] = useState<SpendingPeriod | null>(null);
  const [categories, setCategories] = useState<SpendingCategory[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<SpendingTransaction[]>([]);
  const [history, setHistory] = useState<SpendingHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoadFailed, setHistoryLoadFailed] = useState(false);
  const [selectedHistoryCategory, setSelectedHistoryCategory] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SpendingCategory | null>(null);
  const [activeChartCategoryKey, setActiveChartCategoryKey] = useState<string | null>(null);
  const [pinnedChartCategoryKey, setPinnedChartCategoryKey] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<SpendingTransaction[]>([]);
  const [transactionSort, setTransactionSort] = useState<SpendingTransactionSort>("date");
  const [transactionQuery, setTransactionQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [detailLoadFailed, setDetailLoadFailed] = useState(false);
  const detailRequestId = useRef(0);
  const overviewRequestId = useRef(0);
  const historyRequestId = useRef(0);
  const categoryChartRef = useRef<HTMLDivElement>(null);

  async function load(selectedPeriod?: SpendingPeriod) {
    const requestId = overviewRequestId.current + 1;
    overviewRequestId.current = requestId;
    detailRequestId.current += 1;
    setLoading(true);
    setSelectedCategory(null);
    setActiveChartCategoryKey(null);
    setPinnedChartCategoryKey(null);
    try {
      const dashboard = await loadSpendingDashboard(fetch, selectedPeriod);
      if (overviewRequestId.current !== requestId) return;
      setPeriods(dashboard.periods);
      setPeriod(dashboard.period);
      setCategories(dashboard.categories);
      setRecentTransactions(dashboard.recentTransactions);
      setLoadFailed(false);
    } catch (error) {
      console.error(error);
      if (overviewRequestId.current === requestId) setLoadFailed(true);
    } finally {
      if (overviewRequestId.current === requestId) setLoading(false);
    }
  }

  async function loadHistory() {
    const requestId = historyRequestId.current + 1;
    historyRequestId.current = requestId;
    setHistoryLoading(true);
    try {
      const nextHistory = await loadSpendingHistory(fetch, "raw");
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


  async function openCategory(category: SpendingCategory) {
    if (!period) return;

    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;
    setSelectedCategory(category);
    setTransactions([]);
    setTransactionSort("date");
    setTransactionQuery("");
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
      void loadHistory();
    });
  }, []);

  useEffect(() => {
    function dismissChartDetail(event: PointerEvent) {
      if (categoryChartRef.current && !categoryChartRef.current.contains(event.target as Node)) {
        setPinnedChartCategoryKey(null);
      }
    }

    document.addEventListener("pointerdown", dismissChartDetail);
    return () => document.removeEventListener("pointerdown", dismissChartDetail);
  }, []);

  const selectedHistory = period
    ? history.find((entry) => periodId(entry.period) === periodId(period))
    : undefined;
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
  const chartHistory = period
    ? history
      .filter((entry) =>
        entry.period.status !== "partial" &&
        entry.period.sourceProducer === period.sourceProducer &&
        entry.period.currency === period.currency,
      )
      .slice(0, 6)
      .reverse()
    : [];
  const maxChartTotal = Math.max(0, ...chartHistory.map((entry) => Number(entry.period.total)));
  const sortedCategories = [...categories].sort((left, right) => compareDecimalStrings(right.total, left.total));
  const topCategories = sortedCategories.slice(0, 5);
  const categoryShare = (category: SpendingCategory) => calculateSpendingShare(category.total, period?.total ?? "0");
  const categoryShareLabel = (category: SpendingCategory) => {
    const share = categoryShare(category);
    return share === null ? "—" : `${share}%`;
  };
  const categoryRingSegments = sortedCategories.reduce(
    ({ segments, offset }, category, index) => {
      const share = categoryShare(category);
      if (share === null || compareDecimalStrings(share, "0") <= 0 || offset >= 100) return { segments, offset };
      const boundedShare = compareDecimalStrings(share, "100") > 0 ? 100 : Number(share);
      const nextOffset = Math.min(100, offset + boundedShare);
      return {
        segments: [...segments, { category, index, offset, share: nextOffset - offset }],
        offset: nextOffset,
      };
    },
    { segments: [] as { category: SpendingCategory; index: number; offset: number; share: number }[], offset: 0 },
  );
  const displayedChartCategoryKey = pinnedChartCategoryKey ?? activeChartCategoryKey;
  const displayedChartCategory = displayedChartCategoryKey
    ? sortedCategories.find((category) => category.sourceCategoryKey === displayedChartCategoryKey)
    : undefined;
  const selectedPeriodIndex = period ? periods.findIndex((candidate) => periodId(candidate) === periodId(period)) : -1;
  const previousNavigationPeriod = selectedPeriodIndex >= 0 ? periods[selectedPeriodIndex + 1] : undefined;
  const nextNavigationPeriod = selectedPeriodIndex > 0 ? periods[selectedPeriodIndex - 1] : undefined;

  return (
    <div className="page spending-page">
      <header className="spending-header">
        <div>
          <p className="eyebrow">Household finances</p>
          <h1>Spending</h1>
          <p className="page-subtitle">Track and understand your household spending.</p>
        </div>

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
            <p>Try loading the latest period again.</p>
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
            <p>Your household spending will appear here after it has been synced.</p>
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
              <div className="spending-transaction-controls">
                <label>
                  <span>Search description</span>
                  <input type="search" value={transactionQuery} onChange={(event) => setTransactionQuery(event.target.value)} placeholder="Search imported lines" />
                </label>
                <label>
                  <span>Sort by</span>
                  <select aria-label="Sort category transactions" value={transactionSort} onChange={(event) => setTransactionSort(event.target.value as SpendingTransactionSort)}>
                    <option value="date">Transaction date (oldest first)</option>
                    <option value="date-desc">Transaction date (newest first)</option>
                    <option value="amount-desc">Amount (highest first)</option>
                    <option value="amount">Amount (lowest first)</option>
                  </select>
                </label>
              </div>
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
                    {sortSpendingTransactions(filterSpendingTransactions(transactions, transactionQuery, "all"), transactionSort).map((transaction) => (
                      <tr key={transaction.sourceTransactionKey}>
                        <td>{transaction.date ? formatDate(transaction.date) : "—"}</td>
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
          <section className="spending-period-hero" aria-labelledby="spending-total-heading">
            <div className="spending-period-hero-topline">
              <div className="spending-period-heading">
                <span className="spending-period-icon" aria-hidden="true"><CalendarDays size={18} /></span>
                <div>
                  <p className="section-label">Spending period</p>
                  <p className="spending-period-label">{periodMonthLabel(period)}</p>
                </div>
              </div>
              <span className={`spending-status-pill ${period.status === "partial" ? "is-partial" : "is-completed"}`}>
                {period.status === "partial" ? <Clock3 size={14} /> : <CircleCheck size={14} />}
                {period.status === "partial" ? "Partial" : "Completed"}
              </span>
            </div>
            <div className="spending-period-total">
              <p>Total household spend</p>
              <h2 id="spending-total-heading">{amount(period.currency, period.total)}</h2>
            </div>
            <div className="spending-period-hero-footer">
              <div>
                <p className="spending-period-dates">{periodLabel(period)}</p>
                {period.importedAt && <p className="spending-freshness">Last synced {formatDate(period.importedAt)}</p>}
              </div>
              <div className="spending-period-controls" aria-label="Spending period navigation">
                <button type="button" aria-label="Previous spending period" title="Previous spending period" disabled={!previousNavigationPeriod || loading} onClick={() => previousNavigationPeriod && void load(previousNavigationPeriod)}>
                  <ChevronLeft size={18} />
                </button>
                {periods.length > 0 && (
                  <label className="spending-period-picker">
                    <span className="sr-only">Spending period</span>
                    <select aria-label="Select spending period" value={periodId(period)} disabled={loading} onChange={(event) => {
                      const selected = periods.find((candidate) => periodId(candidate) === event.target.value);
                      if (selected) void load(selected);
                    }}>
                      {periods.map((item) => <option key={periodId(item)} value={periodId(item)}>{periodMonthLabel(item)}</option>)}
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                  </label>
                )}
                <button type="button" aria-label="Next spending period" title="Next spending period" disabled={!nextNavigationPeriod || loading} onClick={() => nextNavigationPeriod && void load(nextNavigationPeriod)}>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </section>

          <section className="spending-categories" aria-labelledby="spending-categories-heading">
            <div className="spending-section-heading">
              <div>
                <p className="section-label">Breakdown</p>
                <h2 id="spending-categories-heading">Spending by category</h2>
              </div>
              <span>{categories.length} {categories.length === 1 ? "category" : "categories"}</span>
            </div>
            {categories.length === 0 ? (
              <p className="spending-no-categories">No category totals were provided for this period.</p>
            ) : (
              <div className="spending-category-breakdown" ref={categoryChartRef}>
                <div className="spending-category-ring-wrap">
                  <svg
                    className="spending-category-ring"
                    viewBox="0 0 100 100"
                    role="group"
                    aria-label="Spending by category"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setPinnedChartCategoryKey(null);
                    }}
                  >
                    <circle className="spending-category-ring-track" cx="50" cy="50" r="40" pathLength="100" />
                    {categoryRingSegments.segments.map(({ category, index, offset, share }) => {
                      const isActive = category.sourceCategoryKey === displayedChartCategoryKey;
                      return (
                        <circle
                          key={category.sourceCategoryKey}
                          className={`spending-category-ring-segment${isActive ? " is-active" : ""}`}
                          cx="50"
                          cy="50"
                          r="40"
                          pathLength="100"
                          role="button"
                          tabIndex={0}
                          aria-pressed={pinnedChartCategoryKey === category.sourceCategoryKey}
                          aria-label={`${category.name}: ${amount(period.currency, category.total)}, ${categoryShareLabel(category)} of total spend`}
                          stroke={`var(--spending-category-color-${index % 8})`}
                          strokeDasharray={`${share} ${100 - share}`}
                          strokeDashoffset={-offset}
                          onMouseEnter={() => setActiveChartCategoryKey(category.sourceCategoryKey)}
                          onMouseLeave={() => setActiveChartCategoryKey(null)}
                          onFocus={() => setActiveChartCategoryKey(category.sourceCategoryKey)}
                          onBlur={() => setActiveChartCategoryKey(null)}
                          onClick={() => {
                            if (pinnedChartCategoryKey === category.sourceCategoryKey) {
                                setPinnedChartCategoryKey(null);
                                setActiveChartCategoryKey(null);
                            } else {
                              setPinnedChartCategoryKey(category.sourceCategoryKey);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();

                              if (pinnedChartCategoryKey === category.sourceCategoryKey) {
                                setPinnedChartCategoryKey(null);
                                setActiveChartCategoryKey(null);
                              } else {
                                setPinnedChartCategoryKey(category.sourceCategoryKey);
                              }
                            }
                          }}
                        />
                      );
                    })}
                  </svg>
                  <div className="spending-category-ring-center">
                    {displayedChartCategory ? (
                      <>
                        <span>{displayedChartCategory.name}</span>
                        <strong>{amount(period.currency, displayedChartCategory.total)}</strong>
                        <small>{categoryShareLabel(displayedChartCategory)} of total</small>
                      </>
                    ) : (
                      <>
                        <span>Total spend</span>
                        <strong>{amount(period.currency, period.total)}</strong>
                      </>
                    )}
                  </div>
                </div>
                <ul className="spending-category-legend">
                  {sortedCategories.map((category, index) => (
                    <li key={category.sourceCategoryKey} className={category.sourceCategoryKey === displayedChartCategoryKey ? "is-chart-active" : undefined}>
                      <button type="button" onClick={() => void openCategory(category)}>
                        <i aria-hidden="true" style={{ background: `var(--spending-category-color-${index % 8})` }} />
                        <span>{category.name}</span>
                        <strong>{amount(period.currency, category.total)}</strong>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="spending-dashboard-lower-row" aria-label="Top categories and recent activity">
            <section className="spending-top-categories" aria-labelledby="spending-top-categories-heading">
              <div className="spending-section-heading">
                <div>
                  <p className="section-label">Largest shares</p>
                  <h2 id="spending-top-categories-heading">Top categories</h2>
                </div>
              </div>
              {topCategories.length === 0 ? (
                <p className="spending-no-categories">No category totals were provided for this period.</p>
              ) : (
                <ol>
                  {topCategories.map((category) => (
                    <li key={category.sourceCategoryKey}>
                      <button type="button" onClick={() => void openCategory(category)}>
                        <span>{category.name}</span>
                        <strong>{amount(period.currency, category.total)}</strong>
                        <small>{categoryShareLabel(category)} of total spend</small>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="spending-recent" aria-labelledby="spending-recent-heading">
              <div className="spending-section-heading"><div><p className="section-label">Recent activity</p><h2 id="spending-recent-heading">Recent transactions</h2></div></div>
              {recentTransactions.length === 0 ? <p className="spending-no-categories">No dated transactions were provided for this period.</p> : (
                <ul>{recentTransactions.map((transaction) => <li key={transaction.sourceTransactionKey}>
                  <span className={`spending-recent-transaction-icon is-${transaction.lineType ?? "transaction"}`} aria-hidden="true"><ReceiptText size={16} /></span>
                  <span className="spending-recent-transaction-content"><strong>{transaction.description}</strong><small>{transaction.date ? formatDate(transaction.date) : "Undated imported line"}</small></span>
                  <strong>{amount(period.currency, transaction.amount)}</strong>
                </li>)}</ul>
              )}
            </section>
          </section>

          <section className="spending-history" aria-labelledby="spending-history-heading">
              <div className="spending-section-heading">
                <div>
                  <p className="section-label">History</p>
                  <h2 id="spending-history-heading">Spending history</h2>
                </div>
              </div>
              {historyLoading ? (
                <p className="spending-history-state" aria-live="polite">Loading spending history…</p>
              ) : historyLoadFailed ? (
                <div className="spending-history-state" role="alert">
                  <strong>Historical spending is unavailable</strong>
                  <button type="button" className="secondary-button" onClick={() => void loadHistory()}>
                    <RotateCcw size={16} /> Try again
                  </button>
                </div>
              ) : chartHistory.length < 2 ? (
                <p className="spending-history-state">More completed periods will appear here as they become available.</p>
              ) : (
                <div className="spending-history-chart" role="list" aria-label="Total spending by period">
                  {chartHistory.map((entry) => {
                    const selected = periodId(entry.period) === periodId(period);
                    const height = maxChartTotal > 0 ? Math.max(12, (Number(entry.period.total) / maxChartTotal) * 100) : 12;
                    return (
                      <div className="spending-history-chart-item" key={periodId(entry.period)} role="listitem">
                        <span className="sr-only">{`${periodMonthLabel(entry.period)}: ${amount(entry.period.currency, entry.period.total)}`}</span>
                        <span
                          aria-hidden="true"
                          className={`spending-history-bar${selected ? " is-selected" : ""}`}
                          style={{ height: `${height}%` }}
                        />
                        <span className="spending-history-month" aria-hidden="true">{new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(`${entry.period.startDate.slice(0, 10)}T12:00:00`))}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <details className="spending-history-details">
                <summary>View detailed history</summary>
                <div className="spending-history-details-content">
                  <div className="spending-history-period-list">
                    <h3>Period totals</h3>
                    <ul>
                      {history.filter((entry) => entry.period.sourceProducer === period.sourceProducer && entry.period.currency === period.currency).map((entry) => (
                        <li key={periodId(entry.period)} className={periodId(entry.period) === periodId(period) ? "is-selected" : undefined}>
                          <span>{periodLabel(entry.period)}{entry.period.status === "partial" && <em className="spending-partial-flag">Partial</em>}</span><strong>{amount(entry.period.currency, entry.period.total)}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {selectedHistory && <div className="spending-history-categories"><h3>Source category totals</h3><p>{periodLabel(selectedHistory.period)}</p><ul className="spending-history-category-list">{selectedHistory.categories.map((category) => <li key={categoryId(category, selectedHistory.period.sourceProducer)}><span>{category.name}</span><strong>{amount(selectedHistory.period.currency, category.total)}</strong></li>)}</ul></div>}
                  {availableHistoryCategories.length > 0 && <div className="spending-category-trend"><div className="spending-category-trend-heading"><h3>Category trend</h3><select aria-label="Select category trend" value={selectedHistoryCategory} onChange={(event) => setSelectedHistoryCategory(event.target.value)}>{availableHistoryCategories.map(([id, category]) => <option key={id} value={id}>{category.name}</option>)}</select></div><ul>{categoryTrend.map(({ period: trendPeriod, category }) => <li key={periodId(trendPeriod)}><span>{periodLabel(trendPeriod)}</span><strong>{amount(trendPeriod.currency, category.total)}</strong></li>)}</ul></div>}
                </div>
              </details>
            </section>
        </>
      )}
    </div>
  );
}
