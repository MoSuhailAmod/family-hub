"use client";

import { AlertCircle, ChevronDown, ReceiptText, RotateCcw, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import {
  loadSpendingOverview,
  type SpendingCategory,
  type SpendingPeriod,
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
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  async function load(selectedPeriod?: SpendingPeriod) {
    setLoading(true);
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
                  <li key={category.sourceCategoryKey} className="spending-category-card">
                    <span>{category.name}</span>
                    <strong>{amount(period.currency, category.total)}</strong>
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
