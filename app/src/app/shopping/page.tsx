"use client";

import {
  Check,
  Circle,
  Pencil,
  Plus,
  RotateCcw,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { requestShoppingApi } from "@/lib/shopping-client";
import { shoppingSuccessMessage } from "@/lib/shopping-feedback";

type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  notes: string | null;
  isCompleted: boolean;
};

type Draft = {
  name: string;
  quantity: string;
  notes: string;
};

const emptyDraft: Draft = { name: "", quantity: "", notes: "" };

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    try {
      const response = await fetch("/api/shopping-items");
      if (!response.ok) throw new Error("Unable to load shopping items");
      const data = await response.json();
      setItems(data.items ?? []);
      setLoadFailed(false);
      setError(null);
    } catch (loadError) {
      console.error(loadError);
      setLoadFailed(true);
      setError("Shopping items could not be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadItems);
  }, []);

  function beginEdit(item: ShoppingItem) {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      quantity: item.quantity ?? "",
      notes: item.notes ?? "",
    });
    setError(null);
    setFieldError(null);
    setSuccess(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const itemName = draft.name.trim();
    if (!itemName) {
      setSuccess(null);
      setFieldError("Please enter an item name.");
      return;
    }

    setSaving(true);
    setFieldError(null);
    setError(null);
    setSuccess(null);
    const payload = {
      name: draft.name,
      quantity: draft.quantity,
      notes: draft.notes,
    };

    try {
      if (editingId) {
        await requestShoppingApi(fetch, editingId, {
          method: "PATCH",
          body: payload,
        });
      } else {
        const response = await fetch("/api/shopping-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? "Unable to add shopping item");
        }
      }

      const mutation = editingId ? "edit" : "add";
      cancelEdit();
      setSuccess(shoppingSuccessMessage(mutation, itemName));
      await loadItems();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Shopping item could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function setCompleted(item: ShoppingItem, completed: boolean) {
    if (pendingItemId) return;

    setPendingItemId(item.id);
    try {
      setError(null);
      setSuccess(null);
      await requestShoppingApi(fetch, item.id, {
        method: "PATCH",
        body: { completed },
      });
      setSuccess(
        shoppingSuccessMessage(completed ? "complete" : "restore", item.name),
      );
      await loadItems();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Shopping item could not be updated.",
      );
    } finally {
      setPendingItemId(null);
    }
  }

  async function remove(item: ShoppingItem) {
    if (pendingItemId || !window.confirm(`Remove “${item.name}” from the shopping list?`)) {
      return;
    }

    setPendingItemId(item.id);
    try {
      setError(null);
      setSuccess(null);
      await requestShoppingApi(fetch, item.id, { method: "DELETE" });
      if (editingId === item.id) cancelEdit();
      setSuccess(shoppingSuccessMessage("remove", item.name));
      await loadItems();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Shopping item could not be removed.",
      );
    } finally {
      setPendingItemId(null);
    }
  }

  const active = items.filter((item) => !item.isCompleted);
  const completed = items.filter((item) => item.isCompleted);

  return (
    <div className="page shopping-page">
      <header className="shopping-header">
        <div>
          <p className="eyebrow">Household essentials</p>
          <h1>Shopping list</h1>
          <p className="page-subtitle">Keep the next shop simple and shared.</p>
        </div>
      </header>

      <section className="shopping-add-card" aria-label="Add or edit shopping item">
        <form onSubmit={submit} className="shopping-form">
          <label>
            <span>Item</span>
            <input
              autoFocus={editingId === null}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Add milk, bread, apples…"
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? "shopping-name-error" : undefined}
              disabled={saving}
            />
          </label>
          <label>
            <span>Quantity <em>optional</em></span>
            <input
              value={draft.quantity}
              onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
              placeholder="e.g. 2L"
              disabled={saving}
            />
          </label>
          <label className="shopping-notes-field">
            <span>Notes <em>optional</em></span>
            <input
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              placeholder="e.g. Unsweetened"
              disabled={saving}
            />
          </label>
          <div className="shopping-form-actions">
            {editingId && (
              <button type="button" className="secondary-button" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
            )}
            <button type="submit" className="primary-button" disabled={saving}>
              <Plus size={17} />
              {saving ? "Saving…" : editingId ? "Save item" : "Add item"}
            </button>
          </div>
        </form>
      </section>

      {fieldError && <div className="error-banner" role="alert" id="shopping-name-error">{fieldError}</div>}
      {error && <div className="error-banner" role="alert">{error}</div>}
      {success && <div className="success-banner" role="status">{success}</div>}

      <section className="shopping-list-section" aria-labelledby="shopping-active-heading">
        <div className="shopping-section-heading">
          <div><p className="section-label">To buy</p><h2 id="shopping-active-heading">{active.length} active</h2></div>
          <button
            type="button"
            className="text-link"
            onClick={() => void loadItems()}
            disabled={loading || pendingItemId !== null}
          >
            <RotateCcw size={14} /> Refresh
          </button>
        </div>
        {loading ? <p className="skeleton-line">Loading your shopping list…</p> : loadFailed ? (
          <div className="shopping-empty"><div><strong>Shopping list unavailable</strong><p>Try loading the list again.</p><button type="button" className="secondary-button" onClick={() => void loadItems()}>Try again</button></div></div>
        ) : active.length === 0 ? (
          <div className="shopping-empty"><ShoppingCart size={22} /><div><strong>Nothing to buy right now</strong><p>Add something above when you think of it.</p></div></div>
        ) : <ul className="shopping-items">{active.map((item) => <ShoppingRow key={item.id} item={item} pending={pendingItemId === item.id} onComplete={() => void setCompleted(item, true)} onEdit={() => beginEdit(item)} onDelete={() => void remove(item)} />)}</ul>}
      </section>

      {!loading && !loadFailed && completed.length > 0 && (
        <section className="shopping-list-section shopping-completed-section" aria-labelledby="shopping-completed-heading">
          <div className="shopping-section-heading"><div><p className="section-label">Done</p><h2 id="shopping-completed-heading">Completed</h2></div></div>
          <ul className="shopping-items">{completed.map((item) => <ShoppingRow key={item.id} item={item} completed pending={pendingItemId === item.id} onComplete={() => void setCompleted(item, false)} onEdit={() => beginEdit(item)} onDelete={() => void remove(item)} />)}</ul>
        </section>
      )}
    </div>
  );
}

function ShoppingRow({ item, completed = false, pending = false, onComplete, onEdit, onDelete }: { item: ShoppingItem; completed?: boolean; pending?: boolean; onComplete: () => void; onEdit: () => void; onDelete: () => void }) {
  return <li className={`shopping-item ${completed ? "shopping-item-completed" : ""}`} aria-busy={pending}>
    <button type="button" className="shopping-complete-button" onClick={onComplete} disabled={pending} aria-label={completed ? `Restore ${item.name}` : `Complete ${item.name}`}>{pending ? "…" : completed ? <Check size={18} /> : <Circle size={18} />}</button>
    <div className="shopping-item-copy"><strong>{item.name}</strong>{item.quantity && <span>{item.quantity}</span>}{item.notes && <p>{item.notes}</p>}</div>
    <div className="shopping-item-actions"><button type="button" onClick={onEdit} disabled={pending} aria-label={`Edit ${item.name}`}><Pencil size={16} /></button><button type="button" onClick={onDelete} disabled={pending} aria-label={`Remove ${item.name}`}><Trash2 size={16} /></button></div>
  </li>;
}
