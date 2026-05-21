'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrencySymbol } from '@/lib/types';
import type { MemberBalance, SuggestedSettlement } from '@/services/dashboard.service';
import { round } from '@/lib/formula-engine';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ArrowRight, ArrowRightLeft } from 'lucide-react';

interface BalanceTableProps {
  balances: MemberBalance[];
  suggestedSettlements: SuggestedSettlement[];
  currency: string;
  householdId: string;
}

function MemberAvatar({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

export function BalanceTable({ balances, suggestedSettlements, currency, householdId }: BalanceTableProps) {
  const sym = getCurrencySymbol(currency);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Balance table */}
      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Member Balances</CardTitle>
            <Link
              href={`/household/${householdId}/settlements`}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ArrowRightLeft className="w-3 h-3" />
              View Settlements
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Member
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Paid
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Owes
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Settled
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                      No members yet
                    </td>
                  </tr>
                ) : (
                  balances.map((b) => {
                    const isPositive = b.balance > 0.01;
                    const isNegative = b.balance < -0.01;
                    const totalSettled = round(b.totalReimbursed + b.totalReceived, 2);

                    return (
                      <tr
                        key={b.memberId}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <MemberAvatar name={b.name} color={b.color} />
                            <span className="font-medium text-foreground">{b.name}</span>
                          </div>
                        </td>
                        <td className="text-right px-3 py-3.5 text-foreground font-mono text-xs">
                          {sym}{round(b.totalPaid, 2)}
                        </td>
                        <td className="text-right px-3 py-3.5 text-foreground font-mono text-xs">
                          {sym}{round(b.totalOwed, 2)}
                        </td>
                        <td className="text-right px-3 py-3.5 text-foreground font-mono text-xs">
                          {sym}{totalSettled}
                        </td>
                        <td className="text-right px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPositive ? (
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                            ) : isNegative ? (
                              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                            ) : (
                              <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                            <span
                              className={cn(
                                'font-semibold font-mono text-xs',
                                isPositive && 'text-emerald-500',
                                isNegative && 'text-red-500',
                                !isPositive && !isNegative && 'text-muted-foreground'
                              )}
                            >
                              {isPositive ? '+' : ''}
                              {sym}{round(b.balance, 2)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Suggested Settlements */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Suggested Settlements</CardTitle>
            <Link
              href={`/household/${householdId}/settlements`}
              className="text-xs text-primary hover:underline"
            >
              Settle
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {suggestedSettlements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-foreground">All settled!</p>
              <p className="text-xs text-muted-foreground mt-1">No payments needed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestedSettlements.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border/50"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: balances.find(b => b.memberId === s.fromMemberId)?.color ?? '#6B7280' }}
                  >
                    {s.fromName[0]}
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: balances.find(b => b.memberId === s.toMemberId)?.color ?? '#6B7280' }}
                  >
                    {s.toName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">
                      {s.fromName} → {s.toName}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0">
                    {sym}{s.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
