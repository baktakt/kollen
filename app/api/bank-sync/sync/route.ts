import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getBankConnections,
  saveBankConnections,
  getExpenses,
  addExpense,
  getCategoryMap,
} from '@/lib/blob';
import {
  getRequisition,
  getAccountTransactions,
  transactionDescription,
} from '@/lib/nordigen';
import { categorizeExpenseBatch } from '@/lib/categorize';
import { fuzzyMatch, transactionToExpenseName } from '@/lib/csv-parser';
import type { Expense } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { connectionId, dateFrom, dateTo, confirm } = await req.json();

  const connections = await getBankConnections();
  const connection = connectionId
    ? connections.find((c) => c.id === connectionId)
    : connections.find((c) => c.status === 'linked');

  if (!connection) {
    return NextResponse.json({ error: 'No linked bank connection found' }, { status: 404 });
  }

  // Ensure requisition is linked and accounts are populated
  let accountIds = connection.accountIds;
  if (connection.status === 'pending' || accountIds.length === 0) {
    try {
      const req = await getRequisition(connection.requisitionId);
      if (req.status !== 'LN') {
        return NextResponse.json(
          { error: 'Bank connection not yet authorized' },
          { status: 400 }
        );
      }
      accountIds = req.accounts;
      const updated = connections.map((c) =>
        c.id === connection.id
          ? { ...c, status: 'linked' as const, accountIds }
          : c
      );
      await saveBankConnections(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // Default date range: last 90 days
  const to = dateTo ?? new Date().toISOString().slice(0, 10);
  const fromDate = dateFrom
    ? dateFrom
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Collect transactions from all accounts
  const allTransactions: {
    date: string;
    description: string;
    amount: number;
  }[] = [];

  for (const accountId of accountIds) {
    try {
      const { booked } = await getAccountTransactions(accountId, fromDate, to);
      for (const tx of booked) {
        const amount = parseFloat(tx.transactionAmount.amount);
        allTransactions.push({
          date: tx.bookingDate,
          description: transactionDescription(tx),
          amount,
        });
      }
    } catch {
      // Skip accounts that fail
    }
  }

  // Only import debits (money out = negative amounts)
  const debits = allTransactions.filter((t) => t.amount < 0);

  if (debits.length === 0) {
    return NextResponse.json({ preview: [], total: 0, imported: 0, skipped: 0 });
  }

  const categoryMap = await getCategoryMap();
  const knownNames = Object.keys(categoryMap);

  const mapped = debits.map((t) => {
    const matched = fuzzyMatch(t.description, knownNames);
    const name = matched ?? transactionToExpenseName(t.description);
    const parts = t.date.split('-').map(Number);
    const year = parts[0] ?? new Date().getFullYear();
    const month = parts[1] ?? new Date().getMonth() + 1;
    return {
      date: t.date,
      year,
      month,
      name,
      originalDescription: t.description,
      amount: Math.abs(t.amount),
    };
  });

  const names = [...new Set(mapped.map((m) => m.name))];
  const categories = await categorizeExpenseBatch(names);

  if (!confirm) {
    const preview = mapped.map((m) => ({
      ...m,
      category: categories[m.name] ?? 'other',
    }));
    return NextResponse.json({ preview, total: preview.length });
  }

  // Import with deduplication
  const existing = await getExpenses();
  let imported = 0;
  let skipped = 0;

  for (const m of mapped) {
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
    existing.push(expense);
    imported++;
  }

  // Update lastSyncAt
  const updatedConnections = connections.map((c) =>
    c.id === connection.id
      ? { ...c, lastSyncAt: new Date().toISOString() }
      : c
  );
  await saveBankConnections(updatedConnections);

  return NextResponse.json({ imported, skipped });
}
