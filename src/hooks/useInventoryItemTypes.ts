import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryItemTypeService } from '../services/inventoryItemTypeService';
import type {
  InventoryItemTypeRecord,
  CreateInventoryItemTypeData,
  UpdateInventoryItemTypeData,
} from '../types/database';
import { CENTRALIZED_INVENTORY_KEY } from './useCentralizedInventory';

const ITEM_TYPES_KEY = ['inventory-item-types'];

export function useInventoryItemTypes() {
  const queryClient = useQueryClient();

  const query = useQuery<InventoryItemTypeRecord[]>({
    queryKey: ITEM_TYPES_KEY,
    queryFn: inventoryItemTypeService.getAll,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateInventoryItemTypeData) =>
      inventoryItemTypeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEM_TYPES_KEY });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInventoryItemTypeData }) =>
      inventoryItemTypeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEM_TYPES_KEY });
      queryClient.invalidateQueries({ queryKey: CENTRALIZED_INVENTORY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryItemTypeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEM_TYPES_KEY });
      queryClient.invalidateQueries({ queryKey: CENTRALIZED_INVENTORY_KEY });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({ workspaceId, typeIds }: { workspaceId: string; typeIds: string[] }) =>
      inventoryItemTypeService.reorder(workspaceId, typeIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ITEM_TYPES_KEY });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ itemId, typeId }: { itemId: string; typeId: string | null }) =>
      inventoryItemTypeService.assignItemType(itemId, typeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CENTRALIZED_INVENTORY_KEY });
    },
  });

  return {
    itemTypes: query.data || [],
    isLoading: query.isLoading,
    createItemType: createMutation.mutateAsync,
    updateItemType: updateMutation.mutateAsync,
    deleteItemType: deleteMutation.mutateAsync,
    reorderItemTypes: reorderMutation.mutateAsync,
    assignItemType: assignMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isAssigning: assignMutation.isPending,
  };
}
