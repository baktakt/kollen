'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function BankSyncCallbackClient() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push('/import'), 2500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="space-y-4">
      <div className="text-5xl">🏦</div>
      <h1 className="text-xl font-semibold">Bankkontot är anslutet! Omdirigerar...</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        Du skickas tillbaka till Importera-sidan automatiskt.
      </p>
    </div>
  );
}
