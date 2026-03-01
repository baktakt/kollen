import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { BankSyncCallbackClient } from '@/components/bank-sync-callback-client';

export default async function BankSyncCallbackPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <>
      <Nav />
      <main className="max-w-xl mx-auto px-4 py-16 text-center">
        <BankSyncCallbackClient />
      </main>
    </>
  );
}
