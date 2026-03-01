'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BankConnection } from '@/types';
import type { NordigenInstitution } from '@/lib/nordigen';
import { CATEGORY_LABELS, type Category } from '@/types';

type PreviewRow = {
  date: string;
  name: string;
  originalDescription: string;
  amount: number;
  category: Category;
  year: number;
  month: number;
};

function formatSEK(n: number) {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(n);
}

function StatusBadge({ status }: { status: BankConnection['status'] }) {
  const styles: Record<BankConnection['status'], string> = {
    pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    linked: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    expired: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  };
  const labels: Record<BankConnection['status'], string> = {
    pending: 'Väntar på godkännande',
    linked: 'Ansluten',
    expired: 'Utgången',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function BankSyncClient() {
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [institutions, setInstitutions] = useState<NordigenInstitution[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [showInstitutions, setShowInstitutions] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<NordigenInstitution | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/bank-sync');
      if (res.status === 503) {
        setConfigured(false);
        return;
      }
      setConfigured(true);
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  async function loadInstitutions() {
    setLoadingInstitutions(true);
    setError('');
    try {
      const res = await fetch('/api/bank-sync/institutions');
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Kunde inte hämta banker');
        return;
      }
      const data: NordigenInstitution[] = await res.json();
      setInstitutions(data);
      setShowInstitutions(true);
    } catch {
      setError('Kunde inte hämta banker');
    } finally {
      setLoadingInstitutions(false);
    }
  }

  async function handleConnect() {
    if (!selectedInstitution) return;
    setLoading(true);
    setError('');
    try {
      const redirectUrl = `${window.location.origin}/bank-sync/callback`;
      const res = await fetch('/api/bank-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: selectedInstitution.id,
          institutionName: selectedInstitution.name,
          institutionLogo: selectedInstitution.logo,
          redirectUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Anslutning misslyckades');
        return;
      }
      // Redirect user to bank authorization page
      window.location.href = data.link;
    } catch {
      setError('Kunde inte starta anslutning');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect(id: string) {
    if (!confirm('Ta bort bankanslutningen?')) return;
    setError('');
    try {
      const res = await fetch(`/api/bank-sync?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Borttagning misslyckades');
        return;
      }
      await loadConnections();
    } catch {
      setError('Kunde inte ta bort anslutning');
    }
  }

  async function handleSync(connectionId: string) {
    setSyncing(connectionId);
    setPreview(null);
    setStatus('');
    setError('');
    try {
      const res = await fetch('/api/bank-sync/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, confirm: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Synkronisering misslyckades');
        return;
      }
      if (data.preview?.length === 0) {
        setStatus('Inga nya transaktioner hittades');
        return;
      }
      setPreview(data.preview);
      setActiveConnectionId(connectionId);
    } catch {
      setError('Synkronisering misslyckades');
    } finally {
      setSyncing(null);
    }
  }

  async function handleConfirmSync() {
    if (!activeConnectionId) return;
    setSyncing(activeConnectionId);
    setError('');
    try {
      const res = await fetch('/api/bank-sync/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: activeConnectionId, confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Import misslyckades');
        return;
      }
      setStatus(
        `✓ Importerade ${data.imported} transaktioner (${data.skipped} dubletter ignorerade)`
      );
      setPreview(null);
      setActiveConnectionId(null);
      await loadConnections();
    } catch {
      setError('Import misslyckades');
    } finally {
      setSyncing(null);
    }
  }

  if (configured === false) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-700 p-5">
        <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">
          GoCardless-integration ej konfigurerad
        </h3>
        <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
          För att använda automatisk banksynkronisering behöver du sätta upp ett gratis
          GoCardless Bank Account Data-konto och ange dina API-nycklar.
        </p>
        <ol className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1 list-decimal list-inside">
          <li>
            Registrera ett gratis konto på{' '}
            <a
              href="https://bankaccountdata.gocardless.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              bankaccountdata.gocardless.com
            </a>
          </li>
          <li>Skapa ett API-nyckelpar under Developer Settings</li>
          <li>
            Lägg till <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">NORDIGEN_SECRET_ID</code> och{' '}
            <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">NORDIGEN_SECRET_KEY</code> i din{' '}
            <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">.env.local</code>
          </li>
        </ol>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected accounts */}
      {connections.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {connections.map((conn) => (
            <div key={conn.id} className="flex items-center gap-4 px-5 py-4">
              {conn.institutionLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={conn.institutionLogo}
                  alt={conn.institutionName}
                  className="w-8 h-8 rounded object-contain"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{conn.institutionName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <StatusBadge status={conn.status} />
                  {conn.lastSyncAt && (
                    <span className="text-xs text-gray-400">
                      Senast synkad: {new Date(conn.lastSyncAt).toLocaleDateString('sv-SE')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {conn.status === 'linked' && (
                  <button
                    onClick={() => handleSync(conn.id)}
                    disabled={syncing === conn.id}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {syncing === conn.id ? 'Hämtar...' : 'Synkronisera'}
                  </button>
                )}
                <button
                  onClick={() => handleDisconnect(conn.id)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg text-sm font-medium transition-colors"
                >
                  Ta bort
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new connection */}
      {!showInstitutions && (
        <button
          onClick={loadInstitutions}
          disabled={loadingInstitutions}
          className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:opacity-50"
        >
          {loadingInstitutions ? 'Laddar banker...' : '+ Lägg till bankkonto'}
        </button>
      )}

      {/* Institution picker */}
      {showInstitutions && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Välj bank</h3>
            <button
              onClick={() => {
                setShowInstitutions(false);
                setSelectedInstitution(null);
              }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Avbryt
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto">
            {institutions.map((inst) => (
              <button
                key={inst.id}
                onClick={() => setSelectedInstitution(inst)}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors text-center ${
                  selectedInstitution?.id === inst.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                    : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500'
                }`}
              >
                {inst.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={inst.logo} alt={inst.name} className="w-8 h-8 rounded object-contain" />
                ) : (
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-xs font-bold text-gray-500">
                    {inst.name.charAt(0)}
                  </div>
                )}
                <span className="text-xs leading-tight">{inst.name}</span>
              </button>
            ))}
          </div>

          {selectedInstitution && (
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Anslut till <strong>{selectedInstitution.name}</strong>
              </span>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="ml-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Ansluter...' : 'Anslut via bank-ID'}
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {status && (
        <div className="text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
          {status}
        </div>
      )}

      {/* Transaction preview */}
      {preview && preview.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{preview.length} transaktioner hittades</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Kontrollera och bekräfta importen
              </p>
            </div>
            <button
              onClick={handleConfirmSync}
              disabled={!!syncing}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {syncing ? 'Importerar...' : 'Bekräfta import'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3">Namn</th>
                  <th className="px-4 py-3">Originalbeskrivning</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3 text-right">Belopp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-2 text-gray-500">{row.date}</td>
                    <td className="px-4 py-2 font-medium">{row.name}</td>
                    <td
                      className="px-4 py-2 text-gray-400 max-w-xs truncate"
                      title={row.originalDescription}
                    >
                      {row.originalDescription}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md text-xs">
                        {CATEGORY_LABELS[row.category]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{formatSEK(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-medium mb-2">Hur det fungerar</h3>
        <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
          <li>1. Välj din bank och anslut via BankID eller din banks inloggning.</li>
          <li>2. Du omdirigeras tillbaka hit när anslutningen är klar.</li>
          <li>3. Klicka på Synkronisera för att hämta de senaste 90 dagarnas transaktioner.</li>
          <li>4. Granska och bekräfta importen — dubletter ignoreras automatiskt.</li>
        </ul>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Powered by{' '}
          <a
            href="https://bankaccountdata.gocardless.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            GoCardless Bank Account Data
          </a>
          . Dina bankuppgifter lämnas aldrig till denna app — du loggar in direkt hos banken.
        </p>
      </div>
    </div>
  );
}
