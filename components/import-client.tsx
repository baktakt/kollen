'use client';

import { useState, useRef } from 'react';
import type { Category } from '@/types';
import { CATEGORY_LABELS } from '@/types';

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

export function ImportClient() {
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    setError('');
    setStatus('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('confirm', 'false');

    try {
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Fel vid parsning av CSV');
      } else {
        setPreview(data.preview);
      }
    } catch {
      setError('Kunde inte läsa filen');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!selectedFile) return;
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('confirm', 'true');

    try {
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Fel vid import');
      } else {
        setStatus(`✓ Importerade ${data.imported} transaktioner (${data.skipped} dubletter ignorerade)`);
        setPreview(null);
        setSelectedFile(null);
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch {
      setError('Import misslyckades');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importera banktransaktioner</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Ladda upp CSV-export från SEB, Swedbank, Handelsbanken eller Nordea
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              CSV-fil
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-900/30 dark:file:text-indigo-400 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>

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

          <button
            type="submit"
            disabled={!selectedFile || loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Analyserar...' : 'Förhandsgranska'}
          </button>
        </form>
      </div>

      {/* Preview table */}
      {preview && preview.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{preview.length} transaktioner hittades</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Kontrollera och bekräfta importen</p>
            </div>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Importerar...' : 'Bekräfta import'}
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
                    <td className="px-4 py-2 text-gray-400 max-w-xs truncate" title={row.originalDescription}>
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

      {/* Instructions */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-medium mb-3">Format som stöds</h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>• <strong>SEB</strong> — Exportera från internetbanken under Kontoöversikt → Ladda ned transaktioner</li>
          <li>• <strong>Swedbank</strong> — Exportera från Transaktioner → CSV/Excel</li>
          <li>• <strong>Handelsbanken</strong> — Exportera från Kontoinformation</li>
          <li>• <strong>Nordea</strong> — Exportera från Transaktioner (CSV-format)</li>
        </ul>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Endast debiteringar (utgifter) importeras. Dubletter ignoreras automatiskt.
        </p>
      </div>
    </div>
  );
}
