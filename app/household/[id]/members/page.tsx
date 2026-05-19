'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Member } from '@/lib/types';
import { MEMBER_COLORS } from '@/lib/types';
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
import { Plus, Pencil, Trash2, Users, Loader as Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function MemberInitials({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold shrink-0"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

export default function MembersPage() {
  const params = useParams();
  const householdId = params.id as string;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', color: MEMBER_COLORS[0] });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at');
    setMembers(data ?? []);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setForm({ name: '', color: MEMBER_COLORS[members.length % MEMBER_COLORS.length] });
    setEditMember(null);
    setShowAdd(true);
  }

  function openEdit(m: Member) {
    setForm({ name: m.name, color: m.color });
    setEditMember(m);
    setShowAdd(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);

    if (editMember) {
      await supabase
        .from('members')
        .update({ name: form.name.trim(), color: form.color })
        .eq('id', editMember.id);
    } else {
      await supabase.from('members').insert({
        household_id: householdId,
        name: form.name.trim(),
        color: form.color,
      });
    }

    setSaving(false);
    setShowAdd(false);
    load();
  }

  async function deleteMember() {
    if (!deleteId) return;
    await supabase.from('members').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Members</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} member{members.length !== 1 ? 's' : ''} in this household
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Member
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h4 className="text-lg font-semibold text-foreground mb-2">No members yet</h4>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Add the people who share this household to start tracking expenses.
          </p>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add First Member
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m) => (
            <Card key={m.id} className="group">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <MemberInitials name={m.name} color={m.color} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{m.name}</p>
                    <div
                      className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full text-xs text-white font-medium"
                      style={{ backgroundColor: m.color }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                      Member
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(m)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(m.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editMember ? 'Edit Member' : 'Add Member'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. JAHNHAH"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {MEMBER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color }))}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      form.color === color
                        ? 'ring-2 ring-ring ring-offset-2 ring-offset-background scale-110'
                        : 'hover:scale-105'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: form.color }}
                >
                  {form.name ? form.name[0]?.toUpperCase() : '?'}
                </div>
                <span className="text-sm text-muted-foreground">Preview</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : editMember ? 'Save Changes' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the member from the household. Existing transactions will not be
              affected but this member will no longer appear in new ones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
