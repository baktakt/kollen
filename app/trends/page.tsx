import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getExpenses } from '@/lib/blob';
import { Nav } from '@/components/nav';
import { TrendsClient } from '@/components/trends-client';

export default async function TrendsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const expenses = await getExpenses();

  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <TrendsClient expenses={expenses} />
      </main>
    </>
  );
}
