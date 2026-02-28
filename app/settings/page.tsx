import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getSettings } from '@/lib/blob';
import { Nav } from '@/components/nav';
import { SettingsClient } from '@/components/settings-client';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const settings = await getSettings();

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <SettingsClient initialSettings={settings} />
      </main>
    </>
  );
}
