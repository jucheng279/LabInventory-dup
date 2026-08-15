import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { LOCATIONS_QUERY_KEY } from './useLocations';
import { getBoxesQueryKey, getItemsQueryKey } from './useWorkspaceData';
import { getCellsQueryKey, getBoxQueryKey, getHistoryQueryKey, getSlideValuesQueryKey } from './useBoxData';
import { getSublocationsQueryKey, ALL_SUBLOCATIONS_QUERY_KEY } from './useSublocationData';
import { ALL_POSITIONS_QUERY_KEY, getPositionsQueryKey } from './usePositionData';
import {
  getFoldersQueryKey,
  getFolderHeadersQueryKey,
  getFolderItemsQueryKey,
  getFolderCustomValuesQueryKey,
} from './useItemFolderData';
import { LOW_STOCK_QUERY_KEY } from './useLowStock';
import { EXPIRATIONS_QUERY_KEY } from './useExpirations';
import { getSlideHeadersQueryKey } from './useSlideBoxData';
import { getBoxLinksQueryKey } from './useBoxItemLinks';
import { PRIVACY_KEY, ACCESS_KEY, PRIVACY_SETTINGS_KEY } from './useBoxPrivacy';
import { TEAM_QUERY_KEY } from './useTeam';
import { BACKUPS_KEY } from './useBackups';
import type { RealtimeChannel } from '@supabase/supabase-js';

const DEBOUNCE_MS = 300;
const REORDER_DEBOUNCE_MS = 800;

function useDebouncedInvalidation() {
  const queryClient = useQueryClient();
  const pendingKeys = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const invalidate = useCallback(
    (queryKey: readonly unknown[], immediate = false, delayMs = DEBOUNCE_MS) => {
      const keyStr = JSON.stringify(queryKey);
      const existing = pendingKeys.current.get(keyStr);
      if (existing) clearTimeout(existing);

      if (immediate) {
        pendingKeys.current.delete(keyStr);
        queryClient.invalidateQueries({ queryKey: [...queryKey] });
        return;
      }

      pendingKeys.current.set(
        keyStr,
        setTimeout(() => {
          pendingKeys.current.delete(keyStr);
          queryClient.invalidateQueries({ queryKey: [...queryKey] });
        }, delayMs)
      );
    },
    [queryClient]
  );

  useEffect(() => {
    return () => {
      pendingKeys.current.forEach((t) => clearTimeout(t));
      pendingKeys.current.clear();
    };
  }, []);

  return invalidate;
}

