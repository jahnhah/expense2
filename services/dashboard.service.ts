import { supabase } from '@/lib/supabase';
import type { Member, Category, Transaction, Settlement } from '@/lib/types';

// ── Return types mirroring the DB function signatures ──────────────────────

export interface MemberBalance {
  memberId: string;
  name: string;
  color: string;
  totalPaid: number;
  totalOwed: number;
  totalReimbursed: number;
  totalReceived: number;
  balance: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  name: string;
  color: string;
  total: number;
}

export interface MemberSpending {
  memberId: string;
  name: string;
  color: string;
  paid: number;
  owed: number;
}

export interface SuggestedSettlement {
  fromMemberId: string;
  fromName: string;
  toMemberId: string;
  toName: string;
  amount: number;
}

export interface DashboardData {
  // Raw rows still needed by child pages / modals
  members: Member[];
  categories: Category[];
  transactions: Transaction[];
  settlements: Settlement[];
  // All aggregations computed by the database
  totalExpenses: number;
  balances: MemberBalance[];
  categoryBreakdown: CategoryBreakdown[];
  memberSpending: MemberSpending[];
  suggestedSettlements: SuggestedSettlement[];
}

// ── Service ────────────────────────────────────────────────────────────────

export const DashboardService = {
  /**
   * Loads everything the dashboard needs in parallel.
   * Aggregations (balances, breakdowns, settlements) are computed by
   * PostgreSQL functions — no JS arithmetic here.
   */
  getDashboardData: async (householdId: string): Promise<DashboardData> => {
    const [
      membersRes,
      txRes,
      catRes,
      settlementsRes,
      balancesRes,
      categoryBreakdownRes,
      memberSpendingRes,
      suggestedRes,
      totalExpenses,
    ] = await Promise.all([
      supabase.from('members').select('*').eq('household_id', householdId).order('created_at'),
      supabase
        .from('transactions')
        .select('*')
        .eq('household_id', householdId)
        .order('date', { ascending: false }),
      supabase.from('categories').select('*').eq('household_id', householdId).order('name'),
      supabase
        .from('settlements')
        .select('*')
        .eq('household_id', householdId)
        .order('date', { ascending: false }),
      supabase.rpc('get_member_balances',       { p_household_id: householdId }),
      supabase.rpc('get_category_breakdown',    { p_household_id: householdId }),
      supabase.rpc('get_member_spending',       { p_household_id: householdId }),
      supabase.rpc('get_suggested_settlements', { p_household_id: householdId }),
      supabase.rpc('get_total_expenses',        { p_household_id: householdId }), // New RPC for total expenses        
    ]);
    console.log('suggestedRes', suggestedRes);

    // Snake_case → camelCase mapping for RPC rows
    const balances: MemberBalance[] = (balancesRes.data ?? []).map((r: Record<string, unknown>) => ({
      memberId:        r.member_id as string,
      name:            r.name as string,
      color:           r.color as string,
      totalPaid:       Number(r.total_paid),
      totalOwed:       Number(r.total_owed),
      totalReimbursed: Number(r.total_reimbursed),
      totalReceived:   Number(r.total_received),
      balance:         Number(r.balance),
    }));

    const categoryBreakdown: CategoryBreakdown[] = (categoryBreakdownRes.data ?? []).map((r: Record<string, unknown>) => ({
      categoryId: r.category_id as string,
      name:       r.name as string,
      color:      r.color as string,
      total:      Number(r.total),
    }));

    const memberSpending: MemberSpending[] = (memberSpendingRes.data ?? []).map((r: Record<string, unknown>) => ({
      memberId: r.member_id as string,
      name:     r.name as string,
      color:    r.color as string,
      paid:     Number(r.paid),
      owed:     Number(r.owed),
    }));

    const suggestedSettlements: SuggestedSettlement[] = (suggestedRes.data ?? []).map((r: Record<string, unknown>) => ({
      fromMemberId: r.from_member_id as string,
      fromName:     r.from_name as string,
      toMemberId:   r.to_member_id as string,
      toName:       r.to_name as string,
      amount:       Number(r.amount),
    }));


    return {
      members:              membersRes.data    ?? [],
      categories:           catRes.data        ?? [],
      transactions:         txRes.data         ?? [],
      settlements:          settlementsRes.data ?? [],
      totalExpenses:        Number(totalExpenses.data ?? 0),
      balances,
      categoryBreakdown,
      memberSpending,
      suggestedSettlements,
    };
  },
};