/**
 * GoCardless Bank Account Data API (formerly Nordigen) client.
 * Docs: https://developer.gocardless.com/bank-account-data/overview
 *
 * This integration lets users connect their own bank accounts without
 * requiring a banking licence — personal access to your own accounts is
 * covered by GoCardless's free tier.
 */

const NORDIGEN_BASE = 'https://bankaccountdata.gocardless.com/api/v2';

export type NordigenInstitution = {
  id: string;
  name: string;
  bic: string;
  transaction_total_days: string;
  countries: string[];
  logo: string;
};

export type NordigenRequisition = {
  id: string;
  status: string;
  institution_id: string;
  accounts: string[];
  link: string;
  reference: string;
};

export type NordigenTransaction = {
  transactionId?: string;
  bookingDate: string;
  valueDate?: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  remittanceInformationUnstructured?: string;
  remittanceInformationStructuredArray?: { reference: string }[];
  creditorName?: string;
  debtorName?: string;
};

async function getNordigenToken(): Promise<string> {
  const secretId = process.env.NORDIGEN_SECRET_ID;
  const secretKey = process.env.NORDIGEN_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error('Nordigen credentials not configured');
  }

  const res = await fetch(`${NORDIGEN_BASE}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });

  if (!res.ok) {
    throw new Error(`Nordigen authentication failed: ${res.status}`);
  }

  const data = await res.json();
  return data.access as string;
}

export async function getInstitutions(
  country: string = 'SE'
): Promise<NordigenInstitution[]> {
  const token = await getNordigenToken();
  const res = await fetch(
    `${NORDIGEN_BASE}/institutions/?country=${encodeURIComponent(country)}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch institutions: ${res.status}`);
  }
  return res.json();
}

export async function createRequisition(
  institutionId: string,
  redirectUrl: string,
  reference: string
): Promise<NordigenRequisition> {
  const token = await getNordigenToken();

  // Create end-user agreement (90 days of history, 30-day access)
  const agreementRes = await fetch(`${NORDIGEN_BASE}/agreements/enduser/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      institution_id: institutionId,
      max_historical_days: 90,
      access_valid_for_days: 30,
      access_scope: ['transactions', 'details', 'balances'],
    }),
  });
  if (!agreementRes.ok) {
    throw new Error(`Failed to create agreement: ${agreementRes.status}`);
  }
  const agreement = await agreementRes.json();

  const reqRes = await fetch(`${NORDIGEN_BASE}/requisitions/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      redirect: redirectUrl,
      institution_id: institutionId,
      reference,
      agreement: agreement.id,
      user_language: 'SV',
    }),
  });
  if (!reqRes.ok) {
    throw new Error(`Failed to create requisition: ${reqRes.status}`);
  }
  return reqRes.json();
}

export async function getRequisition(id: string): Promise<NordigenRequisition> {
  const token = await getNordigenToken();
  const res = await fetch(`${NORDIGEN_BASE}/requisitions/${encodeURIComponent(id)}/`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to get requisition: ${res.status}`);
  }
  return res.json();
}

export async function deleteRequisition(id: string): Promise<void> {
  const token = await getNordigenToken();
  const res = await fetch(`${NORDIGEN_BASE}/requisitions/${encodeURIComponent(id)}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete requisition: ${res.status}`);
  }
}

export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{ booked: NordigenTransaction[]; pending: NordigenTransaction[] }> {
  const token = await getNordigenToken();

  const params = new URLSearchParams();
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);

  const qs = params.toString();
  const url = `${NORDIGEN_BASE}/accounts/${encodeURIComponent(accountId)}/transactions/${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to get transactions: ${res.status}`);
  }
  const data = await res.json();
  return data.transactions ?? { booked: [], pending: [] };
}

export function transactionDescription(tx: NordigenTransaction): string {
  return (
    tx.remittanceInformationUnstructured ??
    tx.creditorName ??
    tx.debtorName ??
    tx.transactionId ??
    'Okänt transaktion'
  );
}
