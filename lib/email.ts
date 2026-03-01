import { Resend } from 'resend';
import Anthropic from '@anthropic-ai/sdk';
import type { Expense, Budget, Category } from '@/types';
import { CATEGORY_LABELS } from '@/types';
import { computeForecast } from './forecast';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? '');
}
function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
];

function sumByCategory(expenses: Expense[]): Record<Category, number> {
  const result = {} as Record<Category, number>;
  for (const e of expenses) {
    result[e.category] = (result[e.category] ?? 0) + e.amount;
  }
  return result;
}

function formatSEK(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getFromAddress(): string {
  const domain = process.env.EMAIL_DOMAIN ?? 'kollen.app';
  return `Kollen <noreply@${domain}>`;
}

export async function generateMonthlyNarrative(
  month: string,
  totalSpend: number,
  prevTotal: number,
  categoryBreakdown: Record<string, number>,
  forecast: number
): Promise<string> {
  try {
    const breakdown = Object.entries(categoryBreakdown)
      .map(([cat, amt]) => `${cat}: ${formatSEK(amt)}`)
      .join(', ');

    const message = await getAnthropic().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Write a brief, friendly 2-3 sentence summary in Swedish for a personal finance monthly report.
Month: ${month}
Total spend: ${formatSEK(totalSpend)}
Previous month: ${formatSEK(prevTotal)} (${totalSpend > prevTotal ? '+' : ''}${Math.round(((totalSpend - prevTotal) / prevTotal) * 100)}%)
Breakdown: ${breakdown}
Forecast next month: ${formatSEK(forecast)}`,
        },
      ],
    });

    return message.content[0].type === 'text' ? message.content[0].text : '';
  } catch {
    return '';
  }
}

export async function sendMonthlyReport(
  to: string,
  year: number,
  month: number,
  expenses: Expense[],
  prevExpenses: Expense[],
  budgets: Budget[],
  allExpenses: Expense[]
): Promise<void> {
  const monthName = MONTH_NAMES[month - 1];
  const monthLabel = `${monthName} ${year}`;

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const prevTotal = prevExpenses.reduce((sum, e) => sum + e.amount, 0);
  const delta = total - prevTotal;
  const deltaPercent =
    prevTotal > 0 ? Math.round((delta / prevTotal) * 100) : 0;

  const byCat = sumByCategory(expenses);
  const forecast = computeForecast(allExpenses);

  // Top 3 expenses
  const top3 = [...expenses]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // Over-budget categories
  const overBudget = budgets.filter((b) => {
    const spent = byCat[b.category] ?? 0;
    return spent > b.monthlyLimit;
  });

  const narrative = await generateMonthlyNarrative(
    monthLabel,
    total,
    prevTotal,
    Object.fromEntries(
      Object.entries(byCat).map(([k, v]) => [
        CATEGORY_LABELS[k as Category] ?? k,
        v,
      ])
    ),
    forecast.estimated
  );

  const appUrl = process.env.NEXTAUTH_URL ?? 'https://kollen.vercel.app';

  const html = buildEmailHTML({
    monthLabel,
    total,
    prevTotal,
    delta,
    deltaPercent,
    byCat,
    top3,
    overBudget: overBudget.map((b) => ({
      category: b.category,
      limit: b.monthlyLimit,
      spent: byCat[b.category] ?? 0,
    })),
    forecast,
    narrative,
    appUrl,
  });

  await getResend().emails.send({
    from: getFromAddress(),
    to,
    subject: `Kollen — ${monthLabel}`,
    html,
  });
}

export async function sendBudgetWarning(
  to: string,
  category: Category,
  spent: number,
  limit: number,
  expenseName: string
): Promise<void> {
  const catLabel = CATEGORY_LABELS[category];
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#ef4444">⚠️ Budgetvarning — ${catLabel}</h2>
      <p>Kategorin <strong>${catLabel}</strong> har överskridit budgeten för denna månad.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb">Senaste utgift</td>
          <td style="padding:8px;border:1px solid #e5e7eb"><strong>${expenseName}</strong></td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb">Totalt spenderat</td>
          <td style="padding:8px;border:1px solid #e5e7eb;color:#ef4444"><strong>${formatSEK(spent)}</strong></td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb">Månadsbudget</td>
          <td style="padding:8px;border:1px solid #e5e7eb">${formatSEK(limit)}</td>
        </tr>
      </table>
      <a href="${process.env.NEXTAUTH_URL}/budgets" style="display:inline-block;padding:10px 20px;background:#6366f1;color:white;text-decoration:none;border-radius:6px">Öppna Kollen</a>
    </div>
  `;

  await getResend().emails.send({
    from: getFromAddress(),
    to,
    subject: `Kollen — Budgetvarning: ${catLabel}`,
    html,
  });
}

type EmailData = {
  monthLabel: string;
  total: number;
  prevTotal: number;
  delta: number;
  deltaPercent: number;
  byCat: Record<string, number>;
  top3: Expense[];
  overBudget: Array<{ category: Category; limit: number; spent: number }>;
  forecast: { estimated: number; min: number; max: number };
  narrative: string;
  appUrl: string;
};

function buildEmailHTML(data: EmailData): string {
  const { monthLabel, total, prevTotal, delta, deltaPercent, byCat, top3, overBudget, forecast, narrative, appUrl } = data;

  const catRows = Object.entries(byCat)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amt]) => {
      const barWidth = Math.min(100, Math.round((amt / total) * 100));
      return `
        <tr>
          <td style="padding:6px 8px;font-size:14px">${CATEGORY_LABELS[cat as Category] ?? cat}</td>
          <td style="padding:6px 8px;font-size:14px;text-align:right">${formatSEK(amt)}</td>
          <td style="padding:6px 8px;width:120px">
            <div style="background:#e5e7eb;border-radius:4px;height:8px">
              <div style="background:#6366f1;width:${barWidth}%;height:8px;border-radius:4px"></div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

  const top3Rows = top3.map((e, i) => `
    <tr>
      <td style="padding:6px 8px;font-size:14px">${i + 1}. ${e.name}</td>
      <td style="padding:6px 8px;font-size:14px;text-align:right">${formatSEK(e.amount)}</td>
    </tr>
  `).join('');

  const overBudgetSection = overBudget.length > 0 ? `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
      <h3 style="margin:0 0 8px;color:#ef4444;font-size:16px">⚠️ Överskridna budgetar</h3>
      ${overBudget.map(b => `
        <p style="margin:4px 0;font-size:14px">
          <strong>${CATEGORY_LABELS[b.category]}</strong>: ${formatSEK(b.spent)} / ${formatSEK(b.limit)}
        </p>
      `).join('')}
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:#6366f1;border-radius:12px 12px 0 0;padding:24px;text-align:center">
      <h1 style="color:white;margin:0;font-size:24px">Kollen</h1>
      <p style="color:#c7d2fe;margin:4px 0 0">${monthLabel}</p>
    </div>
    <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none">
      ${narrative ? `<p style="color:#374151;line-height:1.6;margin:0 0 20px">${narrative}</p>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div style="background:#f3f4f6;border-radius:8px;padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:bold;color:#111827">${formatSEK(total)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px">Totalt denna månad</div>
        </div>
        <div style="background:#f3f4f6;border-radius:8px;padding:16px;text-align:center">
          <div style="font-size:24px;font-weight:bold;color:${delta > 0 ? '#ef4444' : '#10b981'}">${delta > 0 ? '+' : ''}${formatSEK(delta)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px">vs förra månaden (${deltaPercent > 0 ? '+' : ''}${deltaPercent}%)</div>
        </div>
      </div>

      <h3 style="font-size:16px;color:#111827;margin:0 0 12px">Utgifter per kategori</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        ${catRows}
      </table>

      <h3 style="font-size:16px;color:#111827;margin:0 0 12px">Topp 3 utgifter</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        ${top3Rows}
      </table>

      ${overBudgetSection}

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0">
        <h3 style="margin:0 0 8px;color:#1d4ed8;font-size:16px">Prognos nästa månad</h3>
        <p style="margin:0;font-size:20px;font-weight:bold;color:#1e40af">${formatSEK(forecast.estimated)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#3b82f6">Intervall: ${formatSEK(forecast.min)} – ${formatSEK(forecast.max)}</p>
      </div>

      <div style="text-align:center;margin-top:24px">
        <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;font-weight:500">Öppna Kollen</a>
      </div>
    </div>
    <div style="text-align:center;padding:16px;font-size:12px;color:#9ca3af">
      Kollen — Din personliga ekonomiöversikt
    </div>
  </div>
</body>
</html>
  `;
}
