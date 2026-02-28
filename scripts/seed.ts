/**
 * Seed script: uploads historical expense data to Vercel Blob.
 *
 * Usage:
 *   BLOB_READ_WRITE_TOKEN=xxx npx tsx scripts/seed.ts
 *
 * Prerequisites:
 *   - Place your historical expenses.json in the project root (added to .gitignore)
 *   - File must be an array of Expense objects matching the Expense type
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { put } from '@vercel/blob';

// We replicate the types here to avoid importing from src in a script context
type Category =
  | 'housing'
  | 'transport'
  | 'utilities'
  | 'insurance'
  | 'food'
  | 'family'
  | 'savings'
  | 'other';

type Expense = {
  id: string;
  year: number;
  month: number;
  name: string;
  amount: number;
  category: Category;
  paid: boolean;
  note?: string;
  source: 'manual' | 'bank_csv' | 'import';
  createdAt: string;
};

const VALID_CATEGORIES: Category[] = [
  'housing', 'transport', 'utilities', 'insurance',
  'food', 'family', 'savings', 'other',
];

function validate(data: unknown): Expense[] {
  if (!Array.isArray(data)) throw new Error('Root must be an array');

  return data.map((item: unknown, i: number) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Item ${i} is not an object`);
    }
    const e = item as Record<string, unknown>;

    const required = ['id', 'year', 'month', 'name', 'amount', 'category', 'paid', 'source', 'createdAt'];
    for (const field of required) {
      if (!(field in e)) throw new Error(`Item ${i} missing field: ${field}`);
    }

    if (typeof e.id !== 'string') throw new Error(`Item ${i}: id must be string`);
    if (typeof e.year !== 'number') throw new Error(`Item ${i}: year must be number`);
    if (typeof e.month !== 'number') throw new Error(`Item ${i}: month must be number`);
    if (e.month < 1 || e.month > 12) throw new Error(`Item ${i}: month must be 1-12`);
    if (typeof e.name !== 'string') throw new Error(`Item ${i}: name must be string`);
    if (typeof e.amount !== 'number') throw new Error(`Item ${i}: amount must be number`);
    if (!VALID_CATEGORIES.includes(e.category as Category)) {
      throw new Error(`Item ${i}: invalid category "${e.category}"`);
    }
    if (typeof e.paid !== 'boolean') throw new Error(`Item ${i}: paid must be boolean`);
    if (!['manual', 'bank_csv', 'import'].includes(e.source as string)) {
      throw new Error(`Item ${i}: invalid source "${e.source}"`);
    }

    return e as unknown as Expense;
  });
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error('❌ BLOB_READ_WRITE_TOKEN environment variable not set');
    process.exit(1);
  }

  const filePath = join(process.cwd(), 'expenses.json');
  let rawData: unknown;

  try {
    const content = readFileSync(filePath, 'utf-8');
    rawData = JSON.parse(content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error('❌ expenses.json not found in project root');
      console.error('   Place your historical data file at: expenses.json');
    } else {
      console.error('❌ Failed to parse expenses.json:', err);
    }
    process.exit(1);
  }

  console.log('🔍 Validating data...');
  let expenses: Expense[];
  try {
    expenses = validate(rawData);
  } catch (err) {
    console.error('❌ Validation failed:', err);
    process.exit(1);
  }

  console.log(`✓ Valid: ${expenses.length} expense records`);

  // Stats
  const years = [...new Set(expenses.map((e) => e.year))].sort();
  const categories = [...new Set(expenses.map((e) => e.category))];

  console.log(`  Year range: ${years[0]} – ${years[years.length - 1]}`);
  console.log(`  Categories: ${categories.join(', ')}`);

  // Build category map from expense data
  const categoryMap: Record<string, Category> = {};
  for (const e of expenses) {
    categoryMap[e.name] = e.category;
  }
  console.log(`  Unique names: ${Object.keys(categoryMap).length}`);

  // Upload expenses
  console.log('\n📤 Uploading expenses.json...');
  await put('data/expenses.json', JSON.stringify(expenses, null, 2), {
    access: 'public',
    contentType: 'application/json',
    token,
    addRandomSuffix: false,
  });
  console.log('  ✓ data/expenses.json uploaded');

  // Upload category map
  console.log('📤 Uploading categories.json...');
  await put('data/categories.json', JSON.stringify(categoryMap, null, 2), {
    access: 'public',
    contentType: 'application/json',
    token,
    addRandomSuffix: false,
  });
  console.log('  ✓ data/categories.json uploaded');

  console.log('\n✅ Seed complete!');
  console.log(`   ${expenses.length} expenses spanning ${years[0]}–${years[years.length - 1]}`);
  console.log(`   ${Object.keys(categoryMap).length} expense name→category mappings cached`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
