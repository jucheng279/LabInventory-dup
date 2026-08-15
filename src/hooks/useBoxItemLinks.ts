import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { boxItemLinkService } from '../services/boxItemLinkService';
import type { BoxGridItemLink, GridItemLinkType } from '../types/database';
import { getCellsQueryKey } from './useBoxData';

export const getBoxLinksQueryKey = (boxId: string) => ['boxItemLinks', boxId];
export const getItemLinksQueryKey = (itemIds: string[]) => ['itemLinks', ...itemIds.sort()];

export function useBoxItemLinks(boxId: string | null) {
  return useQuery({
    queryKey: getBoxLinksQueryKey(boxId || ''),
    queryFn: () => boxItemLinkService.getLinksForBox(boxId!),
    enabled: !!boxId,
  });
}

export function useItemLinks(itemIds: string[]) {
  return useQuery({
    queryKey: getItemLinksQueryKey(itemIds),
    queryFn: () => boxItemLinkService.getLinksForItems(itemIds),
    enabled: itemIds.length > 0,
  });
}

export function useCreateBoxItemLink(boxId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      linkType,
      linkedName,
      linkedInfo,
      linkedDate,
      linkedDateType,
    }: {
      itemId: string;
      linkType: GridItemLinkType;
      linkedName: string;
      linkedInfo: string | null;
      linkedDate?: string | null;
      linkedDateType?: string;
    }) => {
      const link = await boxItemLinkService.createLink(
        boxId,
        itemId,
        linkType,
        linkedName,
        linkedInfo,
        linkedDate ?? null,
        linkedDateType ?? 'none',
      );
      await boxItemLinkService.syncStock(link.id);
      return link;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getBoxLinksQueryKey(boxId) });
      queryClient.invalidateQueries({ queryKey: ['folderItems'] });
      queryClient.invalidateQueries({ queryKey: ['standaloneItems'] });
      queryClient.invalidateQueries({ queryKey: ['itemLinks'] });
      queryClient.invalidateQueries({ queryKey: ['lowStock'] });
    },
  });
}

export function useDeleteBoxItemLink(boxId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => boxItemLinkService.deleteLink(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getBoxLinksQueryKey(boxId) });
      queryClient.invalidateQueries({ queryKey: ['folderItems'] });
      queryClient.invalidateQueries({ queryKey: ['itemLinks'] });
      queryClient.invalidateQueries({ queryKey: ['lowStock'] });
    },
  });
}

export function useSyncBoxLinks(boxId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => boxItemLinkService.syncAllForBox(boxId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folderItems'] });
      queryClient.invalidateQueries({ queryKey: ['lowStock'] });
    },
  });
}

export function useCrossLastLinkedCell(boxId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      linkedName,
      linkedInfo,
      linkType,
      linkedDate,
      linkedDateType,
    }: {
      linkedName: string;
      linkedInfo: string | null;
      linkType: GridItemLinkType;
      linkedDate?: string | null;
      linkedDateType?: string;
    }) => {
      const crossedCellId = await boxItemLinkService.crossLastLinkedCell(
        boxId,
        linkedName,
        linkedInfo,
        linkType,
        linkedDate ?? null,
        linkedDateType ?? 'none',
      );
      if (crossedCellId) {
        await boxItemLinkService.syncAllForBox(boxId);
      }
      return crossedCellId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getCellsQueryKey(boxId) });
      queryClient.invalidateQueries({ queryKey: getBoxLinksQueryKey(boxId) });
      queryClient.invalidateQueries({ queryKey: ['folderItems'] });
      queryClient.invalidateQueries({ queryKey: ['standaloneItems'] });
      queryClient.invalidateQueries({ queryKey: ['lowStock'] });
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
    },
  });
}
