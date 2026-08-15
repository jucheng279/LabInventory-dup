import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import {
  getBackups,
  createManualBackup,
  restoreBackup,
  deleteBackup,
  getBackupStats,
  type BackupStats,
} from '../services/backupService';

export const BACKUPS_KEY = ['workspace-backups'];

export function useBackups() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.id;

  return useQuery({
    queryKey: [...BACKUPS_KEY, workspaceId],
    queryFn: () => getBackups(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useCreateManualBackup() {
  const queryClient = useQueryClient();
  const { workspace } = useAuth();

  return useMutation({
    mutationFn: (label?: string) => {
      if (!workspace) throw new Error('No workspace');
      return createManualBackup(workspace.id, label);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKUPS_KEY });
    },
  });
}

export function useRestoreBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (backupId: string) => restoreBackup(backupId),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (backupId: string) => deleteBackup(backupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKUPS_KEY });
    },
  });
}

export function useBackupStats(backupId: string | null) {
  return useQuery<BackupStats>({
    queryKey: ['backup-stats', backupId],
    queryFn: () => getBackupStats(backupId!),
    enabled: !!backupId,
    staleTime: Infinity,
  });
}
