'use client';

import { Card, CardContent } from '@/components/ui/card';
import { getCurrencySymbol } from '@/lib/types';
import type { MemberBalance } from '@/services/dashboard.service';
import { TrendingUp, TrendingDown, Receipt, Users, DollarSign } from 'lucide-react';
import { round } from '@/lib/formula-engine';

interface OverviewCardsProps {
  totalExpenses: number;
  transactionCount: number;
  memberCount: number;
  balances: MemberBalance[];
  currency: string;
}

export function OverviewCards({
  totalExpenses,
  transactionCount,
  memberCount,
  balances,
  currency,
}: OverviewCardsProps) {
  const sym = getCurrencySymbol(currency);
  const maxOwed = Math.max(...balances.map((b) => Math.abs(b.balance)), 0);
  const topDebtor = balances.reduce<MemberBalance | undefined>((min, b) => {
    if (b.balance >= 0) return min;

    if (!min || b.balance < min.balance) {
      return b;
    }

    return min;
  }, undefined);
  const topCreditor = balances.reduce<MemberBalance | undefined>((max, b) => {
    if (b.balance <= 0) return max;

    if (!max || b.balance > max.balance) {
      return b;
    }

    return max;
  }, undefined);

  const cards = [
    {
      label: 'Total Expenses',
      value: `${sym}${round(totalExpenses, 2).toLocaleString()}`,
      sublabel: `${transactionCount} transaction${transactionCount !== 1 ? 's' : ''}`,
      icon: DollarSign,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Members',
      value: memberCount,
      sublabel: 'in this household',
      icon: Users,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Largest Debt',
      value: topDebtor ? `${sym}${Math.abs(round(topDebtor.balance, 2))}` : `${sym}0`,
      sublabel: topDebtor ? `${topDebtor.name} owes` : 'Fully settled',
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Largest Credit',
      value: topCreditor ? `${sym}${round(topCreditor.balance, 2)}` : `${sym}0`,
      sublabel: topCreditor ? `${topCreditor.name} is owed` : 'Fully settled',
      icon: TrendingUp,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="border-border">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {card.label}
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.sublabel}</p>
              </div>
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-4.5 h-4.5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
