import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getBankConnections, saveBankConnections } from '@/lib/blob';
import {
  createRequisition,
  getRequisition,
  deleteRequisition,
} from '@/lib/nordigen';
import type { BankConnection } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const connections = await getBankConnections();

  // Refresh status for pending connections
  const updated = await Promise.all(
    connections.map(async (c) => {
      if (c.status !== 'pending') return c;
      try {
        const req = await getRequisition(c.requisitionId);
        if (req.status === 'LN') {
          return { ...c, status: 'linked' as const, accountIds: req.accounts };
        }
        if (req.status === 'EX' || req.status === 'RJ') {
          return { ...c, status: 'expired' as const };
        }
      } catch {
        // Keep as pending if API call fails
      }
      return c;
    })
  );

  const changed = updated.some((c, i) => c.status !== connections[i].status);
  if (changed) await saveBankConnections(updated);

  return NextResponse.json(updated);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.NORDIGEN_SECRET_ID || !process.env.NORDIGEN_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Nordigen credentials not configured' },
      { status: 503 }
    );
  }

  const { institutionId, institutionName, institutionLogo, redirectUrl } =
    await req.json();

  if (!institutionId || !redirectUrl) {
    return NextResponse.json(
      { error: 'Missing institutionId or redirectUrl' },
      { status: 400 }
    );
  }

  const reference = uuidv4();

  try {
    const requisition = await createRequisition(
      institutionId,
      redirectUrl,
      reference
    );

    const connection: BankConnection = {
      id: reference,
      institutionId,
      institutionName: institutionName ?? institutionId,
      institutionLogo,
      requisitionId: requisition.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      accountIds: [],
    };

    const connections = await getBankConnections();
    connections.push(connection);
    await saveBankConnections(connections);

    return NextResponse.json({ link: requisition.link, connectionId: reference });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const connections = await getBankConnections();
  const conn = connections.find((c) => c.id === id);
  if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

  try {
    await deleteRequisition(conn.requisitionId);
  } catch {
    // Continue even if Nordigen deletion fails
  }

  await saveBankConnections(connections.filter((c) => c.id !== id));
  return NextResponse.json({ success: true });
}
