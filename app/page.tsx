import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getExpenses, getBudgets } from '@/lib/blob';
import { computeForecast, getMonthlyTotals } from '@/lib/forecast';
import { Nav } from '@/components/nav';
import { DashboardClient } from '@/components/dashboard-client';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const [expenses, budgets] = await Promise.all([getExpenses(), getBudgets()]);

  const thisMonth = expenses.filter(
    (e) => e.year === currentYear && e.month === currentMonth
  );
  const lastMonth = expenses.filter(
    (e) => e.year === prevYear && e.month === prevMonth
  );
  const sameMonthPriorYear = expenses.filter(
    (e) => e.year === currentYear - 1 && e.month === currentMonth
  );

  const totalThis = thisMonth.reduce((s, e) => s + e.amount, 0);
  const totalLast = lastMonth.reduce((s, e) => s + e.amount, 0);
  const totalSameLastYear = sameMonthPriorYear.reduce((s, e) => s + e.amount, 0);

  const forecast = computeForecast(expenses);
  const monthlyTotals = getMonthlyTotals(expenses).slice(-12);

  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <DashboardClient
          currentYear={currentYear}
          currentMonth={currentMonth}
          totalThis={totalThis}
          totalLast={totalLast}
          totalSameLastYear={totalSameLastYear}
          forecast={forecast}
          monthlyTotals={monthlyTotals}
          thisMonthExpenses={thisMonth}
          budgets={budgets}
        />
      </main>
    </>
  );
}
