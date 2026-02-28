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

  const { reportEmail, reportDayOfMonth } = await req.json();
  const settings = await getSettings();

  await saveSettings({
    reportEmail: reportEmail ?? settings.reportEmail,
    reportDayOfMonth: reportDayOfMonth ?? settings.reportDayOfMonth,
  });

  return NextResponse.json({ success: true });
}
