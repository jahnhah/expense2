'use client';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrencySymbol } from '@/lib/types';
import type { CategoryBreakdown, MemberSpending } from '@/services/dashboard.service';
import { round } from '@/lib/formula-engine';

interface ExpenseChartsProps {
  categoryData: CategoryBreakdown[];
  memberSpending: MemberSpending[];
  currency: string;
}

export function ExpenseCharts({ categoryData, memberSpending, currency }: ExpenseChartsProps) {
  const sym = getCurrencySymbol(currency);

  const barData = memberSpending.map((ms) => ({
    name: ms.name,
    Paid: round(ms.paid, 2),
    Share: round(ms.owed, 2),
    fill: ms.color,
  }));

  const pieData = categoryData.filter((c) => c.total > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* By Category */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Expenses by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {pieData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
              No data yet
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    strokeWidth={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${sym}${round(value, 2)}`, '']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {pieData.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-xs text-foreground truncate max-w-[80px]">
                        {cat.name}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      {sym}{round(cat.total, 2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* By Member */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Paid vs. Owed per Member</CardTitle>
        </CardHeader>
        <CardContent>
          {barData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${sym}${v}`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${sym}${round(value, 2)}`,
                    name,
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
                <Bar dataKey="Paid" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Share" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
