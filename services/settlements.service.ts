import { supabase } from '@/lib/supabase';
import type { Member, Settlement } from '@/lib/types';
import type { MemberBalance, SuggestedSettlement } from './dashboard.service';

export interface PairwiseDebt {
  fromMemberId: string;
  fromName: string;
  fromColor: string;
  toMemberId: string;
  toName: string;
  toColor: string;
  amount: number;
  transactions: { title: string; date: string; share: number }[];
}

export interface SettlementsData {
  members: Member[];
  settlements: Settlement[];
  // All aggregations computed by the database
  balances: MemberBalance[];
  suggestedSettlements: SuggestedSettlement[];
  pairwiseDebts: PairwiseDebt[];
  // DB-level aggregates
  totalExpenses: number;
  totalSettled: number;
  totalOutstanding: number;
  resolutionProgress: number;
}

export const SettlementsService = {
  getSettlementsData: async (householdId: string): Promise<SettlementsData> => {
    const [
      membersRes,
      settlementsRes,
      balancesRes,
      suggestedRes,
      pairwiseRes,
      totalExpensesRes,
    ] = await Promise.all([
      supabase.from('members').select('*').eq('household_id', householdId).order('created_at'),
      supabase
        .from('settlements')
        .select('*')
        .eq('household_id', householdId)
        .order('date', { ascending: false }),
      supabase.rpc('get_member_balances',       { p_household_id: householdId }),
      supabase.rpc('get_suggested_settlements', { p_household_id: householdId }),
      supabase.rpc('get_pairwise_debts',        { p_household_id: householdId }),
      supabase.rpc('get_total_expenses',        { p_household_id: householdId }),
    ]);

    const settlements: Settlement[] = settlementsRes.data ?? [];

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

    const suggestedSettlements: SuggestedSettlement[] = (suggestedRes.data ?? []).map((r: Record<string, unknown>) => ({
      fromMemberId: r.from_member_id as string,
      fromName:     r.from_name as string,
      toMemberId:   r.to_member_id as string,
      toName:       r.to_name as string,
      amount:       Number(r.amount),
    }));

    const pairwiseDebts: PairwiseDebt[] = (pairwiseRes.data ?? []).map((r: Record<string, unknown>) => ({
      fromMemberId: r.from_member_id as string,
      fromName:     r.from_name as string,
      fromColor:    r.from_color as string,
      toMemberId:   r.to_member_id as string,
      toName:       r.to_name as string,
      toColor:      r.to_color as string,
      amount:       Number(r.amount),
      transactions: (r.transactions as { title: string; date: string; share: number }[]) ?? [],
    }));

    const totalExpenses = Number((totalExpensesRes.data as { sum: number } | null)?.sum ?? 0);
    const totalSettled  = settlements.reduce((s, r) => s + r.amount, 0);
    const totalOutstanding = pairwiseDebts.reduce((s, d) => s + d.amount, 0);
    const resolutionProgress =
      totalOutstanding + totalSettled > 0
        ? Math.min(100, Math.round(((totalSettled / (totalOutstanding + totalSettled)) * 100) * 10) / 10)
        : 100;

    return {
      members:             membersRes.data ?? [],
      settlements,
      balances,
      suggestedSettlements,
      pairwiseDebts,
      totalExpenses,
      totalSettled,
      totalOutstanding,
      resolutionProgress,
    };
  },

  recordSettlement: async (
    householdId: string,
    fromMemberId: string,
    toMemberId: string,
    amount: number,
    date: string,
    note: string,
  ) => {
    return supabase.from('settlements').insert({
      household_id:   householdId,
      from_member_id: fromMemberId,
      to_member_id:   toMemberId,
      amount,
      date,
      note: note.trim(),
    });
  },

  deleteSettlement: async (id: string) => {
    return supabase.from('settlements').delete().eq('id', id);
  },
};
