export interface Household {
  id: string;
  name: string;
  currency: string;
  created_at: string;
}

export interface Member {
  id: string;
  household_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  default_formula: string;
  color: string;
  default_formulas?: Record<string, string>;
  created_at: string;
}

export interface Transaction {
  id: string;
  household_id: string;
  title: string;
  amount: number;
  payer_id: string | null;
  category_id: string | null;
  formula_override: string | null;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface TransactionParticipant {
  id: string;
  transaction_id: string;
  member_id: string;
  formula: string;
  computed_value: number | null;
  computed_share: number | null;
  created_at: string;
}

export interface TransactionWithDetails extends Transaction {
  payer: Member | null;
  category: Category | null;
  participants: (TransactionParticipant & { member: Member })[];
}

export interface Settlement {
  id: string;
  household_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  date: string;
  note: string;
  created_at: string;
}

export interface MemberBalance {
  member: Member;
  totalPaid: number;
  totalOwed: number;
  totalReimbursed: number;
  totalReceived: number;
  balance: number;
}

export interface ParticipantFormula {
  memberId: string;
  formula: string;
  computedValue: number;
  computedShare: number;
  isValid: boolean;
  error?: string;
}

export const MEMBER_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#6366F1',
  '#84CC16',
];

export const CATEGORY_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

export const CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'MGA', symbol: 'Ar', name: 'Malagasy Ariary' },
];

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}
