import { getClient } from '../lib/supabase';
import type {
  BoxPrivacySettings,
  BoxAccessEntry,
  BoxPrivacyData,
  BoxAccessLevel,
  BoxPrivacyMode,
} from '../types/database';

export type { BoxPrivacySettings, BoxAccessEntry, BoxPrivacyData, BoxAccessLevel, BoxPrivacyMode };

export async function getBoxPrivacy(boxId: string): Promise<BoxPrivacyData | null> {
  const { data: settings, error: sErr } = await getClient()
    .from('box_privacy_settings')
    .select('*')
    .eq('box_id', boxId)
    .maybeSingle();

  if (sErr) throw sErr;
  if (!settings) return null;

  const { data: accessList, error: aErr } = await getClient()
    .from('box_access_list')
    .select('*')
    .eq('box_id', boxId);

  if (aErr) throw aErr;

  return { settings, accessList: accessList || [] };
}

export async function upsertBoxPrivacy(
  boxId: string,
  ownerId: string,
  privacyMode: BoxPrivacyMode,
  ownerOnlyDelete: boolean,
  accessEntries: { team_member_id: string; access_level: 'edit' | 'view' }[],
): Promise<void> {
  const { error } = await getClient().rpc('upsert_box_privacy', {
    p_box_id: boxId,
    p_owner_id: ownerId,
    p_privacy_mode: privacyMode,
    p_owner_only_delete: ownerOnlyDelete,
    p_access_entries: accessEntries,
  });

  if (error) throw error;
}

export async function resolveBoxAccess(
  boxId: string,
  teamMemberId: string,
): Promise<BoxAccessLevel> {
  const { data, error } = await getClient().rpc('resolve_box_access', {
    p_box_id: boxId,
    p_team_member_id: teamMemberId,
  });

  if (error) throw error;
  return (data as BoxAccessLevel) || 'open';
}

export async function batchResolveBoxAccess(
  boxIds: string[],
  teamMemberId: string,
): Promise<Record<string, BoxAccessLevel>> {
  if (boxIds.length === 0) return {};

  const { data, error } = await getClient().rpc('batch_resolve_box_access', {
    p_box_ids: boxIds,
    p_team_member_id: teamMemberId,
  });

  if (error) throw error;

  const map: Record<string, BoxAccessLevel> = {};
  for (const row of data || []) {
    map[row.box_id] = row.access_level as BoxAccessLevel;
  }
  return map;
}

export async function getBatchPrivacySettings(
  boxIds: string[],
): Promise<Record<string, BoxPrivacySettings>> {
  if (boxIds.length === 0) return {};

  const { data, error } = await getClient()
    .from('box_privacy_settings')
    .select('*')
    .in('box_id', boxIds);

  if (error) throw error;

  const map: Record<string, BoxPrivacySettings> = {};
  for (const row of data || []) {
    map[row.box_id] = row;
  }
  return map;
}
