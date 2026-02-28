import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getBudgets, saveBudgets } from '@/lib/blob';
import type { Budget, Category } from '@/types';
import { CATEGORIES } from '@/types';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await getBudgets());
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { category, monthlyLimit } = body;

  if (!CATEGORIES.includes(category as Category) || typeof monthlyLimit !== 'number') {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }

  const budgets = await getBudgets();
  const existing = budgets.findIndex((b) => b.category === category);
  const budget: Budget = { category: category as Category, monthlyLimit };

  if (existing >= 0) {
    budgets[existing] = budget;
  } else {
    budgets.push(budget);
  }

  await saveBudgets(budgets);
  return NextResponse.json(budget);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');

  if (!category) return NextResponse.json({ error: 'Missing category' }, { status: 400 });

  const budgets = await getBudgets();
  await saveBudgets(budgets.filter((b) => b.category !== category));
  return NextResponse.json({ success: true });
}
