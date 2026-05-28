'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useHousehold } from '@/lib/household-context';
import { getCurrencySymbol } from '@/lib/types';
import { useSettlements } from '@/hooks/use-settlements';
import { round } from '@/lib/formula-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ArrowRightLeft, Plus, ChevronDown, ChevronUp, Trash2, Loader as Loader2, ArrowRight, CircleCheck as CheckCircle2, TrendingUp, TrendingDown, Minus, HandCoins, History, Scale } from 'lucide-react';
import { format } from 'date-fns';

export default function SettlementsPage() {
  const params = useParams();
  const householdId = params.id as string;
  const household = useHousehold();
  const sym = getCurrencySymbol(household.currency);

  const { data, loading, error, recordSettlement, deleteSettlement } = useSettlements(householdId);

  // Record settlement modal
  const [showRecord, setShowRecord] = useState(false);
  const [recordFrom, setRecordFrom] = useState('');
  const [recordTo, setRecordTo] = useState('');
  const [recordAmount, setRecordAmount] = useState('');
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const [recordNote, setRecordNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete settlement
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Expanded debts
  const [expandedDebt, setExpandedDebt] = useState<string | null>(null);

  function openRecord(fromId?: string, toId?: string, amount?: number) {
    setRecordFrom(fromId ?? '');
    setRecordTo(toId ?? '');
    setRecordAmount(amount ? amount.toString() : '');
    setRecordDate(new Date().toISOString().split('T')[0]);
    setRecordNote('');
    setShowRecord(true);
  }

  async function saveSettlement() {
    if (!recordFrom || !recordTo || !recordAmount || recordFrom === recordTo) return;
    setSaving(true);
    await recordSettlement(recordFrom, recordTo, parseFloat(recordAmount), recordDate, recordNote);
    setSaving(false);
    setShowRecord(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deleteSettlement(deleteId);
    setDeleteId(null);
  }

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

  const {
    members,
    settlements,
    balances,
    suggestedSettlements,
    pairwiseDebts,
    totalSettled,
    totalOutstanding,
    resolutionProgress,
  } = data;

  const memberMap = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" />
            Settlements
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track unpaid balances, understand debts, and record reimbursements
          </p>
        </div>
        <Button onClick={() => openRecord()} className="gap-2" disabled={members.length < 2}>
          <Plus className="w-4 h-4" />
          Record Payment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total Outstanding
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {sym}{round(totalOutstanding, 2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Across {pairwiseDebts.length} debt{pairwiseDebts.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total Settled
            </p>
            <p className="text-2xl font-bold text-emerald-500 mt-1">
              {sym}{round(totalSettled, 2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {settlements.length} payment{settlements.length !== 1 ? 's' : ''} recorded
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Resolution Progress
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {resolutionProgress}%
            </p>
            <Progress value={resolutionProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Member Balances */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <HandCoins className="w-4 h-4" />
            Member Balances
          </CardTitle>
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
                    Reimbursed
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Received
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                      No members yet
                    </td>
                  </tr>
                ) : (
                  balances.map((b) => {
                    const isPositive = b.balance > 0.01;
                    const isNegative = b.balance < -0.01;

                    return (
                      <tr
                        key={b.memberId}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ backgroundColor: b.color }}
                            >
                              {b.name[0]}
                            </div>
                            <span className="font-medium text-foreground">{b.name}</span>
                          </div>
                        </td>
                        <td className="text-right px-3 py-3.5 text-foreground font-mono text-xs">
                          {sym}{b.totalPaid}
                        </td>
                        <td className="text-right px-3 py-3.5 text-foreground font-mono text-xs">
                          {sym}{b.totalOwed}
                        </td>
                        <td className="text-right px-3 py-3.5 text-foreground font-mono text-xs">
                          {sym}{b.totalReimbursed}
                        </td>
                        <td className="text-right px-3 py-3.5 text-foreground font-mono text-xs">
                          {sym}{b.totalReceived}
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
                              {isPositive ? '+' : ''}{sym}{b.balance}
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

      {/* Unpaid Debts with Explanation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Unpaid Debts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pairwiseDebts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-foreground">All settled!</p>
              <p className="text-xs text-muted-foreground mt-1">No outstanding debts between members</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pairwiseDebts.map((debt) => {
                const key = `${debt.fromMemberId}->${debt.toMemberId}`;
                const isExpanded = expandedDebt === key;

                return (
                  <div
                    key={key}
                    className="rounded-xl border border-border bg-card"
                  >
                    <div className="flex items-center gap-3 p-4">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: debt.fromColor }}
                      >
                        {debt.fromName[0]}
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: debt.toColor }}
                      >
                        {debt.toName[0]}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {debt.fromName} owes {debt.toName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {debt.transactions.length} transaction{debt.transactions.length !== 1 ? 's' : ''}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-red-500">
                          {sym}{debt.amount}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-7"
                          onClick={() => openRecord(debt.fromMemberId, debt.toMemberId, debt.amount)}
                        >
                          <HandCoins className="w-3 h-3" />
                          Settle
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setExpandedDebt(isExpanded ? null : key)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border/50 pt-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                          Outstanding transaction details for {debt.fromName}
                        </p>
                        <div className="space-y-3">
                          {debt.transactions.map((tx, i) => (
                            <div key={i} className="rounded-xl border border-border/70 bg-muted/30 p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{tx.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(tx.date), 'MMM d, yyyy')}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-red-500">
                                    Remaining: {sym}{round(tx.remaining, 2)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {debt.fromName} still owes {debt.toName} for this transaction
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs text-muted-foreground">
                                <div className="rounded-lg border border-border/50 bg-background p-3">
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Computed Share</p>
                                  <p className="mt-1 font-semibold text-foreground font-mono">
                                    {sym}{round(tx.computedShare, 2)}
                                  </p>
                                </div>
                                <div className="rounded-lg border border-border/50 bg-background p-3">
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Paid Amount</p>
                                  <p className="mt-1 font-semibold text-foreground font-mono">
                                    {sym}{round(tx.paidAmount, 2)}
                                  </p>
                                </div>
                                <div className="rounded-lg border border-border/50 bg-background p-3">
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Remaining</p>
                                  <p className="mt-1 font-semibold text-red-500 font-mono">
                                    {sym}{round(tx.remaining, 2)}
                                  </p>
                                </div>
                              </div>

                              {tx.payments.length > 0 ? (
                                <div className="mt-4 border-t border-border/50 pt-3 text-sm text-foreground">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Payments</p>
                                  <div className="space-y-2">
                                    {tx.payments.map((payment, j) => (
                                      <div key={j} className="rounded-lg border border-border/50 bg-background p-3">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                          <p className="font-medium">
                                            {sym}{round(payment.amount, 2)} paid by {debt.fromName}
                                          </p>
                                          <span className="text-xs text-muted-foreground">
                                            {format(new Date(payment.date), 'MMM d, yyyy')}
                                          </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {payment.note || 'Recorded settlement payment'}
                                        </p>
                                        <div className="text-[11px] text-muted-foreground mt-2 flex flex-wrap gap-2">
                                          {payment.settlementId && <span>Settlement: {payment.settlementId}</span>}
                                          {payment.transactionId && <span>Transaction: {payment.transactionId}</span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-4 text-sm text-muted-foreground">
                                  No payment records available for this transaction participant yet.
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between mt-3 pt-2 border-t border-border/50 text-xs">
                          <span className="text-muted-foreground">Total owed</span>
                          <span className="font-semibold text-foreground font-mono">
                            {sym}{round(debt.transactions.reduce((s, t) => s + t.share, 0), 2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suggested Settlements */}
      {suggestedSettlements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              Suggested Settlements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Minimum transfers needed to settle all debts
            </p>
            <div className="space-y-3">
              {suggestedSettlements.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-border bg-muted/20"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: memberMap.get(s.fromMemberId)?.color ?? '#6B7280' }}
                  >
                    {s.fromName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{s.fromName}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{s.toName}</span>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-foreground shrink-0">
                    {sym}{s.amount}
                  </span>
                  <Button
                    size="sm"
                    className="gap-1.5 h-7"
                    onClick={() => openRecord(s.fromMemberId, s.toMemberId, s.amount)}
                  >
                    <HandCoins className="w-3 h-3" />
                    Pay
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settlement History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="w-4 h-4" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <div className="text-center py-10">
              <History className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No payments recorded yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Record a reimbursement when someone pays another member
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {settlements.map((s) => {
                const from = memberMap.get(s.from_member_id);
                const to = memberMap.get(s.to_member_id);
                if (!from || !to) return null;

                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: from.color }}
                    >
                      {from.name[0]}
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: to.color }}
                    >
                      {to.name[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {from.name} paid {to.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(s.date), 'MMM d, yyyy')}
                        </span>
                        {s.note && (
                          <span className="text-xs text-muted-foreground truncate">
                            — {s.note}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-sm font-bold text-emerald-500 shrink-0">
                      {sym}{round(s.amount, 2)}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive transition-opacity shrink-0"
                      onClick={() => setDeleteId(s.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Modal */}
      <Dialog open={showRecord} onOpenChange={setShowRecord}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-primary" />
              Record Payment
            </DialogTitle>
            <DialogDescription>
              Record a reimbursement between two members to reduce their outstanding balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>From (payer)</Label>
              <select
                value={recordFrom}
                onChange={(e) => setRecordFrom(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select member</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>To (recipient)</Label>
              <select
                value={recordTo}
                onChange={(e) => setRecordTo(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select member</option>
                {members
                  .filter((m) => m.id !== recordFrom)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Amount ({sym})</Label>
              <Input
                type="number"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={recordAmount}
                onChange={(e) => setRecordAmount(e.target.value)}
                className="font-mono"
              />
              {recordFrom && recordTo && (() => {
                const debt = pairwiseDebts.find(
                  (d) => d.fromMemberId === recordFrom && d.toMemberId === recordTo
                );
                return (
                  <p className="text-xs text-muted-foreground">
                    {debt ? `Outstanding debt: ${sym}${debt.amount}` : 'No outstanding debt in this direction'}
                  </p>
                );
              })()}
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea
                placeholder="e.g. Bank transfer, cash, etc."
                value={recordNote}
                onChange={(e) => setRecordNote(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecord(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveSettlement}
              disabled={
                saving ||
                !recordFrom ||
                !recordTo ||
                !recordAmount ||
                recordFrom === recordTo ||
                isNaN(parseFloat(recordAmount)) ||
                parseFloat(recordAmount) <= 0
              }
            >
              {saving ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Record</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this payment from the history. Balances will be recalculated
              accordingly. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
