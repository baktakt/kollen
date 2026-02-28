import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { ImportClient } from '@/components/import-client';

export default async function ImportPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <ImportClient />
      </main>
    </>
  );
}
