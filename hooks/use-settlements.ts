'use client';

import { useState, useEffect, useCallback } from 'react';
import { SettlementsService, type SettlementsData } from '@/services/settlements.service';

interface UseSettlementsResult {
  data: SettlementsData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  recordSettlement: (
    fromMemberId: string,
    toMemberId: string,
    amount: number,
    date: string,
    note: string,
  ) => Promise<void>;
  deleteSettlement: (id: string) => Promise<void>;
}

export function useSettlements(householdId: string): UseSettlementsResult {
  const [data, setData] = useState<SettlementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await SettlementsService.getSettlementsData(householdId);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settlements data');
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  const recordSettlement = useCallback(
    async (fromMemberId: string, toMemberId: string, amount: number, date: string, note: string) => {
      await SettlementsService.recordSettlement(householdId, fromMemberId, toMemberId, amount, date, note);
      await load();
    },
    [householdId, load],
  );

  const deleteSettlement = useCallback(
    async (id: string) => {
      await SettlementsService.deleteSettlement(id);
      await load();
    },
    [load],
  );

  return { data, loading, error, refresh: load, recordSettlement, deleteSettlement };
}
