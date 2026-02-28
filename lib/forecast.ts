import type { Expense } from '@/types';

export type ForecastResult = {
  estimated: number;
  min: number;
  max: number;
  byName: Array<{
    name: string;
    estimated: number;
    highVariance: boolean;
  }>;
};

export function computeForecast(expenses: Expense[]): ForecastResult {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Get last 6 months (excluding current)
  const months: Array<{ year: number; month: number }> = [];
  let y = currentYear;
  let m = currentMonth - 1;
  for (let i = 0; i < 6; i++) {
    if (m === 0) {
      m = 12;
      y--;
    }
    months.unshift({ year: y, month: m });
    m--;
  }

  // Group expenses by name, then by month
  const byName: Record<string, Record<string, number>> = {};

  for (const expense of expenses) {
    const key = `${expense.year}-${expense.month}`;
    const isInRange = months.some(
      (mo) => mo.year === expense.year && mo.month === expense.month
    );
    if (!isInRange) continue;

    if (!byName[expense.name]) byName[expense.name] = {};
    byName[expense.name][key] =
      (byName[expense.name][key] ?? 0) + expense.amount;
  }

  const forecastItems: ForecastResult['byName'] = [];

  for (const [name, monthData] of Object.entries(byName)) {
    const values = Object.values(monthData);

    // Only forecast if seen in 3+ of last 6 months
    if (values.length < 3) continue;

    // 3-month rolling average
    const recent = values.slice(-3);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;

    // High variance: std dev > 20% of mean
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const highVariance = stdDev / mean > 0.2;

    forecastItems.push({
      name,
      estimated: Math.round(avg),
      highVariance,
    });
  }

  const total = forecastItems.reduce((sum, item) => sum + item.estimated, 0);

  // Min/max based on variance
  const highVarianceTotal = forecastItems
    .filter((i) => i.highVariance)
    .reduce((sum, i) => sum + i.estimated, 0);

  const min = Math.round(total - highVarianceTotal * 0.2);
  const max = Math.round(total + highVarianceTotal * 0.2);

  return {
    estimated: total,
    min,
    max,
    byName: forecastItems.sort((a, b) => b.estimated - a.estimated),
  };
}

export function getMonthlyTotals(
  expenses: Expense[]
): Array<{ year: number; month: number; total: number; label: string }> {
  const totals: Record<string, { year: number; month: number; total: number }> =
    {};

  for (const expense of expenses) {
    const key = `${expense.year}-${String(expense.month).padStart(2, '0')}`;
    if (!totals[key]) {
      totals[key] = { year: expense.year, month: expense.month, total: 0 };
    }
    totals[key].total += expense.amount;
  }

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec',
  ];

  return Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      ...v,
      label: `${months[v.month - 1]} ${v.year}`,
    }));
}
