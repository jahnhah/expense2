'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Receipt, Users, Tag, Chrome as Home, ChevronRight, Layers, Brain, Scale } from 'lucide-react';
import type { Household } from '@/lib/types';

interface SidebarProps {
  household: Household;
}

const navItems = [
  { label: 'Dashboard', href: '', icon: LayoutDashboard },
  { label: 'Transactions', href: '/transactions', icon: Receipt },
  { label: 'Settlements', href: '/settlements', icon: Scale },
  { label: 'Members', href: '/members', icon: Users },
  { label: 'Categories', href: '/categories', icon: Tag },
  { label: 'Expense Assistant', href: '/rag', icon: Brain },
  { label: 'Data', href: '/data', icon: Layers },
];

export function Sidebar({ household }: SidebarProps) {
  const pathname = usePathname();
  const base = `/household/${household.id}`;

  return (
    <aside className="flex flex-col w-60 border-r border-border bg-card min-h-screen shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Layers className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-base tracking-tight text-foreground">CoShare</span>
      </div>

      {/* Household selector */}
      <Link
        href="/"
        className="flex items-center gap-2.5 px-4 py-3 mx-2 mt-3 rounded-lg hover:bg-accent transition-colors group"
      >
        <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
          <Home className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Household</p>
          <p className="text-sm font-medium text-foreground truncate">{household.name}</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-2 pt-4 space-y-0.5">
        <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Menu
        </p>
        {navItems.map((item) => {
          const href = `${base}${item.href}`;
          const isActive =
            item.href === ''
              ? pathname === base || pathname === `${base}/`
              : pathname.startsWith(href);

          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Currency:{' '}
          <span className="font-semibold text-foreground">{household.currency}</span>
        </p>
      </div>
    </aside>
  );
}
