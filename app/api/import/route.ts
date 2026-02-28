import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getExpenses, addExpense, getCategoryMap } from '@/lib/blob';
import { categorizeExpenseBatch } from '@/lib/categorize';
import { parseCSV, fuzzyMatch, transactionToExpenseName } from '@/lib/csv-parser';
import type { Expense } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const confirm = formData.get('confirm') === 'true';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const content = await file.text();
  const transactions = parseCSV(content);

  if (transactions.length === 0) {
    return NextResponse.json({ error: 'No transactions parsed from CSV' }, { status: 400 });
  }

  // Only import debits (negative amounts = money out)
  const debits = transactions.filter((t) => t.amount < 0);

  const categoryMap = await getCategoryMap();
  const knownNames = Object.keys(categoryMap);

  // Map transactions to expense names
  const mapped = debits.map((t) => {
    const matched = fuzzyMatch(t.description, knownNames);
    const name = matched ?? transactionToExpenseName(t.description);
    const [year, month] = (t.date.split('-').map(Number)) as [number, number];
    return {
      date: t.date,
      year: year || new Date().getFullYear(),
      month: month || new Date().getMonth() + 1,
      name,
      originalDescription: t.description,
      amount: Math.abs(t.amount),
    };
  });

  if (!confirm) {
    // Preview mode: categorize and return preview
    const names = [...new Set(mapped.map((m) => m.name))];
    const categories = await categorizeExpenseBatch(names);

    const preview = mapped.map((m) => ({
      ...m,
      category: categories[m.name] ?? 'other',
    }));

    return NextResponse.json({ preview, total: preview.length });
  }

  // Confirm mode: import and deduplicate
  const existing = await getExpenses();
  const names = [...new Set(mapped.map((m) => m.name))];
  const categories = await categorizeExpenseBatch(names);

  let imported = 0;
  let skipped = 0;

  for (const m of mapped) {
    // Deduplicate: same name + amount + year + month
    const duplicate = existing.some(
      (e) =>
        e.name === m.name &&
        e.amount === m.amount &&
        e.year === m.year &&
        e.month === m.month
    );

    if (duplicate) {
      skipped++;
      continue;
    }

    const expense: Expense = {
      id: uuidv4(),
      year: m.year,
      month: m.month,
      name: m.name,
      amount: m.amount,
      category: categories[m.name] ?? 'other',
      paid: true,
      source: 'bank_csv',
      createdAt: new Date().toISOString(),
    };

    await addExpense(expense);
    imported++;
  }

  return NextResponse.json({ imported, skipped });
}
