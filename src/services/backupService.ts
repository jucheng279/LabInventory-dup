import { supabase } from '../lib/supabase';

export interface BackupSummary {
  id: string;
  workspace_id: string;
  created_by: string;
  backup_date: string;
  file_size_bytes: number;
  backup_type: 'auto' | 'manual';
  label: string | null;
  created_at: string;
}

export interface BackupStats {
  locations: number;
  boxes: number;
  cells: number;
  items: number;
  folders: number;
  projects: number;
}

export async function getBackups(workspaceId: string): Promise<BackupSummary[]> {
  const { data, error } = await supabase
    .from('workspace_backups')
    .select('id, workspace_id, created_by, backup_date, file_size_bytes, backup_type, label, created_at')
    .eq('workspace_id', workspaceId)
    .order('backup_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createManualBackup(
  workspaceId: string,
  label?: string
): Promise<{ backup_id: string; backup_date: string; file_size_bytes: number }> {
  const { data, error } = await supabase.rpc('create_workspace_backup', {
    p_workspace_id: workspaceId,
    p_backup_type: 'manual',
    p_label: label || null,
  });

  if (error) throw error;
  return data;
}

export async function restoreBackup(backupId: string): Promise<{ success: boolean; restored_from: string }> {
  const { data, error } = await supabase.rpc('restore_workspace_backup', {
    p_backup_id: backupId,
  });

  if (error) throw error;
  return data;
}

export async function deleteBackup(backupId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_workspace_backup', {
    p_backup_id: backupId,
  });

  if (error) throw error;
  return data;
}

export async function getBackupStats(backupId: string): Promise<BackupStats> {
  const { data, error } = await supabase.rpc('get_backup_stats', {
    p_backup_id: backupId,
  });

  if (error) throw error;
  return data as BackupStats;
}
