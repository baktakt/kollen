import { put, head, del } from '@vercel/blob';
import type { Expense, CategoryMap, Budget, Settings, WarnLog } from '@/types';
import { DEFAULT_CATEGORY_MAP } from '@/types';

const BLOB_BASE = 'data';

async function readBlob<T>(path: string, fallback: T): Promise<T> {
  try {
    const url = process.env.BLOB_BASE_URL
      ? `${process.env.BLOB_BASE_URL}/${path}`
      : null;

    // Try to fetch from blob storage
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return fallback;

    // List blobs to find the one we want
    const { list } = await import('@vercel/blob');
    const result = await list({ prefix: path, token });
    if (result.blobs.length === 0) return fallback;

    const blob = result.blobs[result.blobs.length - 1];
    const res = await fetch(blob.url);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

async function writeBlob<T>(path: string, data: T): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN not set');

  const json = JSON.stringify(data, null, 2);
  await put(path, json, {
    access: 'public',
    contentType: 'application/json',
    token,
    addRandomSuffix: false,
  });
}

// Expenses
export async function getExpenses(): Promise<Expense[]> {
  return readBlob<Expense[]>(`${BLOB_BASE}/expenses.json`, []);
}

export async function saveExpenses(expenses: Expense[]): Promise<void> {
  await writeBlob(`${BLOB_BASE}/expenses.json`, expenses);
}

export async function addExpense(expense: Expense): Promise<void> {
  const expenses = await getExpenses();
  expenses.push(expense);
  await saveExpenses(expenses);
}

export async function updateExpense(
  id: string,
  updates: Partial<Expense>
): Promise<void> {
  const expenses = await getExpenses();
  const idx = expenses.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error(`Expense ${id} not found`);
  expenses[idx] = { ...expenses[idx], ...updates };
  await saveExpenses(expenses);
}

export async function deleteExpense(id: string): Promise<void> {
  const expenses = await getExpenses();
  await saveExpenses(expenses.filter((e) => e.id !== id));
}

// Categories
export async function getCategoryMap(): Promise<CategoryMap> {
  return readBlob<CategoryMap>(
    `${BLOB_BASE}/categories.json`,
    DEFAULT_CATEGORY_MAP
  );
}

export async function saveCategoryMap(map: CategoryMap): Promise<void> {
  await writeBlob(`${BLOB_BASE}/categories.json`, map);
}

export async function setCategoryForName(
  name: string,
  category: import('@/types').Category
): Promise<void> {
  const map = await getCategoryMap();
  map[name] = category;
  await saveCategoryMap(map);
}

// Budgets
export async function getBudgets(): Promise<Budget[]> {
  return readBlob<Budget[]>(`${BLOB_BASE}/budgets.json`, []);
}

export async function saveBudgets(budgets: Budget[]): Promise<void> {
  await writeBlob(`${BLOB_BASE}/budgets.json`, budgets);
}

// Settings
export async function getSettings(): Promise<Settings> {
  return readBlob<Settings>(`${BLOB_BASE}/settings.json`, {
    reportEmail: process.env.REPORT_EMAIL ?? '',
    reportDayOfMonth: 1,
  });
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeBlob(`${BLOB_BASE}/settings.json`, settings);
}

// Warn log
export async function getWarnLog(): Promise<WarnLog> {
  return readBlob<WarnLog>(`${BLOB_BASE}/warn-log.json`, {});
}

export async function saveWarnLog(log: WarnLog): Promise<void> {
  await writeBlob(`${BLOB_BASE}/warn-log.json`, log);
}
