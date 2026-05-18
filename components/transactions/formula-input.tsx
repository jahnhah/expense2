'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { evaluateFormula } from '@/lib/formula-engine';
import { cn } from '@/lib/utils';
import { CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Calculator } from 'lucide-react';

interface FormulaInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  totalValue?: number;
  totalAmount?: number;
  currency?: string;
  memberName?: string;
  className?: string;
}

export function FormulaInput({
  value,
  onChange,
  placeholder = 'e.g. 2 * 7',
  totalValue,
  totalAmount,
  currency = 'EUR',
  memberName,
  className,
}: FormulaInputProps) {
  const [result, setResult] = useState<ReturnType<typeof evaluateFormula> | null>(null);

  useEffect(() => {
    if (value.trim()) {
      setResult(evaluateFormula(value));
    } else {
      setResult(null);
    }
  }, [value]);

  const share =
    result?.isValid && totalValue && totalValue > 0 && totalAmount
      ? (result.value / totalValue) * totalAmount
      : null;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="relative">
        <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'pl-8 pr-8 font-mono text-sm',
            result && !result.isValid && value.trim() && 'border-destructive focus-visible:ring-destructive'
          )}
        />
        {value.trim() && result && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {result.isValid ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
            )}
          </div>
        )}
      </div>

      {/* Live explanation */}
      {value.trim() && result && (
        <div
          className={cn(
            'text-xs rounded-md px-3 py-2 space-y-0.5',
            result.isValid
              ? 'bg-emerald-500/8 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-destructive/8 border border-destructive/20 text-destructive'
          )}
        >
          {result.isValid ? (
            <>
              <div className="font-mono">
                {result.explanation}
              </div>
              {totalValue !== undefined && totalValue > 0 && totalAmount && (
                <div className="font-mono opacity-80">
                  {result.value.toFixed(2)} / {totalValue.toFixed(2)} ={' '}
                  {((result.value / totalValue) * 100).toFixed(1)}%
                </div>
              )}
              {share !== null && (
                <div className="font-semibold">
                  → {currency} {share.toFixed(2)}
                </div>
              )}
            </>
          ) : (
            <div>{result.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
