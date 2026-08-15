import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import {
  getNotificationPreferences,
  upsertNotificationPreferences,
  sendDigestNow,
  type ExpirationNotificationPreferences,
  type UpdateNotificationPrefsInput,
} from '../services/expirationNotificationService';

export const EXPIRATION_NOTIF_PREFS_KEY = ['expiration-notification-prefs'];

export function useExpirationNotificationPrefs() {
  const { teamMember, workspace } = useAuth();
  const teamMemberId = teamMember?.id ?? '';
  const workspaceId = workspace?.id ?? '';
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...EXPIRATION_NOTIF_PREFS_KEY, teamMemberId],
    queryFn: () => getNotificationPreferences(teamMemberId),
    enabled: !!teamMemberId,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (updates: UpdateNotificationPrefsInput) =>
      upsertNotificationPreferences(teamMemberId, workspaceId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...EXPIRATION_NOTIF_PREFS_KEY, teamMemberId] });
    },
  });

  const sendNowMutation = useMutation({
    mutationFn: () => sendDigestNow(teamMemberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...EXPIRATION_NOTIF_PREFS_KEY, teamMemberId] });
    },
  });

  const preferences: ExpirationNotificationPreferences | null = query.data ?? null;

  return {
    preferences,
    isLoading: query.isLoading,
    updatePreferences: mutation.mutate,
    isSaving: mutation.isPending,
    sendDigestNow: sendNowMutation.mutate,
    isSendingDigest: sendNowMutation.isPending,
    sendDigestError: sendNowMutation.error,
    sendDigestSuccess: sendNowMutation.isSuccess,
    resetSendDigest: sendNowMutation.reset,
  };
}
