'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Expense, Budget, Category } from '@/types';
import { CATEGORY_LABELS, CATEGORY_COLORS, CATEGORIES } from '@/types';
import { AddExpenseModal } from './add-expense-modal';

const MONTHS = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
];

function formatSEK(n: number) {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(n);
}

function prevMonthLink(year: number, month: number) {
  if (month === 1) return `/month/${year - 1}/12`;
  return `/month/${year}/${month - 1}`;
}

function nextMonthLink(year: number, month: number) {
  if (month === 12) return `/month/${year + 1}/1`;
  return `/month/${year}/${month + 1}`;
}

type Props = {
  year: number;
  month: number;
  initialExpenses: Expense[];
  budgets: Budget[];
};

export function MonthClient({ year, month, initialExpenses, budgets }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  // Category totals
  const catTotals: Record<string, number> = {};
  for (const e of expenses) {
    catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount;
  }

  async function togglePaid(expense: Expense) {
    const newPaid = !expense.paid;

    // Optimistic update
    setPendingIds((s) => new Set([...s, expense.id]));
    setExpenses((prev) =>
      prev.map((e) => (e.id === expense.id ? { ...e, paid: newPaid } : e))
    );

    try {
      await fetch(`/api/expenses?id=${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: newPaid }),
      });
    } catch {
      // Revert on error
      setExpenses((prev) =>
        prev.map((e) => (e.id === expense.id ? { ...e, paid: expense.paid } : e))
      );
    } finally {
      setPendingIds((s) => {
        const next = new Set(s);
        next.delete(expense.id);
        return next;
      });
    }
  }

  async function deleteExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    try {
      await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
    } catch {
      // Silent fail — user can refresh
    }
  }

  const overBudget = budgets.filter((b) => {
    const spent = catTotals[b.category] ?? 0;
    return spent > b.monthlyLimit;
  });

  const byCategory = CATEGORIES.map((cat) => ({
    cat,
    items: expenses.filter((e) => e.category === cat),
    total: catTotals[cat] ?? 0,
    budget: budgets.find((b) => b.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Header navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={prevMonthLink(year, month)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Föregående månad"
        >
          ←
        </Link>
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            {MONTHS[month - 1]} {year}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {expenses.length} utgifter · {formatSEK(total)}
          </p>
        </div>
        <Link
          href={nextMonthLink(year, month)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Nästa månad"
        >
          →
        </Link>
      </div>

      {/* Budget warnings */}
      {overBudget.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="font-medium text-red-700 dark:text-red-400">
            ⚠️ Budget överskriden:{' '}
            {overBudget.map((b) => CATEGORY_LABELS[b.category]).join(', ')}
          </p>
        </div>
      )}

      {/* Add expense button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium"
      >
        + Lägg till utgift
      </button>

      {/* Empty state */}
      {expenses.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">Inga utgifter denna månad</p>
          <p className="text-sm mt-1">Lägg till din första utgift ovan</p>
        </div>
      )}

      {/* Expenses by category */}
      {byCategory.map(({ cat, items, total: catTotal, budget }) => {
        const pct = budget ? (catTotal / budget.monthlyLimit) * 100 : 0;
        const overLimit = budget && catTotal > budget.monthlyLimit;
        const nearLimit = budget && pct >= 90 && !overLimit;

        return (
          <div
            key={cat}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: CATEGORY_COLORS[cat] }}
                />
                <span className="font-medium">{CATEGORY_LABELS[cat]}</span>
              </div>
              <div className="text-right">
                <span className={`font-semibold ${overLimit ? 'text-red-500' : nearLimit ? 'text-amber-500' : ''}`}>
                  {formatSEK(catTotal)}
                </span>
                {budget && (
                  <span className="text-xs text-gray-400 ml-1">/ {formatSEK(budget.monthlyLimit)}</span>
                )}
              </div>
            </div>

            {/* Budget progress bar */}
            {budget && (
              <div className="px-4 py-1.5">
                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      overLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Expense items */}
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {items.map((expense) => (
                <div
                  key={expense.id}
                  className={`flex items-center px-4 py-3 gap-3 ${
                    expense.paid ? 'opacity-60' : ''
                  }`}
                >
                  <button
                    onClick={() => togglePaid(expense)}
                    disabled={pendingIds.has(expense.id)}
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                      expense.paid
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300 dark:border-gray-500 hover:border-green-400'
                    } disabled:opacity-50`}
                    aria-label={expense.paid ? 'Markera som obetald' : 'Markera som betald'}
                  >
                    {expense.paid && (
                      <svg className="w-full h-full text-white p-0.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${expense.paid ? 'line-through text-gray-400' : ''}`}>
                      {expense.name}
                    </p>
                    {expense.note && (
                      <p className="text-xs text-gray-400 truncate">{expense.note}</p>
                    )}
                  </div>

                  <span className="font-semibold text-sm flex-shrink-0">
                    {formatSEK(expense.amount)}
                  </span>

                  <button
                    onClick={() => deleteExpense(expense.id)}
                    className="text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 transition-colors flex-shrink-0 ml-1"
                    aria-label="Ta bort utgift"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Total */}
      {expenses.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-4 flex items-center justify-between font-bold text-lg">
          <span>Totalt</span>
          <span>{formatSEK(total)}</span>
        </div>
      )}

      {showAddModal && (
        <AddExpenseModal
          year={year}
          month={month}
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            setShowAddModal(false);
            const res = await fetch(`/api/expenses?year=${year}&month=${month}`);
            if (res.ok) setExpenses(await res.json());
          }}
        />
      )}
    </div>
  );
}
