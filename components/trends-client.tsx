'use client';

import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { Expense } from '@/types';

function formatSEK(n: number) {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(n);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

type Props = { expenses: Expense[] };

export function TrendsClient({ expenses }: Props) {
  const [selectedName, setSelectedName] = useState<string>('');

  // Get all unique expense names
  const allNames = useMemo(() => {
    const names = new Set<string>();
    for (const e of expenses) names.add(e.name);
    return [...names].sort();
  }, [expenses]);

  // Build history for selected name
  const history = useMemo(() => {
    if (!selectedName) return [];
    const byMonth: Record<string, number> = {};
    for (const e of expenses) {
      if (e.name !== selectedName) continue;
      const key = `${e.year}-${String(e.month).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] ?? 0) + e.amount;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, amount]) => {
        const [y, m] = key.split('-');
        return {
          label: `${MONTHS[parseInt(m) - 1]} ${y}`,
          amount,
        };
      });
  }, [expenses, selectedName]);

  // Year-over-year table: last 6 years
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i);

  const yoyData = useMemo(() => {
    if (!selectedName) return [];
    return years.map((year) => {
      const total = expenses
        .filter((e) => e.name === selectedName && e.year === year)
        .reduce((s, e) => s + e.amount, 0);
      const prevTotal = expenses
        .filter((e) => e.name === selectedName && e.year === year - 1)
        .reduce((s, e) => s + e.amount, 0);
      const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
      return { year, total, delta };
    });
  }, [expenses, selectedName, years]);

  // Biggest YoY increases
  const biggestIncreases = useMemo(() => {
    const results: Array<{ name: string; delta: number; year: number }> = [];
    for (const name of allNames) {
      const thisYearTotal = expenses
        .filter((e) => e.name === name && e.year === currentYear)
        .reduce((s, e) => s + e.amount, 0);
      const lastYearTotal = expenses
        .filter((e) => e.name === name && e.year === currentYear - 1)
        .reduce((s, e) => s + e.amount, 0);
      if (lastYearTotal > 0 && thisYearTotal > 0) {
        const delta = ((thisYearTotal - lastYearTotal) / lastYearTotal) * 100;
        results.push({ name, delta, year: currentYear });
      }
    }
    return results
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5);
  }, [expenses, allNames, currentYear]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Trender</h1>

      {/* Name selector */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Välj utgift för att se historik
        </label>
        <select
          value={selectedName}
          onChange={(e) => setSelectedName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Välj utgift...</option>
          {allNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Price history chart */}
      {selectedName && history.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold mb-4">Prishistorik — {selectedName}</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatSEK(Number(v))} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* YoY table */}
      {selectedName && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold mb-4">År-för-år jämförelse — {selectedName}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 pr-4">År</th>
                  <th className="pb-2 pr-4">Totalt</th>
                  <th className="pb-2">Förändring</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {yoyData.map(({ year, total, delta }) => (
                  <tr key={year}>
                    <td className="py-2 pr-4 font-medium">{year}</td>
                    <td className="py-2 pr-4">
                      {total > 0 ? formatSEK(total) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-2">
                      {total > 0 && delta !== 0 ? (
                        <span className={delta > 0 ? 'text-red-500' : 'text-green-500'}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Biggest increases */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold mb-4">Störst ökning år-för-år ({currentYear} vs {currentYear - 1})</h2>
        {biggestIncreases.length === 0 ? (
          <p className="text-gray-400 text-sm">Otillräcklig data för jämförelse</p>
        ) : (
          <div className="space-y-3">
            {biggestIncreases.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm w-5">{i + 1}.</span>
                  <button
                    onClick={() => setSelectedName(item.name)}
                    className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline text-left"
                  >
                    {item.name}
                  </button>
                </div>
                <span className="text-red-500 font-semibold">
                  +{item.delta.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All-names empty state */}
      {allNames.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📈</p>
          <p className="font-medium">Ingen historik ännu</p>
          <p className="text-sm mt-1">Lägg till utgifter för att se trender</p>
        </div>
      )}
    </div>
  );
}
