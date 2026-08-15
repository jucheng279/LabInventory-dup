import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemFolderService, ItemFolderWithStats, CreateItemFolderData, UpdateItemFolderData } from '../services/itemFolderService';
import { itemFolderHeaderService, ItemFolderHeader } from '../services/itemFolderHeaderService';
import type { FolderHeaderInput } from '../services/itemFolderHeaderService';
import { itemCustomValueService, ItemCustomValuesMap } from '../services/itemCustomValueService';
import { presetOptionService } from '../services/presetOptionService';
import { itemService, InventoryItem } from '../services/itemService';
import { getItemsQueryKey } from './useWorkspaceData';
import { LOCATIONS_QUERY_KEY } from './useLocations';
import { getSublocationsQueryKey } from './useSublocationData';
import { ALL_POSITIONS_QUERY_KEY } from './usePositionData';
import { LOW_STOCK_QUERY_KEY } from './useLowStock';

export const getFoldersQueryKey = (locationId: string) => ['itemFolders', locationId];
export const getFolderHeadersQueryKey = (folderId: string) => ['itemFolderHeaders', folderId];
export const getFolderItemsQueryKey = (folderId: string) => ['folderItems', folderId];
export const getFolderCustomValuesQueryKey = (folderId: string) => ['folderCustomValues', folderId];

export function useItemFolders(locationId: string) {
  return useQuery({
    queryKey: getFoldersQueryKey(locationId),
    queryFn: () => itemFolderService.getFoldersWithStats(locationId),
    enabled: !!locationId,
  });
}

export function useItemFolderHeaders(folderId: string | null) {
  return useQuery({
    queryKey: getFolderHeadersQueryKey(folderId || ''),
    queryFn: async () => {
      const headers = await itemFolderHeaderService.getHeaders(folderId!);
      const presetHeaderIds = headers.filter(h => h.header_type === 'preset').map(h => h.id);
      if (presetHeaderIds.length > 0) {
        const optionsMap = await presetOptionService.getOptionsForHeaders(presetHeaderIds, 'item_folder');
        for (const h of headers) {
          if (h.header_type === 'preset') {
            h.preset_options = optionsMap[h.id] || [];
          }
        }
      }
      return headers;
    },
    enabled: !!folderId,
  });
}

export function useFolderItems(folderId: string | null) {
  return useQuery({
    queryKey: getFolderItemsQueryKey(folderId || ''),
    queryFn: () => itemService.getItemsByFolder(folderId!),
    enabled: !!folderId,
  });
}

export function useFolderCustomValues(folderId: string | null) {
  return useQuery({
    queryKey: getFolderCustomValuesQueryKey(folderId || ''),
    queryFn: () => itemCustomValueService.getValuesByFolder(folderId!),
    enabled: !!folderId,
  });
}

export function useCreateItemFolder(locationId: string, sublocationId?: string | null, positionId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, headers }: { data: Omit<CreateItemFolderData, 'location_id' | 'sublocation_id' | 'position_id'>; headers: FolderHeaderInput[] }) => {
      const folder = await itemFolderService.createFolder({
        ...data,
        location_id: locationId,
        sublocation_id: sublocationId,
        position_id: positionId,
      });
      if (headers.length > 0) {
        await itemFolderHeaderService.createHeaders(folder.id, headers);
      }
      return folder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getFoldersQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
    },
  });
}

export function useUpdateItemFolder(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ folderId, data, headers, headersChanged }: {
      folderId: string;
      data: UpdateItemFolderData;
      headers: FolderHeaderInput[];
      headersChanged: boolean;
    }) => {
      await itemFolderService.updateFolder(folderId, data);
      if (headersChanged) {
        await itemFolderHeaderService.replaceHeaders(folderId, headers);
      }
    },
    onSuccess: (_data, { folderId }) => {
      queryClient.invalidateQueries({ queryKey: getFoldersQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getFolderHeadersQueryKey(folderId) });
    },
  });
}

export function useDeleteItemFolder(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (folderId: string) => itemFolderService.deleteFolder(folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getFoldersQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getItemsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
    },
  });
}

export function useReorderItemFolders(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (folderIds: string[]) => itemFolderService.reorderFolders(locationId, folderIds),
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: getFoldersQueryKey(locationId) });
      const previous = queryClient.getQueryData<ItemFolderWithStats[]>(getFoldersQueryKey(locationId));

      if (previous) {
        const reordered = newOrder
          .map((id) => previous.find((f) => f.id === id))
          .filter((f): f is ItemFolderWithStats => f !== undefined)
          .map((f, index) => ({ ...f, display_order: index }));

        const unchanged = previous.filter((f) => !newOrder.includes(f.id));
        queryClient.setQueryData(getFoldersQueryKey(locationId), [...reordered, ...unchanged]);
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(getFoldersQueryKey(locationId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: getFoldersQueryKey(locationId) });
    },
  });
}

