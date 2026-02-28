'use client';

import { useState } from 'react';
import type { Expense, Budget, Category } from '@/types';
import { CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS } from '@/types';

function formatSEK(n: number) {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(n);
}

type Props = {
  initialBudgets: Budget[];
  thisMonthExpenses: Expense[];
};

export function BudgetsClient({ initialBudgets, thisMonthExpenses }: Props) {
  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets);
  const [editing, setEditing] = useState<Category | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const catTotals: Record<string, number> = {};
  for (const e of thisMonthExpenses) {
    catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount;
  }

  function startEdit(cat: Category) {
    const existing = budgets.find((b) => b.category === cat);
    setEditValue(existing ? String(existing.monthlyLimit) : '');
    setEditing(cat);
  }

  async function saveBudget(cat: Category) {
    const limit = parseFloat(editValue);
    if (isNaN(limit) || limit < 0) return;
    setSaving(true);

    try {
      const res = await fetch('/api/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, monthlyLimit: limit }),
      });
      if (res.ok) {
        setBudgets((prev) => {
          const filtered = prev.filter((b) => b.category !== cat);
          return [...filtered, { category: cat, monthlyLimit: limit }];
        });
      }
    } finally {
      setSaving(false);
      setEditing(null);
    }
  }

  async function removeBudget(cat: Category) {
    await fetch(`/api/budgets?category=${cat}`, { method: 'DELETE' });
    setBudgets((prev) => prev.filter((b) => b.category !== cat));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Budget</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        Sätt månatliga gränser per kategori. Jämförelsen visar innevarande månad.
      </p>

      <div className="space-y-4">
        {CATEGORIES.map((cat) => {
          const budget = budgets.find((b) => b.category === cat);
          const spent = catTotals[cat] ?? 0;
          const limit = budget?.monthlyLimit ?? 0;
          const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
          const overLimit = limit > 0 && spent > limit;
          const nearLimit = limit > 0 && pct >= 90 && !overLimit;
          const isEditing = editing === cat;

          return (
            <div
              key={cat}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: CATEGORY_COLORS[cat] }}
                  />
                  <span className="font-medium">{CATEGORY_LABELS[cat]}</span>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-28 px-2 py-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="SEK/mån"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveBudget(cat);
                        if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                    <button
                      onClick={() => saveBudget(cat)}
                      disabled={saving}
                      className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg disabled:opacity-50"
                    >
                      Spara
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-3 py-1 text-gray-500 text-sm"
                    >
                      Avbryt
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {budget ? (
                      <>
                        <span className={`text-sm font-medium ${overLimit ? 'text-red-500' : nearLimit ? 'text-amber-500' : 'text-gray-600 dark:text-gray-300'}`}>
                          {formatSEK(spent)} / {formatSEK(limit)}
                        </span>
                        <button
                          onClick={() => startEdit(cat)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Ändra
                        </button>
                        <button
                          onClick={() => removeBudget(cat)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Ta bort
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-gray-400">Ingen gräns</span>
                        <button
                          onClick={() => startEdit(cat)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Sätt gräns
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {budget && (
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      overLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {!budget && spent > 0 && (
                <div className="mt-1 text-sm text-gray-400">
                  Spenderat: {formatSEK(spent)} (ingen budget satt)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