export function useRealtimeWorkspace(enabled: boolean) {
  const invalidate = useDebouncedInvalidation();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel('workspace-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        () => {
          invalidate(LOCATIONS_QUERY_KEY);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sublocations' },
        (payload) => {
          invalidate(ALL_SUBLOCATIONS_QUERY_KEY, false, REORDER_DEBOUNCE_MS);
          const locationId =
            (payload.new as Record<string, unknown>)?.location_id ||
            (payload.old as Record<string, unknown>)?.location_id;
          if (locationId) {
            invalidate(getSublocationsQueryKey(locationId as string), false, REORDER_DEBOUNCE_MS);
          }
          invalidate(LOCATIONS_QUERY_KEY);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sublocation_positions' },
        (payload) => {
          invalidate(ALL_POSITIONS_QUERY_KEY, false, REORDER_DEBOUNCE_MS);
          const sublocationId =
            (payload.new as Record<string, unknown>)?.sublocation_id ||
            (payload.old as Record<string, unknown>)?.sublocation_id;
          if (sublocationId) {
            invalidate(getPositionsQueryKey(sublocationId as string), false, REORDER_DEBOUNCE_MS);
          }
          invalidate(ALL_SUBLOCATIONS_QUERY_KEY, false, REORDER_DEBOUNCE_MS);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members' },
        () => {
          invalidate(TEAM_QUERY_KEY);
          invalidate([ACCESS_KEY]);
          invalidate([PRIVACY_SETTINGS_KEY]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workspace_backups' },
        () => {
          invalidate(BACKUPS_KEY);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inventory_items' },
        () => {
          invalidate(LOW_STOCK_QUERY_KEY);
          invalidate(EXPIRATIONS_QUERY_KEY);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cells' },
        () => {
          invalidate(EXPIRATIONS_QUERY_KEY);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'box_privacy_settings' },
        (payload) => {
          const boxId =
            (payload.new as Record<string, unknown>)?.box_id ||
            (payload.old as Record<string, unknown>)?.box_id;
          if (boxId) {
            invalidate([PRIVACY_KEY, boxId as string]);
          }
          invalidate([ACCESS_KEY]);
          invalidate([PRIVACY_SETTINGS_KEY]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'box_access_list' },
        () => {
          invalidate([ACCESS_KEY]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          invalidate(['projects']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'experiments' },
        () => {
          invalidate(['experiments']);
          invalidate(['projects']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_box_links' },
        () => {
          invalidate(['project-box-links']);
          invalidate(['project-all-links']);
          invalidate(['projects']);
          invalidate(['experiments']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_item_links' },
        () => {
          invalidate(['project-item-links']);
          invalidate(['project-all-links']);
          invalidate(['projects']);
          invalidate(['experiments']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_privacy_settings' },
        () => {
          invalidate(['project-privacy']);
          invalidate(['project-access']);
          invalidate(['project-access-batch']);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_access_list' },
        () => {
          invalidate(['project-access']);
          invalidate(['project-access-batch']);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, invalidate]);
}

export function useRealtimeLocation(locationId: string | null, enabled: boolean) {
  const invalidate = useDebouncedInvalidation();
  const queryClient = useQueryClient();
  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    const cleanup = () => {
      channelsRef.current.forEach((c) => supabase.removeChannel(c));
      channelsRef.current = [];
    };

    if (!enabled || !locationId) {
      cleanup();
      return;
    }

    const structureChannel = supabase
      .channel(`location-sync-${locationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boxes', filter: `location_id=eq.${locationId}` },
        () => {
          invalidate(getBoxesQueryKey(locationId));
          invalidate(LOCATIONS_QUERY_KEY);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_folders', filter: `location_id=eq.${locationId}` },
        () => {
          invalidate(getFoldersQueryKey(locationId));
          invalidate(LOCATIONS_QUERY_KEY);
        }
      )
      .subscribe();

    const itemsChannel = supabase
      .channel(`location-items-${locationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_items', filter: `location_id=eq.${locationId}` },
        (payload) => {
          const newRow = payload.new as Record<string, unknown> | undefined;
          const oldRow = payload.old as Record<string, unknown> | undefined;
          const isDelete = payload.eventType === 'DELETE';

          invalidate(getItemsQueryKey(locationId), isDelete);
          invalidate(LOCATIONS_QUERY_KEY, isDelete);
          invalidate(LOW_STOCK_QUERY_KEY, isDelete);
          invalidate(getFoldersQueryKey(locationId), isDelete);

          const folderIds = new Set<string>();
          const newFolderId = newRow?.folder_id as string | undefined;
          const oldFolderId = oldRow?.folder_id as string | undefined;
          if (newFolderId) folderIds.add(newFolderId);
          if (oldFolderId) folderIds.add(oldFolderId);
          folderIds.forEach((folderId) => {
            invalidate(getFolderItemsQueryKey(folderId), isDelete);
            invalidate(getFolderCustomValuesQueryKey(folderId), isDelete);
          });

          // Invalidate standalone items cache when folder_id is null
          const newHasNoFolder = newRow && !newRow.folder_id;
          const oldHasNoFolder = oldRow && !oldRow.folder_id;
          if (newHasNoFolder || oldHasNoFolder || isDelete) {
            queryClient.invalidateQueries({ queryKey: ['standaloneItems'] });
          }

          if (isDelete) {
            queryClient.invalidateQueries({ queryKey: ['folderItems'] });
            queryClient.invalidateQueries({ queryKey: ['folderCustomValues'] });
          }
        }
      )
      .subscribe();

    const folderMetaChannel = supabase
      .channel(`location-folder-meta-${locationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_folder_headers' },
        (payload) => {
          const folderId =
            (payload.new as Record<string, unknown>)?.folder_id ||
            (payload.old as Record<string, unknown>)?.folder_id;
          if (folderId) {
            invalidate(getFolderHeadersQueryKey(folderId as string));
            invalidate(getFolderCustomValuesQueryKey(folderId as string));
          }
          invalidate(getFoldersQueryKey(locationId));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_custom_values' },
        () => {
          invalidate(getFoldersQueryKey(locationId));
        }
      )
      .subscribe();

    channelsRef.current = [structureChannel, itemsChannel, folderMetaChannel];

    return cleanup;
  }, [locationId, enabled, invalidate, queryClient]);
}

export function useRealtimeBox(boxId: string | null, enabled: boolean) {
  const invalidate = useDebouncedInvalidation();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !boxId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel(`box-sync-${boxId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cells', filter: `box_id=eq.${boxId}` },
        () => {
          invalidate(getCellsQueryKey(boxId));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boxes', filter: `id=eq.${boxId}` },
        () => {
          invalidate(getBoxQueryKey(boxId));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'box_history', filter: `box_id=eq.${boxId}` },
        () => {
          invalidate(getHistoryQueryKey(boxId));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'slide_box_headers', filter: `box_id=eq.${boxId}` },
        () => {
          invalidate(getSlideHeadersQueryKey(boxId));
          invalidate(getSlideValuesQueryKey(boxId));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'slide_cell_values' },
        (payload) => {
          const headerId =
            (payload.new as Record<string, unknown>)?.header_id ||
            (payload.old as Record<string, unknown>)?.header_id;
          if (headerId) {
            invalidate(getSlideValuesQueryKey(boxId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'box_grid_item_links', filter: `box_id=eq.${boxId}` },
        () => {
          invalidate(getBoxLinksQueryKey(boxId));
          invalidate(['folderItems']);
          invalidate(LOW_STOCK_QUERY_KEY);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'box_privacy_settings', filter: `box_id=eq.${boxId}` },
        () => {
          invalidate([PRIVACY_KEY, boxId]);
          invalidate([ACCESS_KEY]);
          invalidate([PRIVACY_SETTINGS_KEY]);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boxId, enabled, invalidate]);
}
