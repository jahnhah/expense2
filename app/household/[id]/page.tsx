'use client';

import { useParams } from 'next/navigation';
import { useHousehold } from '@/lib/household-context';
import { useDashboard } from '@/hooks/use-dashboard';
import { OverviewCards } from '@/components/dashboard/overview-cards';
import { ExpenseCharts } from '@/components/dashboard/expense-charts';
import { BalanceTable } from '@/components/dashboard/balance-table';
import { Loader as Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const params = useParams();
  const householdId = params.id as string;
  const household = useHousehold();
  const { data, loading, error, refresh } = useDashboard(householdId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive text-sm">
        {error ?? 'No data available'}
      </div>
    );
  }

  const { totalExpenses, transactions, members, balances, categoryBreakdown, memberSpending, suggestedSettlements } = data;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overview of expenses and balances
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
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
        categoryData={categoryBreakdown}
        memberSpending={memberSpending}
        currency={household.currency}
      />

      <BalanceTable
        balances={balances}
        suggestedSettlements={suggestedSettlements}
        currency={household.currency}
        householdId={householdId}
      />
    </div>
  );
}
