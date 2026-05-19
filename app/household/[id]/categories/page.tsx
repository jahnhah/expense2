'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Category, Member } from '@/lib/types';
import { CATEGORY_COLORS } from '@/lib/types';
import { FormulaInput } from '@/components/transactions/formula-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Tag, Loader as Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const FORMULA_OPTIONS = [
  {
    value: 'proportional',
    label: 'Proportional',
    description: 'Each member defines a formula value; shares are proportional to those values',
  },
  {
    value: 'equal',
    label: 'Equal Split',
    description: 'Split equally among all participants regardless of formulas',
  },
];

const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#F59E0B' },
  { name: 'Rent', color: '#3B82F6' },
  { name: 'Electricity', color: '#EF4444' },
  { name: 'Internet', color: '#10B981' },
  { name: 'Cleaning', color: '#8B5CF6' },
  { name: 'Transport', color: '#EC4899' },
];

export default function CategoriesPage() {
  const params = useParams();
  const householdId = params.id as string;

  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [defaultFormulas, setDefaultFormulas] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: '',
    color: CATEGORY_COLORS[0],
    default_formula: 'proportional',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [catRes, membersRes] = await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('household_id', householdId)
        .order('name'),
      supabase
        .from('members')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at'),
    ]);
    setCategories(catRes.data ?? []);
    setMembers(membersRes.data ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setForm({
      name: '',
      color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length],
      default_formula: 'proportional',
    });
    setDefaultFormulas(
      Object.fromEntries(
        members.map((m) => [m.id, '1'])
      )
    );
    setEditCategory(null);
    setShowAdd(true);
  }

  function openEdit(c: Category) {
    setForm({ name: c.name, color: c.color, default_formula: c.default_formula });
    if (c.default_formulas) {
      setDefaultFormulas(c.default_formulas);
    } else {
      setDefaultFormulas(
        Object.fromEntries(
          members.map((m) => [m.id, '1'])
        )
      );
    }
    setEditCategory(c);
    setShowAdd(true);
  }

  async function quickAdd(name: string, color: string) {
    await supabase.from('categories').insert({
      household_id: householdId,
      name,
      color,
      default_formula: 'proportional',
    });
    load();
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);

    if (editCategory) {
      await supabase
        .from('categories')
        .update({
          name: form.name.trim(),
          color: form.color,
          default_formula: form.default_formula,
          default_formulas: form.default_formula === 'proportional' ? defaultFormulas : {},
        })
        .eq('id', editCategory.id);
    } else {
      await supabase.from('categories').insert({
        household_id: householdId,
        name: form.name.trim(),
        color: form.color,
        default_formula: form.default_formula,
        default_formulas: form.default_formula === 'proportional' ? defaultFormulas : {},
      });
    }

    setSaving(false);
    setShowAdd(false);
    load();
  }

  async function deleteCategory() {
    if (!deleteId) return;
    await supabase.from('categories').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} — each with a
            default splitting formula
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Category
        </Button>
      </div>

      {/* Quick add defaults */}
      {categories.length === 0 && (
        <div className="mb-6 p-4 rounded-xl border border-dashed border-border bg-muted/30">
          <p className="text-sm font-medium text-foreground mb-3">Quick add common categories:</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_CATEGORIES.map((dc) => (
              <button
                key={dc.name}
                onClick={() => quickAdd(dc.name, dc.color)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background hover:bg-accent text-sm font-medium transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dc.color }} />
                {dc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Tag className="w-8 h-8 text-muted-foreground" />
          </div>
          <h4 className="text-lg font-semibold text-foreground mb-2">No categories yet</h4>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Create expense categories like Food, Rent, or Electricity with default formula rules.
          </p>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => {
            const formulaOption = FORMULA_OPTIONS.find((f) => f.value === c.default_formula);
            return (
              <Card key={c.id} className="group">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${c.color}20` }}
                    >
                      <Tag className="w-5 h-5" style={{ color: c.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formulaOption?.label ?? c.default_formula}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(c.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div
                    className="mt-3 h-1 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
            <DialogDescription>
              Categories group expenses and define how shares are calculated by default.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                placeholder="e.g. Food, Rent, Electricity"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Default Formula</Label>
              <Select
                value={form.default_formula}
                onValueChange={(v) => setForm((f) => ({ ...f, default_formula: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMULA_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div>
                        <p className="font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  {form.default_formula === 'proportional'
                    ? 'Members enter a formula value (e.g. "2 * 7 days"). Shares are proportional to these values.'
                    : 'Transaction amount is split equally among all participants.'}
                </span>
              </div>
            </div>

            {/* Default formulas for proportional categories */}
            {form.default_formula === 'proportional' && members.length > 0 && (
              <div className="space-y-3">
                <Label>Default Member Formulas</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg border border-border bg-card p-3 flex items-center gap-3"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: m.color }}
                      >
                        {m.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                      </div>
                      <div className="w-32 shrink-0">
                        <FormulaInput
                          value={defaultFormulas[m.id] ?? '1'}
                          onChange={(v) => setDefaultFormulas((df) => ({ ...df, [m.id]: v }))}
                          placeholder="e.g. 2 * 7"
                          memberName={m.name}
                          className="w-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color }))}
                    className={cn(
                      'w-8 h-8 rounded-lg transition-all',
                      form.color === color
                        ? 'ring-2 ring-ring ring-offset-2 ring-offset-background scale-110'
                        : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : editCategory ? 'Save Changes' : 'Add Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the category. Existing transactions in this category will not be
              deleted but will become uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteCategory}
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
