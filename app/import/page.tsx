import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { ImportClient } from '@/components/import-client';
import { BankSyncClient } from '@/components/bank-sync-client';

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const params = await searchParams;
  const tab = params.tab === 'bank' ? 'bank' : 'csv';

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Importera transaktioner</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Hämta transaktioner från din bank automatiskt eller via CSV-fil
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          <a
            href="/import?tab=bank"
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
              tab === 'bank'
                ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            🏦 Banksynkronisering
          </a>
          <a
            href="/import?tab=csv"
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
              tab === 'csv'
                ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            📄 CSV-import
          </a>
        </div>

        {tab === 'bank' ? <BankSyncClient /> : <ImportClient />}
      </main>
    </>
  );
}

