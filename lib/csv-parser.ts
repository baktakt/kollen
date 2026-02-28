export type ParsedTransaction = {
  date: string;
  description: string;
  amount: number;
  balance?: number;
};

type BankFormat = 'seb' | 'swedbank' | 'handelsbanken' | 'nordea' | 'unknown';

function detectFormat(headers: string[]): BankFormat {
  const h = headers.map((x) => x.toLowerCase().trim());
  if (h.includes('bokföringsdag') && h.includes('beskrivning'))
    return 'handelsbanken';
  if (h.includes('datum') && h.includes('text') && h.includes('belopp'))
    return 'seb';
  if (h.includes('transaktionsdatum') && h.includes('beskrivning'))
    return 'swedbank';
  if (h.includes('transaktionsdato') || h.includes('forklaringer'))
    return 'nordea';
  return 'unknown';
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if ((ch === ',' || ch === ';') && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function parseAmount(raw: string): number {
  // Handle Swedish number format: "1 234,56" or "1234.56" or "-1 234,56"
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^0-9.\-]/g, '');
  return parseFloat(cleaned) || 0;
}

function parseSEB(lines: string[][]): ParsedTransaction[] {
  // Date | Text | Amount | Balance
  return lines
    .map((cols) => ({
      date: cols[0] ?? '',
      description: cols[1] ?? '',
      amount: parseAmount(cols[2] ?? '0'),
      balance: parseAmount(cols[3] ?? '0'),
    }))
    .filter((t) => t.date && t.description && t.amount !== 0);
}

function parseSwedbank(lines: string[][]): ParsedTransaction[] {
  // TransDate | BookDate | Description | Category | Amount | Balance
  return lines
    .map((cols) => ({
      date: cols[0] ?? '',
      description: cols[2] ?? '',
      amount: parseAmount(cols[4] ?? '0'),
      balance: parseAmount(cols[5] ?? '0'),
    }))
    .filter((t) => t.date && t.description && t.amount !== 0);
}

function parseHandelsbanken(lines: string[][]): ParsedTransaction[] {
  // BookDate | TransDate | Description | Amount | Balance
  return lines
    .map((cols) => ({
      date: cols[0] ?? '',
      description: cols[2] ?? '',
      amount: parseAmount(cols[3] ?? '0'),
      balance: parseAmount(cols[4] ?? '0'),
    }))
    .filter((t) => t.date && t.description && t.amount !== 0);
}

function parseNordea(lines: string[][]): ParsedTransaction[] {
  // Date | PaymentDate | Description | Category | Amount | Balance
  return lines
    .map((cols) => ({
      date: cols[0] ?? '',
      description: cols[2] ?? '',
      amount: parseAmount(cols[4] ?? '0'),
      balance: parseAmount(cols[5] ?? '0'),
    }))
    .filter((t) => t.date && t.description && t.amount !== 0);
}

export function parseCSV(content: string): ParsedTransaction[] {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return [];

  const headerLine = parseCSVLine(lines[0]);
  const format = detectFormat(headerLine);

  const dataLines = lines.slice(1).map(parseCSVLine);

  switch (format) {
    case 'seb':
      return parseSEB(dataLines);
    case 'swedbank':
      return parseSwedbank(dataLines);
    case 'handelsbanken':
      return parseHandelsbanken(dataLines);
    case 'nordea':
      return parseNordea(dataLines);
    default:
      // Generic fallback: try to find date, description, amount columns
      return dataLines
        .map((cols) => ({
          date: cols[0] ?? '',
          description: cols[1] ?? '',
          amount: parseAmount(cols[2] ?? '0'),
        }))
        .filter((t) => t.date && t.description && t.amount !== 0);
  }
}

// Fuzzy match a transaction description to known expense names
export function fuzzyMatch(
  description: string,
  knownNames: string[]
): string | null {
  const desc = description.toLowerCase();

  for (const name of knownNames) {
    if (desc.includes(name.toLowerCase())) return name;
  }

  // Try partial word matching
  const descWords = desc.split(/\s+/);
  for (const name of knownNames) {
    const nameWords = name.toLowerCase().split(/\s+/);
    const match = nameWords.some((w) =>
      descWords.some((d) => d.startsWith(w) || w.startsWith(d))
    );
    if (match) return name;
  }

  return null;
}

export function transactionToExpenseName(description: string): string {
  // Clean up bank transaction descriptions
  return description
    .replace(/\*+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');
}