export function useMoveItemFolder(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      folderId,
      targetLocationId,
      targetSublocationId,
      targetPositionId,
    }: {
      folderId: string;
      targetLocationId: string;
      targetSublocationId?: string | null;
      targetPositionId?: string | null;
    }) => {
      return itemFolderService.moveFolder(folderId, targetLocationId, targetSublocationId, targetPositionId);
    },
    onMutate: async ({ folderId }) => {
      await queryClient.cancelQueries({ queryKey: getFoldersQueryKey(locationId) });
      const previousFolders = queryClient.getQueryData<ItemFolderWithStats[]>(getFoldersQueryKey(locationId));

      if (previousFolders) {
        queryClient.setQueryData(
          getFoldersQueryKey(locationId),
          previousFolders.filter((f) => f.id !== folderId)
        );
      }

      return { previousFolders };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousFolders) {
        queryClient.setQueryData(getFoldersQueryKey(locationId), context.previousFolders);
      }
    },
    onSettled: (_data, _err, { targetLocationId }) => {
      queryClient.invalidateQueries({ queryKey: getFoldersQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getFoldersQueryKey(targetLocationId) });
      queryClient.invalidateQueries({ queryKey: getItemsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getItemsQueryKey(targetLocationId) });
      queryClient.invalidateQueries({ queryKey: ['folderItems'] });
      queryClient.invalidateQueries({ queryKey: ['folderCustomValues'] });
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(targetLocationId) });
      queryClient.invalidateQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LOW_STOCK_QUERY_KEY });
    },
  });
}

export function useCreateItemInFolder(locationId: string, folderId: string, sublocationId?: string | null, positionId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemData, customValues }: {
      itemData: Omit<import('../types/database').CreateItemData, 'location_id' | 'sublocation_id' | 'position_id' | 'folder_id'>;
      customValues?: { header_id: string; value: string }[];
    }) => {
      const item = await itemService.createItem({
        ...itemData,
        location_id: locationId,
        sublocation_id: sublocationId,
        position_id: positionId,
        folder_id: folderId,
      });
      if (customValues && customValues.length > 0) {
        await itemCustomValueService.upsertValues(item.id, customValues);
      }
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getFolderItemsQueryKey(folderId) });
      queryClient.invalidateQueries({ queryKey: getFolderCustomValuesQueryKey(folderId) });
      queryClient.invalidateQueries({ queryKey: getFoldersQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getItemsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LOW_STOCK_QUERY_KEY });
    },
  });
}

export function useUpdateItemInFolder(locationId: string, folderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, itemData, customValues }: {
      itemId: string;
      itemData: import('../types/database').UpdateItemData;
      customValues?: { header_id: string; value: string }[];
    }) => {
      const item = await itemService.updateItem(itemId, itemData);
      if (customValues) {
        await itemCustomValueService.upsertValues(itemId, customValues);
      }
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getFolderItemsQueryKey(folderId) });
      queryClient.invalidateQueries({ queryKey: getFolderCustomValuesQueryKey(folderId) });
      queryClient.invalidateQueries({ queryKey: getItemsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: ['standaloneItems'] });
      queryClient.invalidateQueries({ queryKey: LOW_STOCK_QUERY_KEY });
    },
  });
}

export function useReorderFolderItems(locationId: string, folderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemIds: string[]) => itemService.reorderItems(locationId, itemIds),
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: getFolderItemsQueryKey(folderId) });
      const previous = queryClient.getQueryData<InventoryItem[]>(getFolderItemsQueryKey(folderId));

      if (previous) {
        const reordered = newOrder
          .map((id) => previous.find((i) => i.id === id))
          .filter((i): i is InventoryItem => i !== undefined)
          .map((i, index) => ({ ...i, display_order: index }));

        const unchanged = previous.filter((i) => !newOrder.includes(i.id));
        queryClient.setQueryData(getFolderItemsQueryKey(folderId), [...reordered, ...unchanged]);
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(getFolderItemsQueryKey(folderId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: getFolderItemsQueryKey(folderId) });
    },
  });
}

export const getStandaloneItemsQueryKey = (locationId: string, sublocationId?: string | null, positionId?: string | null) =>
  ['standaloneItems', locationId, sublocationId || '', positionId || ''];

export function useStandaloneItems(locationId: string, sublocationId?: string | null, positionId?: string | null) {
  return useQuery({
    queryKey: getStandaloneItemsQueryKey(locationId, sublocationId, positionId),
    queryFn: () => itemService.getStandaloneItems(locationId, sublocationId, positionId),
    enabled: !!locationId,
  });
}

export function useCreateStandaloneItem(locationId: string, sublocationId?: string | null, positionId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemData: Omit<import('../types/database').CreateItemData, 'location_id' | 'sublocation_id' | 'position_id' | 'folder_id'>) => {
      return itemService.createItem({
        ...itemData,
        location_id: locationId,
        sublocation_id: sublocationId,
        position_id: positionId,
        folder_id: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getStandaloneItemsQueryKey(locationId, sublocationId, positionId) });
      queryClient.invalidateQueries({ queryKey: getItemsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LOW_STOCK_QUERY_KEY });
    },
  });
}

export function useUpdateStandaloneItem(locationId: string, sublocationId?: string | null, positionId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, itemData }: {
      itemId: string;
      itemData: import('../types/database').UpdateItemData;
    }) => {
      return itemService.updateItem(itemId, itemData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getStandaloneItemsQueryKey(locationId, sublocationId, positionId) });
      queryClient.invalidateQueries({ queryKey: getItemsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: LOW_STOCK_QUERY_KEY });
    },
  });
}

export { useItemFolders as useItemSheets };
export { useItemFolderHeaders as useItemSheetHeaders };
export { useCreateItemFolder as useCreateItemSheet };
export { useUpdateItemFolder as useUpdateItemSheet };
export { useDeleteItemFolder as useDeleteItemSheet };
export { useReorderItemFolders as useReorderItemSheets };
export { useMoveItemFolder as useMoveItemSheet };
export { useCreateItemInFolder as useCreateItemInSheet };
export { useUpdateItemInFolder as useUpdateItemInSheet };
export { useReorderFolderItems as useReorderSheetItems };
