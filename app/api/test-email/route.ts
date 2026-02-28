import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSettings } from '@/lib/blob';
import { Resend } from 'resend';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await getSettings();
  if (!settings.reportEmail) {
    return NextResponse.json({ error: 'No email configured' }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: 'Kollen <noreply@kollen.app>',
    to: settings.reportEmail,
    subject: 'Kollen — Testmail',
    html: '<p>Allt fungerar! Din Kollen-installation skickar e-post korrekt.</p>',
  });

  return NextResponse.json({ success: true });
}
