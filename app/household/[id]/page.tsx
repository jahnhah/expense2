'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useHousehold } from '@/lib/household-context';
import type { Member, Transaction, TransactionParticipant, Category, Settlement } from '@/lib/types';
import { OverviewCards } from '@/components/dashboard/overview-cards';
import { ExpenseCharts } from '@/components/dashboard/expense-charts';
import { BalanceTable } from '@/components/dashboard/balance-table';
import { computeMemberBalances, getCategoryBreakdown, getMemberSpendingBreakdown } from '@/lib/calculations';
import { Loader as Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const params = useParams();
  const householdId = params.id as string;
  const household = useHousehold();

  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [participants, setParticipants] = useState<TransactionParticipant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [membersRes, txRes, catRes, settlementsRes] = await Promise.all([
      supabase.from('members').select('*').eq('household_id', householdId).order('created_at'),
      supabase
        .from('transactions')
        .select('*')
        .eq('household_id', householdId)
        .order('date', { ascending: false }),
      supabase.from('categories').select('*').eq('household_id', householdId).order('name'),
      supabase.from('settlements').select('*').eq('household_id', householdId).order('date', { ascending: false }),
    ]);

    const txIds = (txRes.data ?? []).map((t) => t.id);
    let parts: TransactionParticipant[] = [];

    if (txIds.length > 0) {
      const { data } = await supabase
        .from('transaction_participants')
        .select('*')
        .in('transaction_id', txIds);
      parts = data ?? [];
    }

    setMembers(membersRes.data ?? []);
    setTransactions(txRes.data ?? []);
    setCategories(catRes.data ?? []);
    setParticipants(parts);
    setSettlements(settlementsRes.data ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const balances = computeMemberBalances(members, transactions, participants, settlements);
  const categoryMap = new Map(categories.map((c) => [c.id, { name: c.name, color: c.color }]));
  const categoryData = getCategoryBreakdown(transactions, categoryMap);
  const memberSpending = getMemberSpendingBreakdown(members, transactions, participants);
  const totalExpenses = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overview of expenses and balances
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      <OverviewCards
        totalExpenses={totalExpenses}
        transactionCount={transactions.length}
        memberCount={members.length}
        balances={balances}
        currency={household.currency}
      />

      <ExpenseCharts
        categoryData={categoryData}
        memberSpending={memberSpending}
        currency={household.currency}
      />

      <BalanceTable balances={balances} currency={household.currency} householdId={householdId} />
    </div>
  );
}
