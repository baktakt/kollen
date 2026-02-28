import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  getBudgets,
  getSettings,
  getWarnLog,
  saveWarnLog,
} from '@/lib/blob';
import { categorizeExpense } from '@/lib/categorize';
import { sendBudgetWarning } from '@/lib/email';
import type { Category, Expense } from '@/types';
import { CATEGORY_LABELS } from '@/types';
import { v4 as uuidv4 } from 'uuid';

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  const expenses = await getExpenses();

  if (year && month) {
    return NextResponse.json(
      expenses.filter(
        (e) => e.year === parseInt(year) && e.month === parseInt(month)
      )
    );
  }

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  const body = await req.json();
  const { name, amount, year, month, note, source, category: providedCategory } = body;

  if (!name || !amount || !year || !month) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const isValidProvidedCategory =
    typeof providedCategory === 'string' &&
    Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, providedCategory);
  const category: Category = isValidProvidedCategory
    ? (providedCategory as Category)
    : await categorizeExpense(name);

  const expense: Expense = {
    id: uuidv4(),
    year: parseInt(year),
    month: parseInt(month),
    name,
    amount: parseFloat(amount),
    category,
    paid: false,
    note,
    source: source ?? 'manual',
    createdAt: new Date().toISOString(),
  };

  await addExpense(expense);

  // Check budget warnings
  try {
    const [allExpenses, budgets, settings, warnLog] = await Promise.all([
      getExpenses(),
      getBudgets(),
      getSettings(),
      getWarnLog(),
    ]);

    const monthExpenses = allExpenses.filter(
      (e) => e.year === expense.year && e.month === expense.month
    );
    const categorySpend = monthExpenses
      .filter((e) => e.category === category)
      .reduce((sum, e) => sum + e.amount, 0);

    const budget = budgets.find((b) => b.category === category);
    if (budget && categorySpend > budget.monthlyLimit && settings.reportEmail) {
      const warnKey = `${category}-${year}-${String(month).padStart(2, '0')}`;
      const lastWarn = warnLog[warnKey];
      const today = new Date().toISOString().slice(0, 10);

      if (!lastWarn || lastWarn < today) {
        await sendBudgetWarning(
          settings.reportEmail,
          category,
          categorySpend,
          budget.monthlyLimit,
          name
        );
        warnLog[warnKey] = today;
        await saveWarnLog(warnLog);
      }
    }
  } catch {
    // Don't fail the request if warning fails
  }

  return NextResponse.json(expense, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const updates = await req.json();
  await updateExpense(id, updates);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await deleteExpense(id);
  return NextResponse.json({ success: true });
}
