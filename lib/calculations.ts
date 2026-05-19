import type { Member, Transaction, TransactionParticipant, MemberBalance, Settlement } from './types';
import { round } from './formula-engine';

export interface BalanceMatrix {
  from: string;
  to: string;
  amount: number;
}

export function computeMemberBalances(
  members: Member[],
  transactions: Transaction[],
  participants: TransactionParticipant[],
  settlements: Settlement[] = []
): MemberBalance[] {
  const balanceMap = new Map<string, { totalPaid: number; totalOwed: number; totalReimbursed: number; totalReceived: number }>();

  for (const m of members) {
    balanceMap.set(m.id, { totalPaid: 0, totalOwed: 0, totalReimbursed: 0, totalReceived: 0 });
  }

  for (const tx of transactions) {
    if (tx.payer_id && balanceMap.has(tx.payer_id)) {
      const entry = balanceMap.get(tx.payer_id)!;
      entry.totalPaid += tx.amount;
    }

    const txParticipants = participants.filter((p) => p.transaction_id === tx.id);
    for (const p of txParticipants) {
      if (balanceMap.has(p.member_id)) {
        const entry = balanceMap.get(p.member_id)!;
        entry.totalOwed += p.computed_share ?? 0;
      }
    }
  }

  // Factor in settlements
  for (const s of settlements) {
    if (balanceMap.has(s.from_member_id)) {
      balanceMap.get(s.from_member_id)!.totalReimbursed += s.amount;
    }
    if (balanceMap.has(s.to_member_id)) {
      balanceMap.get(s.to_member_id)!.totalReceived += s.amount;
    }
  }

  return members.map((m) => {
    const entry = balanceMap.get(m.id) ?? { totalPaid: 0, totalOwed: 0, totalReimbursed: 0, totalReceived: 0 };
    // balance = what I paid - what I owe + what I received in settlements - what I sent in settlements
    const balance = entry.totalPaid - entry.totalOwed + entry.totalReceived - entry.totalReimbursed;
    return {
      member: m,
      totalPaid: round(entry.totalPaid, 2),
      totalOwed: round(entry.totalOwed, 2),
      totalReimbursed: round(entry.totalReimbursed, 2),
      totalReceived: round(entry.totalReceived, 2),
      balance: round(balance, 2),
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

// Compute pairwise debts between members (who owes whom, and why)
export interface PairwiseDebt {
  from: Member;
  to: Member;
  amount: number;
  transactions: {
    title: string;
    date: string;
    share: number;
  }[];
}

export function computePairwiseDebts(
  members: Member[],
  transactions: Transaction[],
  participants: TransactionParticipant[],
  settlements: Settlement[] = []
): PairwiseDebt[] {
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Track total debt and details per pair
  const debtTotals: Record<string, number> = {};
  const debtItems: Record<string, { title: string; date: string; share: number }[]> = {};

  for (const tx of transactions) {
    if (!tx.payer_id) continue;

    const txParts = participants.filter((p) => p.transaction_id === tx.id);

    for (const p of txParts) {
      if (p.member_id === tx.payer_id) continue;

      const key = `${p.member_id}->${tx.payer_id}`;
      if (!debtTotals[key]) {
        debtTotals[key] = 0;
        debtItems[key] = [];
      }

      debtTotals[key] += p.computed_share ?? 0;
      debtItems[key].push({
        title: tx.title,
        date: tx.date,
        share: p.computed_share ?? 0,
      });
    }
  }

  // Subtract settlements
  for (const s of settlements) {
    const key = `${s.from_member_id}->${s.to_member_id}`;
    if (debtTotals[key] !== undefined) {
      debtTotals[key] -= s.amount;
    }
  }

  // Build result
  const result: PairwiseDebt[] = [];
  const keys = Object.keys(debtTotals);

  for (const key of keys) {
    const total = debtTotals[key];
    if (total < 0.01) continue;

    const [fromId, toId] = key.split('->');
    const fromMember = memberMap.get(fromId);
    const toMember = memberMap.get(toId);
    if (!fromMember || !toMember) continue;

    result.push({
      from: fromMember,
      to: toMember,
      amount: round(total, 2),
      transactions: debtItems[key] ?? [],
    });
  }

  return result.sort((a, b) => b.amount - a.amount);
}
