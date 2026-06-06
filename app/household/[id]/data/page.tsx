'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DatabaseService } from '@/services/database.service';
import type {
  Member,
  Category,
  Transaction,
  TransactionParticipant,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Loader as Loader2, Download, Database, UploadCloud } from 'lucide-react';

interface BackupEntry {
  id: string;
  household_id: string;
  name: string;
  created_at: string;
  sql_dump: string;
}

export default function DataPage() {
  const params = useParams();
  const householdId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [selectedBackup, setSelectedBackup] = useState<BackupEntry | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    loadBackups();
  }, []);

  async function loadBackups() {
    setLoading(true);
    const { data } = await supabase
      .from('household_backups')
      .select('id, household_id, name, created_at, sql_dump')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    setBackups((data ?? []) as BackupEntry[]);
    setLoading(false);
  }

  function formatTimestamp(value: string) {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function defaultBackupName() {
    return `Backup ${formatTimestamp(new Date().toISOString())}`;
  }

  async function handleBackup() {
    setBackingUp(true);
    setImportError(null);

    const sqlDump = await DatabaseService.exportSqlDump(householdId);
    await supabase.from('household_backups').insert({
      household_id: householdId,
      name: backupName.trim() || defaultBackupName(),
      sql_dump: sqlDump,
    });

    setBackupName('');
    await loadBackups();
    setBackingUp(false);
  }

  async function performRestore(sqlDump: string) {
    setRestoring(true);
    setImportError(null);

    await DatabaseService.restoreSqlDump(householdId, sqlDump);
    await loadBackups();
    setRestoring(false);
    setRestoreDialogOpen(false);
    setSelectedBackup(null);
  }

  async function handleRestore(backup: BackupEntry) {
    setSelectedBackup(backup);
    setRestoreDialogOpen(true);
  }

  async function confirmRestore() {
    if (!selectedBackup) return;
    await performRestore(selectedBackup.sql_dump);
  }

  function downloadBackup(backup: BackupEntry) {
    const content = backup.sql_dump;
    const blob = new Blob([content], { type: 'application/sql' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${backup.name.replace(/[^a-z0-9-_]/gi, '_')}-${backup.created_at}.sql`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const sqlDump = await file.text();
      if (!sqlDump.trim()) {
        throw new Error('Empty SQL backup file');
      }
      await performRestore(sqlDump);
    } catch (error) {
      setImportError('Unable to import backup file. Please upload a valid SQL dump.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Database snapshots</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Create versioned SQL exports for this household, restore any saved dump, or import an SQL file.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-2">
            <Label htmlFor="backup-name">Snapshot name</Label>
            <Input
              id="backup-name"
              value={backupName}
              onChange={(event) => setBackupName(event.target.value)}
              placeholder={defaultBackupName()}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleBackup} disabled={backingUp} className="w-full">
              {backingUp ? 'Creating snapshot...' : 'Backup now'}
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={restoring}
              className="w-full"
            >
              <UploadCloud className="w-4 h-4 mr-2" />
              Restore from SQL file
            </Button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".sql,.txt"
        className="hidden"
        onChange={handleImportFile}
      />

      {importError ? (
        <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {importError}
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : backups.length === 0 ? (
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-muted-foreground" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">No snapshots yet</h2>
                  <p className="text-sm text-muted-foreground">
                    Create a backup to capture the current household state. You can restore it later
                    or download it as SQL.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          backups.map((backup, index) => {
            const version = backups.length - index;

            return (
              <Card key={backup.id}>
                <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground truncate">
                        {backup.name}
                      </h2>
                      <Badge variant="secondary">Version {version}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Created {formatTimestamp(backup.created_at)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {Math.max(0, backup.sql_dump.split('-- STATEMENT_END').length - 1)} statements
                      </Badge>
                      <Badge variant="outline">
                        {backup.sql_dump.length} chars
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => downloadBackup(backup)}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleRestore(backup)}
                      disabled={restoring}
                      className="gap-2"
                    >
                      <Database className="w-4 h-4" />
                      Restore
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore snapshot</AlertDialogTitle>
            <AlertDialogDescription>
              Restoring will replace the current household members, categories, transactions, and
              participant state with the selected snapshot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRestore}
              disabled={restoring}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {restoring ? 'Restoring...' : 'Restore snapshot'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

