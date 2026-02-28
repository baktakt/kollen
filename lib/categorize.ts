import Anthropic from '@anthropic-ai/sdk';
import type { Category } from '@/types';
import { CATEGORIES } from '@/types';
import { getCategoryMap, setCategoryForName } from './blob';

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function categorizeExpense(name: string): Promise<Category> {
  // Check cache first
  const map = await getCategoryMap();
  if (map[name]) return map[name];

  // Call Claude Haiku
  try {
    const message = await getClient().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: `Expense name: "${name}"`,
        },
      ],
      system:
        'You are categorizing Swedish household expenses. Reply with ONLY one of these keys, nothing else: housing, transport, utilities, insurance, food, family, savings, other',
    });

    const text =
      message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    const category = CATEGORIES.includes(text as Category)
      ? (text as Category)
      : 'other';

    // Cache result
    await setCategoryForName(name, category);
    return category;
  } catch {
    return 'other';
  }
}

export async function categorizeExpenseBatch(
  names: string[]
): Promise<Record<string, Category>> {
  const map = await getCategoryMap();
  const result: Record<string, Category> = {};
  const unknown: string[] = [];

  for (const name of names) {
    if (map[name]) {
      result[name] = map[name];
    } else {
      unknown.push(name);
    }
  }

  // Categorize unknown names
  for (const name of unknown) {
    result[name] = await categorizeExpense(name);
  }

  return result;
}
