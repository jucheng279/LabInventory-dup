import { useQuery } from '@tanstack/react-query';
import { boxService, LocationBoxWithStats } from '../services/boxService';
import { supabase } from '../lib/supabase';
import type { ItemFolderWithStats, InventoryItem } from '../types/database';

export const OVERVIEW_ALL_BOXES_QUERY_KEY = ['overview-all-boxes'];
export const OVERVIEW_ALL_FOLDERS_QUERY_KEY = ['overview-all-folders'];
export const OVERVIEW_STANDALONE_ITEMS_QUERY_KEY = ['overview-standalone-items'];

export function useAllBoxesForOverview() {
  return useQuery<LocationBoxWithStats[]>({
    queryKey: OVERVIEW_ALL_BOXES_QUERY_KEY,
    queryFn: () => boxService.getAllBoxesWithStats(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useAllFoldersForOverview() {
  return useQuery<ItemFolderWithStats[]>({
    queryKey: OVERVIEW_ALL_FOLDERS_QUERY_KEY,
    queryFn: async () => {
      const { data: folders, error: foldersError } = await supabase
        .from('item_folders')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (foldersError) throw foldersError;
      if (!folders || folders.length === 0) return [];

      const folderIds = folders.map((f: { id: string }) => f.id);
      const { data: counts, error: countsError } = await supabase
        .from('inventory_items')
        .select('folder_id')
        .not('folder_id', 'is', null)
        .in('folder_id', folderIds);

      if (countsError) throw countsError;

      const countMap: Record<string, number> = {};
      (counts || []).forEach((row: { folder_id: string }) => {
        countMap[row.folder_id] = (countMap[row.folder_id] || 0) + 1;
      });

      return folders.map((f: ItemFolderWithStats) => ({
        ...f,
        item_count: countMap[f.id] || 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useStandaloneItemsForOverview() {
  return useQuery<InventoryItem[]>({
    queryKey: OVERVIEW_STANDALONE_ITEMS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .is('folder_id', null)
        .order('location_id', { ascending: true })
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
