'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Member, Category } from '@/lib/types';
import { getCurrencySymbol } from '@/lib/types';
import { calculateShares, round } from '@/lib/formula-engine';
import { FormulaInput } from './formula-input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Calculator, ChevronDown, ChevronUp, Info } from 'lucide-react';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  members: Member[];
  categories: Category[];
  currency: string;
  onSaved: () => void;
}

interface ParticipantRow {
  memberId: string;
  formula: string;
  included: boolean;
}

export function AddTransactionModal({
  open,
  onOpenChange,
  householdId,
  members,
  categories,
  currency,
  onSaved,
}: AddTransactionModalProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [splitType, setSplitType] = useState<'proportional' | 'equal'>('proportional');
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize participants when members change or modal opens
  useEffect(() => {
    if (open && members.length > 0) {
      setParticipants(
        members.map((m) => ({
          memberId: m.id,
          formula: '1',
          included: true,
        }))
      );
      if (!payerId && members[0]) {
        setPayerId(members[0].id);
      }
    }
  }, [open, members]);

  // Apply category default formula when category changes
  useEffect(() => {
    if (categoryId) {
      const cat = categories.find((c) => c.id === categoryId);
      if (cat) {
        setSplitType(cat.default_formula === 'equal' ? 'equal' : 'proportional');
        
        // Apply default formulas if they exist
        if (cat.default_formula === 'proportional' && cat.default_formulas) {
          setParticipants((prev) =>
            prev.map((p) => ({
              ...p,
              formula: cat.default_formulas?.[p.memberId] ?? '1',
            }))
          );
        }
      }
    }
  }, [categoryId, categories]);

  const includedParticipants = participants.filter((p) => p.included);

  const shares = useMemo(() => {
    if (!amount || isNaN(parseFloat(amount))) return [];
    const amt = parseFloat(amount);
    return calculateShares(
      includedParticipants.map((p) => ({ memberId: p.memberId, formula: p.formula })),
      amt,
      splitType
    );
  }, [includedParticipants, amount, splitType]);

  const totalValue = shares.reduce((sum, s) => sum + s.computedValue, 0);
  const totalShare = shares.reduce((sum, s) => sum + s.computedShare, 0);
  const amountNum = parseFloat(amount) || 0;
  const diff = round(amountNum - totalShare, 2);

  function setParticipantFormula(memberId: string, formula: string) {
    setParticipants((ps) =>
      ps.map((p) => (p.memberId === memberId ? { ...p, formula } : p))
    );
  }

  function toggleParticipant(memberId: string) {
    setParticipants((ps) =>
      ps.map((p) => (p.memberId === memberId ? { ...p, included: !p.included } : p))
    );
  }

  function reset() {
    setTitle('');
    setAmount('');
    setPayerId(members[0]?.id ?? '');
    setCategoryId('');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setSplitType('proportional');
    setShowAdvanced(false);
    setParticipants(members.map((m) => ({ memberId: m.id, formula: '1', included: true })));
  }

  async function save() {
    if (!title.trim() || !amount || !payerId) return;
    setSaving(true);

    const amt = parseFloat(amount);

    const { data: txData, error } = await supabase
      .from('transactions')
      .insert({
        household_id: householdId,
        title: title.trim(),
        amount: amt,
        payer_id: payerId,
        category_id: categoryId || null,
        formula_override: splitType !== 'proportional' ? splitType : null,
        date,
        notes: notes.trim() || '',
      })
      .select()
      .single();

    if (error || !txData) {
      setSaving(false);
      return;
    }

    // Insert participants
    const calculatedShares = calculateShares(
      includedParticipants.map((p) => ({ memberId: p.memberId, formula: p.formula })),
      amt,
      splitType
    );

    if (calculatedShares.length > 0) {
      await supabase.from('transaction_participants').insert(
        calculatedShares.map((s) => ({
          transaction_id: txData.id,
          member_id: s.memberId,
          formula: includedParticipants.find((p) => p.memberId === s.memberId)?.formula ?? '1',
          computed_value: s.computedValue,
          computed_share: s.computedShare,
        }))
      );
    }

    setSaving(false);
    reset();
    onOpenChange(false);
    onSaved();
  }

  const memberMap = new Map(members.map((m) => [m.id, m]));

  const isValid =
    title.trim() !== '' &&
    amount !== '' &&
    !isNaN(parseFloat(amount)) &&
    parseFloat(amount) > 0 &&
    payerId !== '' &&
    includedParticipants.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Add Transaction
          </DialogTitle>
          <DialogDescription>
            Enter the expense details and define how it should be split among members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="e.g. Weekly groceries"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Amount ({getCurrencySymbol(currency)}) *</Label>
              <Input
                type="number"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Paid by *</Label>
              <Select value={payerId} onValueChange={setPayerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payer" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                        {m.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3.5 h-3.5 rounded-sm"
                          style={{ backgroundColor: c.color }}
                        />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Split type */}
          <div className="space-y-2">
            <Label>Split Method</Label>
            <Tabs
              value={splitType}
              onValueChange={(v) => setSplitType(v as 'proportional' | 'equal')}
            >
              <TabsList className="w-full">
                <TabsTrigger value="proportional" className="flex-1">
                  Formula-based
                </TabsTrigger>
                <TabsTrigger value="equal" className="flex-1">
                  Equal Split
                </TabsTrigger>
              </TabsList>
              <TabsContent value="proportional" className="mt-2">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Each member defines a participation formula. Shares are calculated proportionally.
                </div>
              </TabsContent>
              <TabsContent value="equal" className="mt-2">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Amount is split equally among all included participants.
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Participants & formulas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Participants & Formulas</Label>
              {amountNum > 0 && (
                <span className="text-xs text-muted-foreground font-mono">
                  Total: {getCurrencySymbol(currency)}{amountNum.toFixed(2)}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {members.map((m) => {
                const p = participants.find((x) => x.memberId === m.id);
                if (!p) return null;
                const share = shares.find((s) => s.memberId === m.id);
                const isIncluded = p.included;

                return (
                  <div
                    key={m.id}
                    className={cn(
                      'rounded-xl border transition-all',
                      isIncluded ? 'border-border bg-card' : 'border-border/40 bg-muted/20 opacity-60'
                    )}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <button
                        type="button"
                        onClick={() => toggleParticipant(m.id)}
                        className={cn(
                          'w-5 h-5 rounded-full border-2 shrink-0 transition-colors flex items-center justify-center',
                          isIncluded
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground/40'
                        )}
                      >
                        {isIncluded && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </button>

                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: m.color }}
                      >
                        {m.name[0]}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                      </div>

                      {isIncluded && share && amountNum > 0 && (
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-foreground">
                            {getCurrencySymbol(currency)}{share.computedShare.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">{share.percentage.toFixed(1)}%</p>
                        </div>
                      )}
                    </div>

                    {isIncluded && splitType === 'proportional' && (
                      <div className="px-3 pb-3">
                        <FormulaInput
                          value={p.formula}
                          onChange={(v) => setParticipantFormula(m.id, v)}
                          placeholder="e.g. 2 * 7"
                          totalValue={totalValue}
                          totalAmount={amountNum || undefined}
                          currency={currency}
                          memberName={m.name}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary row */}
            {amountNum > 0 && shares.length > 0 && (
              <div
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium',
                  Math.abs(diff) < 0.01
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                )}
              >
                <span>
                  {Math.abs(diff) < 0.01
                    ? 'Shares balance correctly'
                    : `Rounding difference: ${getCurrencySymbol(currency)}${Math.abs(diff)}`}
                </span>
                <span className="font-mono">
                  {getCurrencySymbol(currency)}{totalShare.toFixed(2)} / {amountNum.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Advanced / Notes */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showAdvanced ? 'Hide' : 'Add notes'}
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Optional notes about this transaction..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !isValid}>
            {saving ? 'Saving...' : 'Add Transaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
