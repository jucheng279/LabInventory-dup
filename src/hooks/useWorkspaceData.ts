import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { boxService, LocationBoxWithStats, CreateBoxData, UpdateBoxData } from '../services/boxService';
import { itemService, InventoryItem } from '../services/itemService';
import { itemFolderService } from '../services/itemFolderService';
import type { ItemFolderWithStats } from '../services/itemFolderService';
import { locationCellService } from '../services/locationCellService';
import { LOCATIONS_QUERY_KEY } from './useLocations';
import { getBoxQueryKey, getCellsQueryKey, getSlideValuesQueryKey } from './useBoxData';
import { getSlideHeadersQueryKey } from './useSlideBoxData';
import { getSublocationsQueryKey } from './useSublocationData';
import { ALL_POSITIONS_QUERY_KEY } from './usePositionData';
import { getFoldersQueryKey } from './useItemFolderData';
import { LOW_STOCK_QUERY_KEY } from './useLowStock';

export const getBoxesQueryKey = (locationId: string) => ['boxes', locationId];
export const getItemsQueryKey = (locationId: string) => ['items', locationId];

export function useBoxes(locationId: string) {
  return useQuery({
    queryKey: getBoxesQueryKey(locationId),
    queryFn: () => boxService.getAllBoxesWithStats(locationId),
    enabled: !!locationId,
  });
}

export function useItems(locationId: string) {
  return useQuery({
    queryKey: getItemsQueryKey(locationId),
    queryFn: () => itemService.getAllItems(locationId),
    enabled: !!locationId,
  });
}

export function useItemFoldersForWorkspace(locationId: string) {
  return useQuery({
    queryKey: getFoldersQueryKey(locationId),
    queryFn: () => itemFolderService.getFoldersWithStats(locationId),
    enabled: !!locationId,
  });
}

export function useWorkspaceData(locationId: string, sublocationId?: string | null, positionId?: string | null, hierarchical?: boolean) {
  const boxesQuery = useBoxes(locationId);
  const itemsQuery = useItems(locationId);
  const foldersQuery = useItemFoldersForWorkspace(locationId);

  const allBoxes = boxesQuery.data ?? [];
  const allItems = itemsQuery.data ?? [];
  const allFolders = foldersQuery.data ?? [];

  let filteredBoxes = allBoxes;
  let filteredItems = allItems;
  let filteredFolders = allFolders;

  if (positionId) {
    filteredBoxes = allBoxes.filter((box) => box.position_id === positionId);
    filteredItems = allItems.filter((item) => item.position_id === positionId);
    filteredFolders = allFolders.filter((f) => f.position_id === positionId);
  } else if (sublocationId) {
    if (hierarchical) {
      filteredBoxes = allBoxes.filter((box) => box.sublocation_id === sublocationId && !box.position_id);
      filteredItems = allItems.filter((item) => item.sublocation_id === sublocationId && !item.position_id);
      filteredFolders = allFolders.filter((f) => f.sublocation_id === sublocationId && !f.position_id);
    } else {
      filteredBoxes = allBoxes.filter((box) => box.sublocation_id === sublocationId);
      filteredItems = allItems.filter((item) => item.sublocation_id === sublocationId);
      filteredFolders = allFolders.filter((f) => f.sublocation_id === sublocationId);
    }
  } else if (hierarchical) {
    filteredBoxes = allBoxes.filter((box) => !box.sublocation_id);
    filteredItems = allItems.filter((item) => !item.sublocation_id);
    filteredFolders = allFolders.filter((f) => !f.sublocation_id);
  }

  return {
    boxes: filteredBoxes,
    items: filteredItems,
    folders: filteredFolders,
    allBoxes,
    allItems,
    allFolders,
    isLoading: boxesQuery.isLoading || itemsQuery.isLoading || foldersQuery.isLoading,
    isError: boxesQuery.isError || itemsQuery.isError || foldersQuery.isError,
    refetch: () => {
      boxesQuery.refetch();
      itemsQuery.refetch();
      foldersQuery.refetch();
    },
  };
}

