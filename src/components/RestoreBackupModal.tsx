import { useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw, X, MapPin, Box, FlaskConical, FolderOpen, Clipboard } from 'lucide-react';
import { useBackupStats } from '../hooks/useBackups';
import Portal from './Portal';

interface RestoreBackupModalProps {
  backupId: string;
  backupDate: string;
  workspaceName: string;
  onConfirm: () => void;
  onClose: () => void;
  isRestoring: boolean;
}

export default function RestoreBackupModal({
  backupId,
  backupDate,
  workspaceName,
  onConfirm,
  onClose,
  isRestoring,
}: RestoreBackupModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const { data: stats, isLoading: loadingStats } = useBackupStats(backupId);

  const formattedDate = new Date(backupDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const canConfirm = confirmText.toLowerCase() === workspaceName.toLowerCase() && !isRestoring;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto py-8 px-4 bg-gray-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-red-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Restore Backup</h2>
                <p className="text-sm text-red-600">This action cannot be undone</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isRestoring}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-colors disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 leading-relaxed">
                All current workspace data will be permanently replaced with the backup
                from <span className="font-semibold">{formattedDate}</span>. This includes all
                locations, boxes, cells, inventory items, folders, and history.
              </p>
            </div>

            {loadingStats ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : stats ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 px-1">
                  Backup Contents
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard icon={<MapPin size={14} />} label="Locations" value={stats.locations} />
                  <StatCard icon={<Box size={14} />} label="Boxes" value={stats.boxes} />
                  <StatCard icon={<FlaskConical size={14} />} label="Items" value={stats.items} />
                  <StatCard icon={<FolderOpen size={14} />} label="Sheets" value={stats.folders} />
                  {(stats.projects ?? 0) > 0 && (
                    <StatCard icon={<Clipboard size={14} />} label="Projects" value={stats.projects} />
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-2 px-1">
                  {stats.cells.toLocaleString()} grid cells will be restored
                </p>
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Type <span className="font-semibold text-gray-900">"{workspaceName}"</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canConfirm) onConfirm();
                }}
                disabled={isRestoring}
                placeholder="Type workspace name..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-60 placeholder:text-gray-400"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                disabled={isRestoring}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={!canConfirm}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isRestoring ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} />
                    Restore Backup
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
      <div className="text-gray-400">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
