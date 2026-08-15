import { supabase } from '../lib/supabase';
import type { ProjectPrivacyData, ProjectAccessLevel } from '../types/database';

export type { ProjectPrivacyData, ProjectAccessLevel };

export const projectPrivacyService = {
  async getProjectPrivacy(projectId: string): Promise<ProjectPrivacyData | null> {
    const { data: settings, error: settingsError } = await supabase
      .from('project_privacy_settings')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (settingsError) throw settingsError;
    if (!settings) return null;

    const { data: accessList, error: accessError } = await supabase
      .from('project_access_list')
      .select('*')
      .eq('project_id', projectId);

    if (accessError) throw accessError;

    return { settings, accessList: accessList || [] };
  },

  async upsertProjectPrivacy(
    projectId: string,
    ownerId: string,
    privacyMode: string,
    ownerOnlyDelete: boolean,
    accessEntries: { team_member_id: string; access_level: string }[] = []
  ): Promise<void> {
    const { error } = await supabase.rpc('upsert_project_privacy', {
      p_project_id: projectId,
      p_owner_id: ownerId,
      p_privacy_mode: privacyMode,
      p_owner_only_delete: ownerOnlyDelete,
      p_access_entries: accessEntries,
    });

    if (error) throw error;
  },

  async resolveProjectAccess(projectId: string, teamMemberId: string): Promise<ProjectAccessLevel> {
    const { data, error } = await supabase.rpc('resolve_project_access', {
      p_project_id: projectId,
      p_team_member_id: teamMemberId,
    });

    if (error) throw error;
    return data as ProjectAccessLevel;
  },

  async batchResolveProjectAccess(
    projectIds: string[],
    teamMemberId: string
  ): Promise<Record<string, ProjectAccessLevel>> {
    if (projectIds.length === 0) return {};

    const { data, error } = await supabase.rpc('batch_resolve_project_access', {
      p_project_ids: projectIds,
      p_team_member_id: teamMemberId,
    });

    if (error) throw error;

    const map: Record<string, ProjectAccessLevel> = {};
    if (data) {
      for (const row of data) {
        map[row.project_id] = row.access_level as ProjectAccessLevel;
      }
    }
    return map;
  },
};
