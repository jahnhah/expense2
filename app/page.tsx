'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Household } from '@/lib/types';
import { CURRENCIES } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Layers, Plus, Users, ArrowRight, Chrome as Home } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function HomePage() {
  const router = useRouter();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', currency: 'EUR' });
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadHouseholds();
  }, []);

  async function loadHouseholds() {
    setLoading(true);
    const { data } = await supabase
      .from('households')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setHouseholds(data);
      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (h) => {
          const { count } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true })
            .eq('household_id', h.id);
          counts[h.id] = count ?? 0;
        })
      );
      setMemberCounts(counts);
    }
    setLoading(false);
  }

  async function createHousehold() {
    if (!form.name.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('households')
      .insert({ name: form.name.trim(), currency: form.currency })
      .select()
      .single();

    if (data && !error) {
      setShowCreate(false);
      setForm({ name: '', currency: 'EUR' });
      router.push(`/household/${data.id}`);
    }
    setCreating(false);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Layers className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">CoShare</h1>
              <p className="text-xs text-muted-foreground">Shared Living Expenses</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Layers className="w-3.5 h-3.5" />
            Formula-based expense splitting
          </div>
          <h2 className="text-4xl font-bold text-foreground mb-4 tracking-tight">
            Manage shared living expenses
            <br />
            <span className="text-primary">with precision</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Not just equal splits — define custom formulas per transaction. Transparent
            calculations, real-time previews, clear dashboards.
          </p>
          <Button size="lg" onClick={() => setShowCreate(true)} className="gap-2 px-6">
            <Plus className="w-4 h-4" />
            Create a Household
          </Button>
        </div>
      </section>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-foreground">Your Households</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {households.length === 0
                ? 'No households yet'
                : `${households.length} household${households.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {households.length > 0 && (
            <Button
              onClick={() => setShowCreate(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              New Household
            </Button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : households.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Home className="w-8 h-8 text-muted-foreground" />
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-2">No households yet</h4>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Create your first household to start tracking shared expenses with formula-based
              splitting.
            </p>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Household
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {households.map((h) => (
              <Card
                key={h.id}
                className="group cursor-pointer hover:border-primary/50 transition-all hover:shadow-md"
                onClick={() => router.push(`/household/${h.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Home className="w-5 h-5 text-primary" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                  <CardTitle className="text-base mt-3">{h.name}</CardTitle>
                  <CardDescription className="text-xs">
                    Created{' '}
                    {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      <span>
                        {memberCounts[h.id] ?? 0} member
                        {memberCounts[h.id] !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {h.currency}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a Household</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Household Name</Label>
              <Input
                placeholder="e.g. Apartment CJ"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && createHousehold()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} — {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={createHousehold} disabled={creating || !form.name.trim()}>
              {creating ? 'Creating...' : 'Create Household'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
