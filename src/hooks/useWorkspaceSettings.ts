import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
  type WorkspaceSettings,
} from '../services/workspaceSettingsService';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const WORKSPACE_SETTINGS_QUERY_KEY = ['workspace-settings'];

export function useWorkspaceSettings() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.id;

  return useQuery({
    queryKey: [...WORKSPACE_SETTINGS_QUERY_KEY, workspaceId],
    queryFn: () => getWorkspaceSettings(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useUpdateWorkspaceSettings() {
  const queryClient = useQueryClient();
  const { workspace } = useAuth();
  const workspaceId = workspace?.id;

  return useMutation({
    mutationFn: (settings: Partial<WorkspaceSettings>) => {
      if (!workspaceId) throw new Error('No workspace');
      return updateWorkspaceSettings(workspaceId, settings);
    },
    onMutate: async (newSettings) => {
      const queryKey = [...WORKSPACE_SETTINGS_QUERY_KEY, workspaceId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WorkspaceSettings>(queryKey);

      if (previous) {
        queryClient.setQueryData(queryKey, { ...previous, ...newSettings });
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        const queryKey = [...WORKSPACE_SETTINGS_QUERY_KEY, workspaceId];
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [...WORKSPACE_SETTINGS_QUERY_KEY, workspaceId],
      });
    },
  });
}

export function useRealtimeWorkspaceSettings() {
  const queryClient = useQueryClient();
  const { workspace } = useAuth();
  const workspaceId = workspace?.id;
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel(`workspace-settings-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspaces',
          filter: `id=eq.${workspaceId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: [...WORKSPACE_SETTINGS_QUERY_KEY, workspaceId],
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [workspaceId, queryClient]);
}
