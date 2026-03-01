export type Category =
  | 'housing'
  | 'transport'
  | 'utilities'
  | 'insurance'
  | 'food'
  | 'family'
  | 'savings'
  | 'other';

export type Expense = {
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

export type Budget = {
  category: Category;
  monthlyLimit: number;
};

export type Settings = {
  reportEmail: string;
  reportDayOfMonth: number;
};

export type BankConnection = {
  id: string;
  institutionId: string;
  institutionName: string;
  institutionLogo?: string;
  requisitionId: string;
  status: 'pending' | 'linked' | 'expired';
  createdAt: string;
  lastSyncAt?: string;
  accountIds: string[];
};

export type CategoryMap = Record<string, Category>;

export type WarnLog = Record<string, string>; // "category-YYYY-MM" -> ISO date

export const CATEGORIES: Category[] = [
  'housing',
  'transport',
  'utilities',
  'insurance',
  'food',
  'family',
  'savings',
  'other',
];

export const CATEGORY_LABELS: Record<Category, string> = {
  housing: 'Bostad',
  transport: 'Transport',
  utilities: 'Tjänster',
  insurance: 'Försäkring',
  food: 'Mat & Hushåll',
  family: 'Familj',
  savings: 'Sparande',
  other: 'Övrigt',
};

export const CATEGORY_COLORS: Record<Category, string> = {
  housing: '#6366f1',
  transport: '#f59e0b',
  utilities: '#10b981',
  insurance: '#3b82f6',
  food: '#ef4444',
  family: '#8b5cf6',
  savings: '#14b8a6',
  other: '#6b7280',
};

export const DEFAULT_CATEGORY_MAP: CategoryMap = {
  SBAB: 'housing',
  Tibber: 'utilities',
  'Lerum Energi': 'utilities',
  'VA och Avlopp': 'utilities',
  Bahnhof: 'utilities',
  DinEl: 'utilities',
  Statoil: 'transport',
  'Avbetalning Tesla': 'transport',
  'Bilförsäkring Fiat': 'transport',
  'Bilförsäkring Tesla': 'transport',
  Trängselskatt: 'transport',
  Trygghansa: 'insurance',
  'Sector Alarm': 'insurance',
  AEA: 'insurance',
  Unionen: 'insurance',
  Mat: 'food',
  Hunddagis: 'food',
  'Månadspeng Elly': 'family',
  'Månadspeng Olle': 'family',
  CSN: 'family',
  Semester: 'savings',
  'Till sparkonto': 'savings',
};
