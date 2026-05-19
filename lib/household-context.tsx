'use client';

import { createContext, useContext } from 'react';
import type { Household } from './types';

export const HouseholdContext = createContext<Household | null>(null);

export function useHousehold(): Household {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used inside HouseholdContext.Provider');
  return ctx;
}
