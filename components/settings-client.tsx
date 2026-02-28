'use client';

import { useState } from 'react';
import type { Settings } from '@/types';

type Props = { initialSettings: Settings };

export function SettingsClient({ initialSettings }: Props) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveStatus('');

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaveStatus(res.ok ? '✓ Inställningar sparade' : 'Fel vid sparande');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    setTestStatus('Skickar...');
    try {
      const res = await fetch('/api/test-email', { method: 'POST' });
      setTestStatus(res.ok ? '✓ Testmail skickat!' : 'Fel vid utskick');
    } catch {
      setTestStatus('Kunde inte skicka');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inställningar</h1>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <h2 className="font-semibold">E-postrapporter</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              E-postadress för rapporter
            </label>
            <input
              type="email"
              value={settings.reportEmail}
              onChange={(e) =>
                setSettings((s) => ({ ...s, reportEmail: e.target.value }))
              }
              placeholder="din@email.se"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rapporttid
            </label>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Rapporten skickas automatiskt den 1:a varje månad kl 08:00 CET.
            </p>
          </div>

          {saveStatus && (
            <p className={`text-sm ${saveStatus.startsWith('✓') ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {saveStatus}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Sparar...' : 'Spara inställningar'}
          </button>
        </div>
      </form>

      {/* Test email */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="font-semibold">Testa e-post</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Skickar ett testmail till den konfigurerade adressen.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestEmail}
            disabled={!settings.reportEmail}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Skicka testmail
          </button>
          {testStatus && (
            <span className={`text-sm ${testStatus.startsWith('✓') ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {testStatus}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-medium mb-3">Kron-schema</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Månadsrapporter skickas automatiskt den 1:a varje månad kl 08:00 CET
          via Vercel Cron. Rapporten täcker föregående månad.
        </p>
        <code className="block mt-2 text-xs bg-gray-100 dark:bg-gray-700 rounded px-3 py-2 text-gray-600 dark:text-gray-400">
          0 7 1 * * → /api/cron/monthly-report
        </code>
      </div>
    </div>
  );
}
