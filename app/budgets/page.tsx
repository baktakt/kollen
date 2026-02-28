import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getExpenses, getBudgets } from '@/lib/blob';
import { Nav } from '@/components/nav';
import { BudgetsClient } from '@/components/budgets-client';

export default async function BudgetsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const now = new Date();
  const [expenses, budgets] = await Promise.all([getExpenses(), getBudgets()]);

  const thisMonth = expenses.filter(
    (e) => e.year === now.getFullYear() && e.month === now.getMonth() + 1
  );

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <BudgetsClient initialBudgets={budgets} thisMonthExpenses={thisMonth} />
      </main>
    </>
  );
}
