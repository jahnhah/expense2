'use client';

import { useState } from 'react';
import type { Member, Category, Transaction, TransactionParticipant } from '@/lib/types';
import { getCurrencySymbol } from '@/lib/types';
import { round } from '@/lib/formula-engine';
import { formatFormulaExplanation } from '@/lib/formula-engine';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Trash2, Tag, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface TransactionCardProps {
  transaction: Transaction;
  members: Member[];
  categories: Category[];
  participants: TransactionParticipant[];
  currency: string;
  onDelete: (id: string) => void;
}

export function TransactionCard({
  transaction,
  members,
  categories,
  participants,
  currency,
  onDelete,
}: TransactionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const payer = members.find((m) => m.id === transaction.payer_id);
  const category = categories.find((c) => c.id === transaction.category_id);
  const txParticipants = participants.filter((p) => p.transaction_id === transaction.id);

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const sym = getCurrencySymbol(currency);

  const totalValue = txParticipants.reduce((sum, p) => sum + (p.computed_value ?? 0), 0);

  return (
    <div className="rounded-xl border border-border bg-card hover:border-border/80 transition-all">
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        {/* Category color bar */}
        <div
          className="w-1 h-10 rounded-full shrink-0"
          style={{ backgroundColor: category?.color ?? '#6B7280' }}
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{transaction.title}</p>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {category && (
              <span
                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${category.color}20`, color: category.color }}
              >
                <Tag className="w-2.5 h-2.5" />
                {category.name}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {format(new Date(transaction.date), 'MMM d, yyyy')}
            </span>
            {payer && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: payer.color }}
                />
                Paid by {payer.name}
              </span>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-foreground">
            {sym}{round(transaction.amount, 2)}
          </p>
          <p className="text-xs text-muted-foreground">
            {txParticipants.length} participant{txParticipants.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {txParticipants.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(transaction.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded formula details */}
      {expanded && txParticipants.length > 0 && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Share Breakdown
          </p>
          <div className="space-y-2">
            {txParticipants.map((p) => {
              const member = memberMap.get(p.member_id);
              if (!member) return null;

              const explanationLines = formatFormulaExplanation(
                p.formula,
                p.computed_value ?? 0,
                totalValue,
                transaction.amount,
                currency
              );

              return (
                <div
                  key={p.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    <div className="mt-1 space-y-0.5">
                      {explanationLines.map((line, i) => (
                        <p key={i} className="text-xs font-mono text-muted-foreground">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">
                      {sym}{round(p.computed_share ?? 0, 2)}
                    </p>
                    {totalValue > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {round(((p.computed_value ?? 0) / totalValue) * 100, 1)}%
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Total check */}
          <div className="flex justify-between mt-3 pt-2 border-t border-border/50 text-xs text-muted-foreground">
            <span>Total shares</span>
            <span className="font-mono font-semibold text-foreground">
              {sym}{round(txParticipants.reduce((s, p) => s + (p.computed_share ?? 0), 0), 2)}
              {' '}/ {sym}{round(transaction.amount, 2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
