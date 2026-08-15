import { supabase } from '../lib/supabase';
import type { TeamRole, TeamMember, AddMemberData } from '../types/database';

export type { TeamRole, TeamMember, AddMemberData } from '../types/database';

export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .not('workspace_id', 'is', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getCurrentTeamMember(authUserId: string): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getTeamMemberByEmail(email: string): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function addTeamMember(
  data: AddMemberData,
  invitedById: string,
  workspaceId: string
): Promise<TeamMember> {
  const existingMember = await getTeamMemberByEmail(data.email);

  if (existingMember) {
    if (existingMember.workspace_id !== null) {
      throw new Error('This user is already a member of a workspace');
    }

    const { data: member, error } = await supabase
      .from('team_members')
      .update({
        role: data.role,
        invited_by: invitedById,
        workspace_id: workspaceId,
      })
      .eq('id', existingMember.id)
      .select()
      .single();

    if (error) throw error;
    return member;
  }

  const { data: member, error } = await supabase
    .from('team_members')
    .insert({
      email: data.email.toLowerCase(),
      role: data.role,
      invited_by: invitedById,
      workspace_id: workspaceId,
    })
    .select()
    .single();

  if (error) throw error;
  return member;
}

export async function updateMemberRole(
  memberId: string,
  newRole: TeamRole
): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('team_members')
    .update({ role: newRole })
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeMember(memberId: string, formerWorkspaceId: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .update({
      workspace_id: null,
      role: null,
      invited_by: null,
      former_workspace_id: formerWorkspaceId,
    })
    .eq('id', memberId);

  if (error) throw error;
}

export async function updateDisplayName(
  memberId: string,
  displayName: string | null
): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('team_members')
    .update({ display_name: displayName?.trim() || null })
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function canManageMembers(currentRole: TeamRole | null): boolean {
  return currentRole === 'owner' || currentRole === 'manager';
}

export function canManageManagers(currentRole: TeamRole | null): boolean {
  return currentRole === 'owner';
}

export function canRemoveMember(
  currentRole: TeamRole | null,
  targetRole: TeamRole | null
): boolean {
  if (currentRole === 'owner') {
    return targetRole !== 'owner';
  }
  if (currentRole === 'manager' && targetRole === 'member') {
    return true;
  }
  return false;
}

export function canChangeRole(
  currentRole: TeamRole | null,
  targetRole: TeamRole | null,
  _newRole: TeamRole
): boolean {
  if (currentRole !== 'owner') return false;
  if (targetRole === 'owner') return false;
  return true;
}
