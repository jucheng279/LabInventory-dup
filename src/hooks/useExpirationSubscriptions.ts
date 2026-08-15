import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import {
  getSubscriptions,
  addSubscription,
  removeSubscription,
  removeSubscriptionByKey,
  removeStaleSubscriptions,
  makeSubscriptionKey,
  type ExpirationSubscription,
  type CreateSubscriptionInput,
} from '../services/expirationSubscriptionService';
import { getAllExpirations } from '../services/expirationService';
import { useCallback, useEffect, useRef } from 'react';

export const EXPIRATION_SUBS_QUERY_KEY = ['expiration-subscriptions'];

export function useExpirationSubscriptions() {
  const { teamMember, workspace } = useAuth();
  const teamMemberId = teamMember?.id ?? '';
  const workspaceId = workspace?.id ?? '';
  const queryClient = useQueryClient();
  const cleanupRanRef = useRef(false);

  const query = useQuery({
    queryKey: [...EXPIRATION_SUBS_QUERY_KEY, teamMemberId],
    queryFn: () => getSubscriptions(teamMemberId),
    enabled: !!teamMemberId,
    staleTime: 30_000,
  });

  const subscriptions = (query.data ?? []) as ExpirationSubscription[];

  // Build composite-key set for "is subscribed?" checks
  const subscribedKeys = new Set(
    subscriptions.map((sub) => makeSubscriptionKey(sub.item_name, sub.item_info, sub.expiration_date))
  );

  // Also keep source_id set for backwards compat during transition
  const subscribedSourceIds = new Set(
    subscriptions.map((sub) => sub.source_id)
  );

  // Dynamic stale cleanup: runs once when subscriptions load
  useEffect(() => {
    if (!workspaceId || subscriptions.length === 0 || cleanupRanRef.current) return;
    cleanupRanRef.current = true;

    (async () => {
      try {
        const liveData = await getAllExpirations(workspaceId);
        const liveKeys = new Set(
          liveData.map((r) => makeSubscriptionKey(r.name, r.information || '', r.expirationDate))
        );
        const removedIds = await removeStaleSubscriptions(teamMemberId, subscriptions, liveKeys);
        if (removedIds.length > 0) {
          queryClient.invalidateQueries({ queryKey: [...EXPIRATION_SUBS_QUERY_KEY, teamMemberId] });
        }
      } catch {
        // Cleanup is best-effort; don't block the UI
      }
    })();
  }, [workspaceId, subscriptions, teamMemberId, queryClient]);

  // Reset cleanup flag when team member changes
  useEffect(() => {
    cleanupRanRef.current = false;
  }, [teamMemberId]);

  const addMutation = useMutation({
    mutationFn: (input: Omit<CreateSubscriptionInput, 'team_member_id' | 'workspace_id'>) =>
      addSubscription({ ...input, team_member_id: teamMemberId, workspace_id: workspaceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...EXPIRATION_SUBS_QUERY_KEY, teamMemberId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (subscriptionId: string) => removeSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...EXPIRATION_SUBS_QUERY_KEY, teamMemberId] });
    },
  });

  const removeByKeyMutation = useMutation({
    mutationFn: ({ itemName, itemInfo, expirationDate }: { itemName: string; itemInfo: string; expirationDate: string }) =>
      removeSubscriptionByKey(teamMemberId, itemName, itemInfo, expirationDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...EXPIRATION_SUBS_QUERY_KEY, teamMemberId] });
    },
  });

  const toggleSubscription = useCallback(
    (input: Omit<CreateSubscriptionInput, 'team_member_id' | 'workspace_id'>) => {
      const key = makeSubscriptionKey(input.item_name, input.item_info, input.expiration_date);
      if (subscribedKeys.has(key)) {
        removeByKeyMutation.mutate({
          itemName: input.item_name,
          itemInfo: input.item_info || '',
          expirationDate: input.expiration_date,
        });
      } else {
        addMutation.mutate(input);
      }
    },
    [subscribedKeys, addMutation, removeByKeyMutation]
  );

  return {
    subscriptions,
    subscribedKeys,
    subscribedSourceIds,
    isLoading: query.isLoading,
    toggleSubscription,
    removeSubscription: removeMutation.mutate,
    isSubscribed: (name: string, info: string, date: string) =>
      subscribedKeys.has(makeSubscriptionKey(name, info, date)),
  };
}
