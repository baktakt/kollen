'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import type { Expense, Budget, Category } from '@/types';
import { CATEGORY_LABELS, CATEGORY_COLORS, CATEGORIES } from '@/types';
import type { ForecastResult } from '@/lib/forecast';
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

function DeltaBadge({ value, label }: { value: number; label: string }) {
  if (value === 0) return null;
  const positive = value > 0;
  return (
    <span className={`text-sm font-medium ${positive ? 'text-red-500' : 'text-green-500'}`}>
      {positive ? '+' : ''}{formatSEK(value)} {label}
    </span>
  );
}

type Props = {
  currentYear: number;
  currentMonth: number;
  totalThis: number;
  totalLast: number;
  totalSameLastYear: number;
  forecast: ForecastResult;
  monthlyTotals: Array<{ year: number; month: number; total: number; label: string }>;
  thisMonthExpenses: Expense[];
  budgets: Budget[];
};

export function DashboardClient({
  currentYear,
  currentMonth,
  totalThis,
  totalLast,
  totalSameLastYear,
  forecast,
  monthlyTotals,
  thisMonthExpenses,
  budgets,
}: Props) {
  const [showAddModal, setShowAddModal] = useState(false);

  // Build category totals for donut chart
  const catTotals: Record<string, number> = {};
  for (const e of thisMonthExpenses) {
    catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amount;
  }
  const donutData = Object.entries(catTotals)
    .filter(([, v]) => v > 0)
    .map(([cat, value]) => ({
      name: CATEGORY_LABELS[cat as Category],
      value,
      color: CATEGORY_COLORS[cat as Category],
    }));

  const overBudget = budgets.filter((b) => {
    const spent = catTotals[b.category] ?? 0;
    return spent > b.monthlyLimit;
  });

  const monthName = MONTHS[currentMonth - 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Översikt</h1>
          <p className="text-gray-500 dark:text-gray-400">{monthName} {currentYear}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          + Ny utgift
        </button>
      </div>

      {/* Budget warnings */}
      {overBudget.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="font-medium text-red-700 dark:text-red-400">
            Budgeten överskriden: {overBudget.map((b) => CATEGORY_LABELS[b.category]).join(', ')}
          </p>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Denna månad</p>
          <p className="text-3xl font-bold mt-1">{formatSEK(totalThis)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">vs förra månaden</p>
          <p className="text-3xl font-bold mt-1">
            <DeltaBadge value={totalThis - totalLast} label="" />
          </p>
          {totalLast > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Förra: {formatSEK(totalLast)}
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">vs samma månad förra året</p>
          <p className="text-3xl font-bold mt-1">
            <DeltaBadge value={totalThis - totalSameLastYear} label="" />
          </p>
          {totalSameLastYear > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Förra året: {formatSEK(totalSameLastYear)}
            </p>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold mb-4">Utgifter per kategori</h2>
          {donutData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400">
              Inga utgifter denna månad
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={donutData}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatSEK(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 flex-1 text-sm">
                {donutData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: d.color }}
                    />
                    <span className="text-gray-600 dark:text-gray-300 flex-1">{d.name}</span>
                    <span className="font-medium">{formatSEK(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Line chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold mb-4">Totalt per månad (12 mån)</h2>
          {monthlyTotals.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400">
              Ingen historik tillgänglig
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={monthlyTotals} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => formatSEK(Number(v))} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Forecast card */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl p-5 border border-indigo-100 dark:border-indigo-800">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Prognos nästa månad</p>
            <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">
              {forecast.estimated > 0 ? formatSEK(forecast.estimated) : 'Otillräcklig data'}
            </p>
            {forecast.estimated > 0 && (
              <p className="text-sm text-indigo-500 dark:text-indigo-400 mt-1">
                Intervall: {formatSEK(forecast.min)} – {formatSEK(forecast.max)}
              </p>
            )}
          </div>
          <Link
            href={`/month/${currentYear}/${currentMonth}`}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Visa månadsvy →
          </Link>
        </div>
      </div>

      {showAddModal && (
        <AddExpenseModal
          year={currentYear}
          month={currentMonth}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
