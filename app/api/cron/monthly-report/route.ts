import { NextRequest, NextResponse } from 'next/server';
import { getExpenses, getBudgets, getSettings } from '@/lib/blob';
import { sendMonthlyReport } from '@/lib/email';

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron or an authorized client
  const authHeader = req.headers.get('authorization');
  const cronHeader = req.headers.get('x-vercel-cron');
  const cronSecretParam = req.nextUrl.searchParams.get('cron_secret');
  const hasBearerAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const hasVercelCronAuth = !!cronHeader && cronSecretParam === process.env.CRON_SECRET;
  if (!hasBearerAuth && !hasVercelCronAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  // Report for previous month
  const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const prevMonth = reportMonth === 1 ? 12 : reportMonth - 1;
  const prevYear = reportMonth === 1 ? reportYear - 1 : reportYear;

  const [allExpenses, budgets, settings] = await Promise.all([
    getExpenses(),
    getBudgets(),
    getSettings(),
  ]);

  if (!settings.reportEmail) {
    return NextResponse.json({ error: 'No report email configured' }, { status: 400 });
  }

  const monthExpenses = allExpenses.filter(
    (e) => e.year === reportYear && e.month === reportMonth
  );
  const prevExpenses = allExpenses.filter(
    (e) => e.year === prevYear && e.month === prevMonth
  );

  await sendMonthlyReport(
    settings.reportEmail,
    reportYear,
    reportMonth,
    monthExpenses,
    prevExpenses,
    budgets,
    allExpenses
  );

  return NextResponse.json({ success: true, month: reportMonth, year: reportYear });
}
