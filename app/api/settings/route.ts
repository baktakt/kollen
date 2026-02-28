import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSettings, saveSettings } from '@/lib/blob';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await getSettings());
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { reportEmail, reportDayOfMonth } = body ?? {};

  // Validate reportEmail if provided
  if (reportEmail !== undefined && typeof reportEmail !== 'string') {
    return NextResponse.json({ error: 'Invalid reportEmail: must be a string.' }, { status: 400 });
  }

  // Validate reportDayOfMonth if provided (must be integer between 1 and 28)
  let normalizedReportDayOfMonth: number | undefined = undefined;
  if (reportDayOfMonth !== undefined) {
    const day =
      typeof reportDayOfMonth === 'string'
        ? Number(reportDayOfMonth)
        : reportDayOfMonth;

    if (!Number.isInteger(day) || day < 1 || day > 28) {
      return NextResponse.json(
        { error: 'Invalid reportDayOfMonth: must be an integer between 1 and 28.' },
        { status: 400 },
      );
    }

    normalizedReportDayOfMonth = day;
  }

  const settings = await getSettings();

  await saveSettings({
    reportEmail: reportEmail ?? settings.reportEmail,
    reportDayOfMonth: normalizedReportDayOfMonth ?? settings.reportDayOfMonth,
  });

  return NextResponse.json({ success: true });
}
