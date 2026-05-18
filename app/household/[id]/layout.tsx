'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Household } from '@/lib/types';
import { HouseholdContext } from '@/lib/household-context';
import { Sidebar } from '@/components/layout/sidebar';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Loader as Loader2, Menu, Layers } from 'lucide-react';

export default function HouseholdLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('households')
        .select('*')
        .eq('id', params.id as string)
        .maybeSingle();

      if (!data) {
        router.push('/');
        return;
      }
      setHousehold(data);
      setLoading(false);
    }
    load();
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!household) return null;

  return (
    <HouseholdContext.Provider value={household}>
      <div className="flex min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex">
          <Sidebar household={household} />
        </div>

        {/* Mobile Sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-60 border-r border-border">
            <Sidebar household={household} />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm px-4 md:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="w-4 h-4" />
              </Button>
              <div className="md:hidden flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <span className="font-semibold text-sm text-foreground">{household.name}</span>
              </div>
              <h2 className="hidden md:block text-sm font-medium text-muted-foreground">
                {household.name}
              </h2>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </HouseholdContext.Provider>
  );
}
