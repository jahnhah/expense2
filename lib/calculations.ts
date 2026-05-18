import type { Member, Transaction, TransactionParticipant, MemberBalance } from './types';
import { round } from './formula-engine';

export interface BalanceMatrix {
  from: string;
  to: string;
  amount: number;
}

export function computeMemberBalances(
  members: Member[],
  transactions: Transaction[],
  participants: TransactionParticipant[]
): MemberBalance[] {
  const balanceMap = new Map<string, { totalPaid: number; totalOwed: number }>();

  for (const m of members) {
    balanceMap.set(m.id, { totalPaid: 0, totalOwed: 0 });
  }

  for (const tx of transactions) {
    // Credit the payer
    if (tx.payer_id && balanceMap.has(tx.payer_id)) {
      const entry = balanceMap.get(tx.payer_id)!;
      entry.totalPaid += tx.amount;
    }

    // Debit each participant their share
    const txParticipants = participants.filter((p) => p.transaction_id === tx.id);
    for (const p of txParticipants) {
      if (balanceMap.has(p.member_id)) {
        const entry = balanceMap.get(p.member_id)!;
        entry.totalOwed += p.computed_share ?? 0;
      }
    }
  }

  return members.map((m) => {
    const entry = balanceMap.get(m.id) ?? { totalPaid: 0, totalOwed: 0 };
    return {
      member: m,
      totalPaid: round(entry.totalPaid, 2),
      totalOwed: round(entry.totalOwed, 2),
      balance: round(entry.totalPaid - entry.totalOwed, 2),
    };
  });
}

export function computeSettlements(balances: MemberBalance[]): BalanceMatrix[] {
  const settlements: BalanceMatrix[] = [];

  const debtors = balances
    .filter((b) => b.balance < -0.01)
    .map((b) => ({ id: b.member.id, amount: -b.balance }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter((b) => b.balance > 0.01)
    .map((b) => ({ id: b.member.id, amount: b.balance }))
    .sort((a, b) => b.amount - a.amount);

  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di];
    const creditor = creditors[ci];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.01) {
      settlements.push({
        from: debtor.id,
        to: creditor.id,
        amount: round(amount, 2),
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) di++;
    if (creditor.amount < 0.01) ci++;
  }

  return settlements;
}

export function getCategoryBreakdown(
  transactions: Transaction[],
  categoryMap: Map<string, { name: string; color: string }>
) {
  const breakdown = new Map<string, { name: string; color: string; total: number }>();

  for (const tx of transactions) {
    const catId = tx.category_id ?? 'uncategorized';
    const cat = categoryMap.get(catId) ?? { name: 'Uncategorized', color: '#6B7280' };

    if (!breakdown.has(catId)) {
      breakdown.set(catId, { name: cat.name, color: cat.color, total: 0 });
    }
    breakdown.get(catId)!.total += tx.amount;
  }

  return Array.from(breakdown.values()).sort((a, b) => b.total - a.total);
}

export function getMemberSpendingBreakdown(
  members: Member[],
  transactions: Transaction[],
  participants: TransactionParticipant[]
) {
  return members.map((m) => {
    const paid = transactions
      .filter((tx) => tx.payer_id === m.id)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const owed = participants
      .filter((p) => p.member_id === m.id)
      .reduce((sum, p) => sum + (p.computed_share ?? 0), 0);

    return {
      member: m,
      paid: round(paid, 2),
      owed: round(owed, 2),
    };
  });
}
