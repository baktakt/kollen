import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getExpenses, getBudgets } from '@/lib/blob';
import { Nav } from '@/components/nav';
import { MonthClient } from '@/components/month-client';

export default async function MonthPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const { year: yearStr, month: monthStr } = await params;
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    redirect('/');
  }

  const [expenses, budgets] = await Promise.all([getExpenses(), getBudgets()]);

  const monthExpenses = expenses.filter(
    (e) => e.year === year && e.month === month
  );

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <MonthClient
          year={year}
          month={month}
          initialExpenses={monthExpenses}
          budgets={budgets}
        />
      </main>
    </>
  );
}
