'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useHousehold } from '@/lib/household-context';
import type { Member, Category, Transaction, TransactionParticipant } from '@/lib/types';
import { TransactionCard } from '@/components/transactions/transaction-card';
import { AddTransactionModal } from '@/components/transactions/add-transaction-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Receipt, Search, Loader as Loader2 } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/types';
import { round } from '@/lib/formula-engine';

export default function TransactionsPage() {
  const params = useParams();
  const householdId = params.id as string;
  const household = useHousehold();

  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [participants, setParticipants] = useState<TransactionParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [membersRes, catRes, txRes] = await Promise.all([
      supabase.from('members').select('*').eq('household_id', householdId).order('created_at'),
      supabase.from('categories').select('*').eq('household_id', householdId).order('name'),
      supabase
        .from('transactions')
        .select('*')
        .eq('household_id', householdId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
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
    setCategories(catRes.data ?? []);
    setTransactions(txRes.data ?? []);
    setParticipants(parts);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  async function deleteTransaction() {
    if (!deleteId) return;
    await supabase.from('transactions').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  }

  const filtered = transactions.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  const totalFiltered = filtered.reduce((sum, t) => sum + t.amount, 0);
  const sym = getCurrencySymbol(household.currency);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} · Total:{' '}
            <span className="font-semibold text-foreground">
              {sym}{round(transactions.reduce((s, t) => s + t.amount, 0), 2)}
            </span>
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="gap-2"
          disabled={members.length === 0}
        >
          <Plus className="w-4 h-4" />
          Add Transaction
        </Button>
      </div>

      {members.length === 0 && !loading && (
        <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
          Add members to your household before creating transactions.
        </div>
      )}

      {/* Search */}
      {transactions.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Receipt className="w-8 h-8 text-muted-foreground" />
          </div>
          <h4 className="text-lg font-semibold text-foreground mb-2">No transactions yet</h4>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Add your first expense and define how it should be split using formulas.
          </p>
          {members.length > 0 && (
            <Button onClick={() => setShowAdd(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Transaction
            </Button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          No transactions match &ldquo;{search}&rdquo;
        </div>
      ) : (
        <div className="space-y-3">
          {search && (
            <p className="text-sm text-muted-foreground">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} · {sym}{round(totalFiltered, 2)}
            </p>
          )}
          {filtered.map((tx) => (
            <TransactionCard
              key={tx.id}
              transaction={tx}
              members={members}
              categories={categories}
              participants={participants}
              currency={household.currency}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      <AddTransactionModal
        open={showAdd}
        onOpenChange={setShowAdd}
        householdId={householdId}
        members={members}
        categories={categories}
        currency={household.currency}
        onSaved={load}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this transaction and all its participant shares. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTransaction}
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
