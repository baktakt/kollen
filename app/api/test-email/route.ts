import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSettings } from '@/lib/blob';
import { Resend } from 'resend';
import { getFromAddress } from '@/lib/email';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await getSettings();
  if (!settings.reportEmail) {
    return NextResponse.json({ error: 'No email configured' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Email service is not configured' },
      { status: 500 },
    );
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: getFromAddress(),
      to: settings.reportEmail,
      subject: 'Kollen — Testmail',
      html: '<p>Allt fungerar! Din Kollen-installation skickar e-post korrekt.</p>',
    });
  } catch (error) {
    console.error('Failed to send test email via Resend:', error);
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 502 },
    );
  }
  return NextResponse.json({ success: true });
}