export function useReorderBoxes(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (boxIds: string[]) => boxService.reorderBoxes(locationId, boxIds),
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: getBoxesQueryKey(locationId) });
      const previousBoxes = queryClient.getQueryData<LocationBoxWithStats[]>(getBoxesQueryKey(locationId));

      if (previousBoxes) {
        const reordered = newOrder
          .map((id) => previousBoxes.find((b) => b.id === id))
          .filter((b): b is LocationBoxWithStats => b !== undefined)
          .map((b, index) => ({ ...b, display_order: index }));

        const unchanged = previousBoxes.filter((b) => !newOrder.includes(b.id));
        queryClient.setQueryData(getBoxesQueryKey(locationId), [...reordered, ...unchanged]);
      }

      return { previousBoxes };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousBoxes) {
        queryClient.setQueryData(getBoxesQueryKey(locationId), context.previousBoxes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: getBoxesQueryKey(locationId) });
    },
  });
}

export function useReorderItems(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemIds: string[]) => itemService.reorderItems(locationId, itemIds),
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: getItemsQueryKey(locationId) });
      const previousItems = queryClient.getQueryData<InventoryItem[]>(getItemsQueryKey(locationId));

      if (previousItems) {
        const reordered = newOrder
          .map((id) => previousItems.find((i) => i.id === id))
          .filter((i): i is InventoryItem => i !== undefined)
          .map((i, index) => ({ ...i, display_order: index }));

        const unchanged = previousItems.filter((i) => !newOrder.includes(i.id));
        queryClient.setQueryData(getItemsQueryKey(locationId), [...reordered, ...unchanged]);
      }

      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(getItemsQueryKey(locationId), context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: getItemsQueryKey(locationId) });
    },
  });
}

export function useCreateBox(locationId: string, sublocationId?: string | null, positionId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<CreateBoxData, 'location_id' | 'sublocation_id' | 'position_id'>) =>
      boxService.createBox({ ...data, location_id: locationId, sublocation_id: sublocationId, position_id: positionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getBoxesQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
    },
  });
}

export function useUpdateBox(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ boxId, data }: { boxId: string; data: UpdateBoxData }) => {
      if (data.rows !== undefined && data.columns !== undefined) {
        await locationCellService.deleteOutOfBoundsCells(boxId, data.rows, data.columns);
      }
      return boxService.updateBox(boxId, data);
    },
    onSuccess: (_data, { boxId, data }) => {
      queryClient.invalidateQueries({ queryKey: getBoxesQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getBoxQueryKey(boxId) });
      queryClient.invalidateQueries({ queryKey: getSlideHeadersQueryKey(boxId) });
      queryClient.invalidateQueries({ queryKey: getSlideValuesQueryKey(boxId) });
      if (data.rows !== undefined || data.columns !== undefined) {
        queryClient.invalidateQueries({ queryKey: getCellsQueryKey(boxId) });
      }
    },
  });
}

export function useDuplicateBox(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ boxId, withData }: { boxId: string; withData: boolean }) =>
      boxService.duplicateBox(boxId, withData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getBoxesQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
    },
  });
}

export function useDeleteBox(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (boxId: string) => boxService.deleteBox(boxId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getBoxesQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
    },
  });
}

export function useMoveBox(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      boxId,
      targetLocationId,
      targetSublocationId,
      targetPositionId,
    }: {
      boxId: string;
      targetLocationId: string;
      targetSublocationId?: string | null;
      targetPositionId?: string | null;
    }) => boxService.moveBoxToLocation(boxId, targetLocationId, targetSublocationId, targetPositionId),
    onMutate: async ({ boxId }) => {
      await queryClient.cancelQueries({ queryKey: getBoxesQueryKey(locationId) });
      const previousBoxes = queryClient.getQueryData<LocationBoxWithStats[]>(getBoxesQueryKey(locationId));

      if (previousBoxes) {
        queryClient.setQueryData(
          getBoxesQueryKey(locationId),
          previousBoxes.filter((b) => b.id !== boxId)
        );
      }

      return { previousBoxes };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousBoxes) {
        queryClient.setQueryData(getBoxesQueryKey(locationId), context.previousBoxes);
      }
    },
    onSettled: (_data, _err, { targetLocationId }) => {
      queryClient.invalidateQueries({ queryKey: getBoxesQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getBoxesQueryKey(targetLocationId) });
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(targetLocationId) });
      queryClient.invalidateQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
    },
  });
}

