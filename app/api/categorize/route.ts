import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { categorizeExpense } from '@/lib/categorize';
import { getCategoryMap, setCategoryForName } from '@/lib/blob';
import type { Category } from '@/types';
import { CATEGORIES } from '@/types';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const map = await getCategoryMap();
  return NextResponse.json(map);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

  const category = await categorizeExpense(name);
  return NextResponse.json({ name, category });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, category } = await req.json();
  if (!name || !category) {
    return NextResponse.json({ error: 'Missing name or category' }, { status: 400 });
  }
  if (!CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  await setCategoryForName(name, category as Category);
  return NextResponse.json({ success: true });
}
