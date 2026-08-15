import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBoxPrivacy,
  upsertBoxPrivacy,
  batchResolveBoxAccess,
  getBatchPrivacySettings,
} from '../services/boxPrivacyService';
import type { BoxAccessLevel, BoxPrivacyMode, BoxPrivacySettings } from '../types/database';
import { useAuth } from '../contexts/AuthContext';

export const PRIVACY_KEY = 'boxPrivacy';
export const ACCESS_KEY = 'boxAccess';
export const PRIVACY_SETTINGS_KEY = 'boxPrivacySettings';

export function useBoxPrivacy(boxId: string | null) {
  return useQuery({
    queryKey: [PRIVACY_KEY, boxId],
    queryFn: () => getBoxPrivacy(boxId!),
    enabled: !!boxId,
  });
}

export function useUpsertBoxPrivacy(boxId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      ownerId: string;
      privacyMode: BoxPrivacyMode;
      ownerOnlyDelete: boolean;
      accessEntries: { team_member_id: string; access_level: 'edit' | 'view' }[];
    }) =>
      upsertBoxPrivacy(
        boxId,
        params.ownerId,
        params.privacyMode,
        params.ownerOnlyDelete,
        params.accessEntries,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRIVACY_KEY, boxId] });
      queryClient.invalidateQueries({ queryKey: [ACCESS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PRIVACY_SETTINGS_KEY] });
    },
  });
}

export function useBatchBoxAccess(boxIds: string[]) {
  const { teamMember } = useAuth();
  const memberId = teamMember?.id;

  return useQuery<Record<string, BoxAccessLevel>>({
    queryKey: [ACCESS_KEY, boxIds.join(','), memberId],
    queryFn: () => batchResolveBoxAccess(boxIds, memberId!),
    enabled: boxIds.length > 0 && !!memberId,
    staleTime: 30_000,
  });
}

export function useBatchPrivacySettings(boxIds: string[]) {
  return useQuery<Record<string, BoxPrivacySettings>>({
    queryKey: [PRIVACY_SETTINGS_KEY, boxIds.join(',')],
    queryFn: () => getBatchPrivacySettings(boxIds),
    enabled: boxIds.length > 0,
    staleTime: 30_000,
  });
}

export function useBoxAccessLevel(boxId: string | null) {
  const { teamMember } = useAuth();
  const memberId = teamMember?.id;
  const ids = boxId ? [boxId] : [];

  const { data } = useBatchBoxAccess(ids);

  if (!boxId || !memberId || !data) return 'open' as BoxAccessLevel;
  return data[boxId] || ('open' as BoxAccessLevel);
}