export function useAdjustStock(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, delta }: { itemId: string; delta: number }) =>
      itemService.adjustStock(itemId, delta),
    onMutate: async ({ itemId, delta }) => {
      await queryClient.cancelQueries({ queryKey: getItemsQueryKey(locationId) });
      const previousItems = queryClient.getQueryData<InventoryItem[]>(getItemsQueryKey(locationId));

      if (previousItems) {
        queryClient.setQueryData(
          getItemsQueryKey(locationId),
          previousItems.map((item) =>
            item.id === itemId
              ? { ...item, stock_number: Math.max(0, item.stock_number + delta) }
              : item
          )
        );
      }

      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(getItemsQueryKey(locationId), context.previousItems);
      }
    },
    onSuccess: (updatedItem) => {
      const currentItems = queryClient.getQueryData<InventoryItem[]>(getItemsQueryKey(locationId));
      if (currentItems) {
        queryClient.setQueryData(
          getItemsQueryKey(locationId),
          currentItems.map((item) =>
            item.id === updatedItem.id ? { ...item, stock_number: updatedItem.stock_number } : item
          )
        );
      }
      queryClient.invalidateQueries({ queryKey: ['folderItems'] });
      queryClient.invalidateQueries({ queryKey: ['standaloneItems'] });
      queryClient.invalidateQueries({ queryKey: LOW_STOCK_QUERY_KEY });
    },
  });
}

export function useAdjustFreezeThaw(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, delta }: { itemId: string; delta: number }) =>
      itemService.adjustFreezeThawCycles(itemId, delta),
    onMutate: async ({ itemId, delta }) => {
      await queryClient.cancelQueries({ queryKey: getItemsQueryKey(locationId) });
      const previousItems = queryClient.getQueryData<InventoryItem[]>(getItemsQueryKey(locationId));

      if (previousItems) {
        queryClient.setQueryData(
          getItemsQueryKey(locationId),
          previousItems.map((item) =>
            item.id === itemId
              ? { ...item, freeze_thaw_cycles: Math.max(0, (item.freeze_thaw_cycles || 0) + delta) }
              : item
          )
        );
      }

      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(getItemsQueryKey(locationId), context.previousItems);
      }
    },
    onSuccess: (updatedItem) => {
      const currentItems = queryClient.getQueryData<InventoryItem[]>(getItemsQueryKey(locationId));
      if (currentItems) {
        queryClient.setQueryData(
          getItemsQueryKey(locationId),
          currentItems.map((item) =>
            item.id === updatedItem.id ? { ...item, freeze_thaw_cycles: updatedItem.freeze_thaw_cycles } : item
          )
        );
      }
      queryClient.invalidateQueries({ queryKey: ['folderItems'] });
      queryClient.invalidateQueries({ queryKey: ['standaloneItems'] });
    },
  });
}

export function useDeleteItem(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => itemService.deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getItemsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getFoldersQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: ['folderItems'] });
      queryClient.invalidateQueries({ queryKey: ['folderCustomValues'] });
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LOW_STOCK_QUERY_KEY });
    },
  });
}

export function useMoveItem(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      targetLocationId,
      targetSublocationId,
      targetPositionId,
      isStandalone,
    }: {
      itemId: string;
      targetLocationId: string;
      targetSublocationId?: string | null;
      targetPositionId?: string | null;
      isStandalone?: boolean;
    }) => {
      if (isStandalone) {
        return itemService.moveItemToLocation(itemId, targetLocationId, targetSublocationId, targetPositionId, null);
      }
      const folder = await itemFolderService.findOrCreateGeneralFolder(targetLocationId, targetSublocationId, targetPositionId);
      return itemService.moveItemToLocation(itemId, targetLocationId, targetSublocationId, targetPositionId, folder.id);
    },
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: getItemsQueryKey(locationId) });
      const previousItems = queryClient.getQueryData<InventoryItem[]>(getItemsQueryKey(locationId));

      if (previousItems) {
        queryClient.setQueryData(
          getItemsQueryKey(locationId),
          previousItems.filter((i) => i.id !== itemId)
        );
      }

      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(getItemsQueryKey(locationId), context.previousItems);
      }
    },
    onSettled: (_data, _err, { targetLocationId }) => {
      queryClient.invalidateQueries({ queryKey: getItemsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getItemsQueryKey(targetLocationId) });
      queryClient.invalidateQueries({ queryKey: getFoldersQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getFoldersQueryKey(targetLocationId) });
      queryClient.invalidateQueries({ queryKey: ['folderItems'] });
      queryClient.invalidateQueries({ queryKey: ['folderCustomValues'] });
      queryClient.invalidateQueries({ queryKey: ['standaloneItems'] });
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(targetLocationId) });
      queryClient.invalidateQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
    },
  });
}
