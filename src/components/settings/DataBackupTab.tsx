import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/States';
import type { User } from '@/types';
import {
  Download,
  RotateCcw,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Plus,
  Lock,
  Calendar,
  Layers,
  HelpCircle,
  FileDown,
  Upload,
} from 'lucide-react';

interface BackupHistoryItem {
  id: string;
  name: string;
  status: 'success' | 'failed';
  type: 'manual' | 'automatic';
  startedAt: string;
  completedAt?: string;
  fileSize?: number;
  errorMessage?: string;
  initiatedBy: string;
  counts?: Record<string, number>;
}

interface DataBackupTabProps {
  currentUser?: User | null;
}

export function DataBackupTab({ currentUser }: DataBackupTabProps) {
  const isAdmin = currentUser?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<BackupHistoryItem[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Backup in progress state
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [backupProgressStep, setBackupProgressStep] = useState<string>('');

  // Restore Modal State
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupHistoryItem | null>(null);
  const [uploadedBackupPayload, setUploadedBackupPayload] = useState<any | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{
    safetyBackupName: string;
    restoredCounts: Record<string, number>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setActionError(null);
      const res = await fetch('/api/backup/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch {
      setActionError('Failed to load backup history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Create Backup
  async function handleCreateBackup() {
    setBackupInProgress(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      setBackupProgressStep('Reading live database tables...');
      await new Promise((r) => setTimeout(r, 250));

      setBackupProgressStep('Generating manifest & record counts...');
      await new Promise((r) => setTimeout(r, 250));

      setBackupProgressStep('Validating JSON structure and data integrity...');

      const res = await fetch('/api/backup/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role || '',
        },
        body: JSON.stringify({
          initiatedBy: currentUser?.name || 'Administrator',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create backup.');
      }

      setActionSuccess(`Backup "${data.backup.name}" created and verified successfully!`);
      await fetchHistory();
    } catch (err: any) {
      setActionError(err.message || 'Backup generation failed.');
      await fetchHistory();
    } finally {
      setBackupInProgress(false);
      setBackupProgressStep('');
    }
  }

  // Direct Live Database Download (validates before download)
  function handleDownloadLiveBackup() {
    window.location.href = '/api/backup/export';
  }

  // Download specific backup by ID
  function handleDownloadPastBackup(id: string) {
    window.location.href = `/api/backup/download?id=${encodeURIComponent(id)}`;
  }

  // Open Restore Modal for an existing backup from history
  async function openRestoreForHistory(item: BackupHistoryItem) {
    setSelectedBackup(item);
    setUploadedBackupPayload(null);
    setConfirmPhrase('');
    setRestoreResult(null);
    setActionError(null);
    setRestoreModalOpen(true);
    setPreviewLoading(true);

    try {
      const res = await fetch('/api/backup/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to inspect backup.');
      setPreviewData(data);
    } catch (err: any) {
      setActionError(`Could not preview backup: ${err.message}`);
      setRestoreModalOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  }

  // Handle local backup file upload for restore
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        setSelectedBackup(null);
        setUploadedBackupPayload(parsed);
        setConfirmPhrase('');
        setRestoreResult(null);
        setRestoreModalOpen(true);
        setPreviewLoading(true);

        const res = await fetch('/api/backup/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backup: parsed }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalid backup file structure.');
        setPreviewData(data);
      } catch (err: any) {
        setActionError(`Uploaded backup file error: ${err.message}`);
      } finally {
        setPreviewLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }

  // Execute Restore
  async function handleConfirmRestore() {
    if (confirmPhrase !== 'YES, RESTORE THIS BACKUP') {
      setActionError('Please enter the exact confirmation phrase: "YES, RESTORE THIS BACKUP".');
      return;
    }

    setRestoring(true);
    setActionError(null);

    try {
      const bodyPayload: any = {
        confirmation: confirmPhrase,
        initiatedBy: currentUser?.name || 'Administrator',
      };

      if (uploadedBackupPayload) {
        bodyPayload.backup = uploadedBackupPayload;
      } else if (selectedBackup) {
        bodyPayload.backupId = selectedBackup.id;
      }

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Restoration failed.');
      }

      setRestoreResult({
        safetyBackupName: data.safetyBackupName,
        restoredCounts: data.restoredCounts,
      });
      setActionSuccess('Database restored successfully! A safety backup of your previous live data was preserved.');
      fetchHistory();
    } catch (err: any) {
      setActionError(err.message || 'Restoration failed.');
    } finally {
      setRestoring(false);
    }
  }

  function formatDateTime(isoString?: string | null) {
    if (!isoString) return 'Never';
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  }

  function formatBytes(bytes?: number) {
    if (!bytes || bytes === 0) return '—';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  const lastSuccessfulBackup = history.find((h) => h.status === 'success');

  if (loading) {
    return <LoadingState label="Loading backup system…" />;
  }

  // Authorization check
  if (!isAdmin) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
          <Lock className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-steel-100">Administrator Access Required</h3>
        <p className="mt-2 text-sm text-steel-400 max-w-md mx-auto">
          Data Backup & Restoration contains sensitive business information. Only staff members with the{' '}
          <span className="font-semibold text-amber-400">Admin</span> role can create or restore backups.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {actionSuccess && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 shrink-0 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-red-200 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Status & Actions Card */}
      <Card>
        <CardHeader
          title="Data Backup"
          subtitle="Export all SteelWorks workshop data into structured, validated JSON backups"
          action={
            <Button variant="secondary" size="sm" onClick={fetchHistory}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          }
        />

        {/* 3 Metric Summary Cards */}
        <div className="grid grid-cols-1 gap-4 p-5 pt-3 md:grid-cols-3">
          {/* Card 1: Last Successful Backup */}
          <div className="rounded-xl border border-charcoal-700/60 bg-charcoal-800/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-steel-400">
                Last Successful Backup
              </span>
              <Calendar className="h-5 w-5 text-steel-500" />
            </div>
            <div className="mt-3 text-sm font-semibold text-steel-100">
              {formatDateTime(lastSuccessfulBackup?.completedAt || lastSuccessfulBackup?.startedAt)}
            </div>
            <p className="mt-2 truncate text-xs text-steel-500">
              {lastSuccessfulBackup?.name || 'No backups created yet'}
            </p>
          </div>

          {/* Card 2: Last Backup Status */}
          <div className="rounded-xl border border-charcoal-700/60 bg-charcoal-800/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-steel-400">
                Last Backup Status
              </span>
              <FileCheck className="h-5 w-5 text-steel-500" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              {history.length > 0 ? (
                history[0].status === 'success' ? (
                  <Badge variant="green">Successful</Badge>
                ) : (
                  <Badge variant="red">Failed</Badge>
                )
              ) : (
                <Badge variant="gray">Never Run</Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-steel-500">
              {history.length} backup{history.length === 1 ? '' : 's'} archived
            </p>
          </div>

          {/* Card 3: Storage Format */}
          <div className="rounded-xl border border-charcoal-700/60 bg-charcoal-800/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-steel-400">
                Backup Format
              </span>
              <Layers className="h-5 w-5 text-steel-500" />
            </div>
            <div className="mt-3 text-sm font-semibold text-steel-100">
              JSON with Manifest
            </div>
            <p className="mt-2 text-xs text-steel-500">
              Preserves relationships & primary keys
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 border-t border-charcoal-700/60 bg-charcoal-900/30 p-5">
          {/* Create Backup */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreateBackup}
            loading={backupInProgress}
            disabled={backupInProgress}
          >
            <Plus className="h-4 w-4" /> Create Backup
          </Button>

          {/* Download Backup */}
          <Button variant="secondary" size="sm" onClick={handleDownloadLiveBackup}>
            <Download className="h-4 w-4" /> Download Backup
          </Button>

          {/* Hidden File Input for Restore */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".json"
            className="hidden"
          />

          {/* Restore / Import */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="ml-auto"
          >
            <Upload className="h-4 w-4" /> Restore from File…
          </Button>
        </div>

        {/* Live Progress Banner */}
        {backupInProgress && (
          <div className="border-t border-charcoal-700/60 bg-amber-500/10 p-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              <div className="text-sm font-medium text-amber-300">
                Creating backup: <span className="font-normal text-steel-200">{backupProgressStep}</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Manual Google Drive Safe Storage Notice */}
      <div className="rounded-xl border border-charcoal-700/60 bg-charcoal-800/40 p-5">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-steel-200">
              100% Free Google Drive Storage Instructions
            </h4>
            <p className="text-xs text-steel-400 leading-relaxed">
              To store your backups safely in Google Drive without requiring any paid Google Cloud billing or setup:
            </p>
            <ol className="list-decimal list-inside text-xs text-steel-400 space-y-1 pt-1">
              <li>Click <strong className="text-amber-300">Download Backup</strong> to save the validated JSON package to your computer.</li>
              <li>Open your personal or business <strong className="text-steel-200">Google Drive</strong> in your browser.</li>
              <li>Create or open a folder named <code className="bg-charcoal-900 px-1 py-0.5 rounded text-amber-300">SteelWorks Backups</code>.</li>
              <li>Drag and drop the downloaded backup file into that folder.</li>
              <li>If you ever need to restore, download the file from your Google Drive and click <strong className="text-steel-200">Restore from File…</strong> above.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Backup History Table */}
      <Card>
        <CardHeader
          title="Backup History"
          subtitle="Chronological log of generated workshop backups with record counts"
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-charcoal-700 bg-charcoal-800/60 text-xs font-semibold uppercase tracking-wider text-steel-400">
              <tr>
                <th className="px-5 py-3">Date / Time</th>
                <th className="px-5 py-3">Backup Name & Manifest Counts</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Size</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-700/40">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-steel-500">
                    No backups generated yet. Click <strong>"Create Backup"</strong> or <strong>"Download Backup"</strong>.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-charcoal-800/40 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-steel-200">
                      {formatDateTime(item.completedAt || item.startedAt)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-steel-300">
                      <div className="font-medium text-steel-100">{item.name}</div>
                      {item.counts && (
                        <div className="text-[11px] text-steel-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-sans">
                          <span>{item.counts.customers ?? 0} customers</span>
                          <span>•</span>
                          <span>{item.counts.orders ?? 0} orders</span>
                          <span>•</span>
                          <span>{item.counts.inventoryItems ?? 0} inventory items</span>
                          <span>•</span>
                          <span>{item.counts.payments ?? 0} payments</span>
                          <span>•</span>
                          <span>{item.counts.workers ?? 0} staff</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {item.status === 'success' ? (
                        <Badge variant="green">Successful</Badge>
                      ) : (
                        <Badge variant="red">Failed</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-steel-400">
                      {formatBytes(item.fileSize)}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownloadPastBackup(item.id)}
                          title="Download Backup JSON"
                          className="rounded p-1.5 text-steel-400 hover:bg-charcoal-700 hover:text-steel-100 transition-colors"
                        >
                          <FileDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openRestoreForHistory(item)}
                          title="Restore this backup"
                          className="rounded p-1.5 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Controlled Recovery / Restore Modal */}
      <Modal
        open={restoreModalOpen}
        onClose={() => !restoring && setRestoreModalOpen(false)}
        title="Database Recovery & Restore"
        maxWidth="max-w-xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="secondary"
              onClick={() => setRestoreModalOpen(false)}
              disabled={restoring}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmRestore}
              disabled={confirmPhrase !== 'YES, RESTORE THIS BACKUP' || restoring || previewLoading}
              loading={restoring}
            >
              Confirm Restoration
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Safety Warning */}
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
              <div>
                <h5 className="text-sm font-semibold text-red-300">Explicit Administrator Confirmation Required</h5>
                <p className="mt-1 text-xs text-red-200/90 leading-relaxed">
                  Restoring will update live database records. To prevent accidental data loss,{' '}
                  <strong>a safety backup of your live database is automatically created</strong> before restoration begins.
                </p>
              </div>
            </div>
          </div>

          {previewLoading ? (
            <div className="py-8 text-center text-sm text-steel-400">
              <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              Inspecting and validating backup package structure…
            </div>
          ) : previewData ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-charcoal-700 bg-charcoal-900/60 p-3">
                <div className="text-xs font-semibold text-steel-300">Backup Information</div>
                <div className="mt-1 text-sm font-mono text-steel-100">{previewData.metadata.name}</div>
                <div className="mt-1 text-xs text-steel-400">
                  Created on: {formatDateTime(previewData.metadata.createdAt)} by{' '}
                  {previewData.metadata.initiatedBy || 'Administrator'}
                </div>
              </div>

              {/* Record counts preview */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-steel-400">
                  Entities Contained in Backup
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between rounded border border-charcoal-700/60 bg-charcoal-900/40 px-3 py-2">
                    <span className="text-steel-400">Customers:</span>
                    <span className="font-semibold text-steel-100">{previewData.manifest.counts.customers}</span>
                  </div>
                  <div className="flex justify-between rounded border border-charcoal-700/60 bg-charcoal-900/40 px-3 py-2">
                    <span className="text-steel-400">Orders:</span>
                    <span className="font-semibold text-steel-100">{previewData.manifest.counts.orders}</span>
                  </div>
                  <div className="flex justify-between rounded border border-charcoal-700/60 bg-charcoal-900/40 px-3 py-2">
                    <span className="text-steel-400">Inventory Items:</span>
                    <span className="font-semibold text-steel-100">{previewData.manifest.counts.inventoryItems}</span>
                  </div>
                  <div className="flex justify-between rounded border border-charcoal-700/60 bg-charcoal-900/40 px-3 py-2">
                    <span className="text-steel-400">Payments:</span>
                    <span className="font-semibold text-steel-100">{previewData.manifest.counts.payments}</span>
                  </div>
                  <div className="flex justify-between rounded border border-charcoal-700/60 bg-charcoal-900/40 px-3 py-2">
                    <span className="text-steel-400">Workers / Staff:</span>
                    <span className="font-semibold text-steel-100">{previewData.manifest.counts.workers}</span>
                  </div>
                  <div className="flex justify-between rounded border border-charcoal-700/60 bg-charcoal-900/40 px-3 py-2">
                    <span className="text-steel-400">Workshop Settings:</span>
                    <span className="font-semibold text-steel-100">{previewData.manifest.counts.workshopSettings}</span>
                  </div>
                </div>
              </div>

              {/* Confirmation phrase input */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-steel-300">
                  Type <strong className="font-mono text-red-400">YES, RESTORE THIS BACKUP</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="YES, RESTORE THIS BACKUP"
                  className="mt-1.5 w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/30"
                  disabled={restoring}
                />
              </div>

              {restoreResult && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  <div className="font-semibold">Restoration Complete!</div>
                  <div className="mt-1">Safety backup saved: {restoreResult.safetyBackupName}</div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
