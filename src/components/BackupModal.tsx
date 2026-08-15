import { useState } from 'react';
import { X, Check, Loader2, HardDrive, Plus, RotateCcw, Trash2, Calendar, Clock, Bookmark, Timer } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBackups, useCreateManualBackup, useDeleteBackup, useRestoreBackup } from '../hooks/useBackups';
import type { BackupSummary } from '../services/backupService';
import RestoreBackupModal from './RestoreBackupModal';
import Portal from './Portal';

interface BackupModalProps {
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

interface BackupRowProps {
  backup: BackupSummary;
  canRestore: boolean;
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onRestore: () => void;
}

function BackupRow({ backup, canRestore, canDelete, isDeleting, onDelete, onDeleteConfirm, onDeleteCancel, onRestore }: BackupRowProps) {
  const formattedDate = new Date(backup.backup_date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const dayName = new Date(backup.backup_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
  });

  const isManual = backup.backup_type === 'manual';

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg shadow-sm border flex-shrink-0 ${isManual ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100'}`}>
          {isManual ? (
            <Bookmark size={14} className="text-amber-600" />
          ) : (
            <Calendar size={14} className="text-emerald-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900">{dayName}, {formattedDate}</p>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {isManual && backup.label && (
              <>
                <span className="text-xs text-amber-700 font-medium truncate max-w-[120px]">{backup.label}</span>
                <span className="text-xs text-gray-300">|</span>
              </>
            )}
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock size={10} /> {timeAgo(backup.created_at)}
            </span>
            <span className="text-xs text-gray-300">|</span>
            <span className="text-xs text-gray-400">{formatBytes(backup.file_size_bytes)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {canRestore && (
            <button
              onClick={onRestore}
              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              title="Restore this backup"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {canDelete && (
            isDeleting ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={onDelete}
                  className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={onDeleteCancel}
                  className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={onDeleteConfirm}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete this backup"
              >
                <Trash2 size={14} />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function BackupContent({ canManage, workspaceName }: { canManage: boolean; workspaceName: string }) {
  const { data: backups, isLoading } = useBackups();
  const createMutation = useCreateManualBackup();
  const deleteMutation = useDeleteBackup();
  const restoreMutation = useRestoreBackup();
  const [restoreTarget, setRestoreTarget] = useState<BackupSummary | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [labelValue, setLabelValue] = useState('');

  const autoBackups = backups?.filter(b => b.backup_type === 'auto') ?? [];
  const manualBackups = backups?.filter(b => b.backup_type === 'manual') ?? [];

  const handleCreateManual = async () => {
    try {
      const label = labelValue.trim() || undefined;
      await createMutation.mutateAsync(label);
      setLabelValue('');
      setShowLabelInput(false);
      setSuccessMessage('Manual backup saved');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      // handled by react-query
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch {
      // handled
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      await restoreMutation.mutateAsync(restoreTarget.id);
      setRestoreTarget(null);
      window.location.reload();
    } catch {
      // handled
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-gray-400"><Timer size={12} /></span>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Daily Auto-Backups
          </h3>
          <span className="text-xs text-gray-400 ml-auto">
            {autoBackups.length}/7 days
          </span>
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-200/70">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={18} className="animate-spin text-gray-400" />
              </div>
            ) : autoBackups.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Timer size={24} className="mx-auto text-gray-300 mb-1.5" />
                <p className="text-sm text-gray-500">No auto-backups yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  A daily backup will be created automatically at 3:00 AM UTC
                </p>
              </div>
            ) : (
              autoBackups.map((b) => (
                <BackupRow
                  key={b.id}
                  backup={b}
                  canRestore={canManage}
                  canDelete={false}
                  isDeleting={false}
                  onDelete={() => {}}
                  onDeleteConfirm={() => {}}
                  onDeleteCancel={() => {}}
                  onRestore={() => setRestoreTarget(b)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-gray-400"><Bookmark size={12} /></span>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Manual Backups
          </h3>
          <span className="text-xs text-gray-400 ml-auto">
            {manualBackups.length}/3 slots
          </span>
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
          {canManage && (
            <div className="px-4 py-3 border-b border-gray-200/70">
              {showLabelInput ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={labelValue}
                    onChange={(e) => setLabelValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateManual();
                      if (e.key === 'Escape') { setShowLabelInput(false); setLabelValue(''); }
                    }}
                    autoFocus
                    placeholder="Label (optional)"
                    disabled={createMutation.isPending}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-60 placeholder:text-gray-400"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateManual}
                      disabled={createMutation.isPending}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {createMutation.isPending ? (
                        <><Loader2 size={14} className="animate-spin" /> Saving...</>
                      ) : (
                        <><Bookmark size={14} /> Save Backup</>
                      )}
                    </button>
                    <button
                      onClick={() => { setShowLabelInput(false); setLabelValue(''); }}
                      disabled={createMutation.isPending}
                      className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowLabelInput(true)}
                  disabled={manualBackups.length >= 3}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus size={15} />
                  {manualBackups.length >= 3 ? 'All 3 Slots Used' : 'Save Manual Backup'}
                </button>
              )}
              {createMutation.isError && (
                <p className="text-xs text-red-600 mt-2">
                  {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create backup'}
                </p>
              )}
              {successMessage && (
                <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                  <Check size={12} /> {successMessage}
                </p>
              )}
            </div>
          )}

          <div className="divide-y divide-gray-200/70">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={18} className="animate-spin text-gray-400" />
              </div>
            ) : manualBackups.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Bookmark size={24} className="mx-auto text-gray-300 mb-1.5" />
                <p className="text-sm text-gray-500">No manual backups</p>
                <p className="text-xs text-gray-400 mt-1">
                  Save up to 3 permanent snapshots of your workspace
                </p>
              </div>
            ) : (
              manualBackups.map((b) => (
                <BackupRow
                  key={b.id}
                  backup={b}
                  canRestore={canManage}
                  canDelete={canManage}
                  isDeleting={deleteConfirmId === b.id}
                  onDelete={() => handleDelete(b.id)}
                  onDeleteConfirm={() => setDeleteConfirmId(b.id)}
                  onDeleteCancel={() => setDeleteConfirmId(null)}
                  onRestore={() => setRestoreTarget(b)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {restoreTarget && (
        <RestoreBackupModal
          backupId={restoreTarget.id}
          backupDate={restoreTarget.backup_date}
          workspaceName={workspaceName}
          onConfirm={handleRestore}
          onClose={() => setRestoreTarget(null)}
          isRestoring={restoreMutation.isPending}
        />
      )}
    </div>
  );
}

export default function BackupModal({ onClose }: BackupModalProps) {
  const { workspace, canManageTeam } = useAuth();

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-gray-900/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-50 rounded-xl">
                <HardDrive className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Manage Backup</h2>
                <p className="text-sm text-gray-500">View and manage workspace backups</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {workspace && (
              <BackupContent
                canManage={canManageTeam}
                workspaceName={workspace.name}
              />
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
