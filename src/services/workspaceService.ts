import { supabase } from '../lib/supabase';
import type { Workspace } from '../types/database';

export type { Workspace } from '../types/database';

export async function getWorkspaceForUser(): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createWorkspace(
  name: string,
  ownerId: string
): Promise<Workspace> {
  const { data, error } = await supabase
    .from('workspaces')
    .insert({
      name,
      owner_id: ownerId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function linkOwnerToWorkspace(
  teamMemberId: string,
  workspaceId: string
): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .update({ workspace_id: workspaceId })
    .eq('id', teamMemberId);

  if (error) throw error;
}

export async function updateWorkspaceName(
  workspaceId: string,
  name: string
): Promise<Workspace> {
  const { data, error } = await supabase
    .from('workspaces')
    .update({ name })
    .eq('id', workspaceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
