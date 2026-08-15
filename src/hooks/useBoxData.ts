import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locationCellService, CellData } from '../services/locationCellService';
import { boxService } from '../services/boxService';
import { historyService, HistoryEntry, RevertGroup } from '../services/historyService';
import type { HistoryActionContext } from '../types/database';
import { boxItemLinkService } from '../services/boxItemLinkService';

export const getBoxQueryKey = (boxId: string) => ['box', boxId];
export const getCellsQueryKey = (boxId: string) => ['cells', boxId];
export const getHistoryQueryKey = (boxId: string) => ['history', boxId];
export const getSlideValuesQueryKey = (boxId: string) => ['slideValues', boxId];

export function useBox(boxId: string) {
  return useQuery({
    queryKey: getBoxQueryKey(boxId),
    queryFn: () => boxService.getBoxById(boxId),
    enabled: !!boxId,
  });
}

export function useCells(boxId: string) {
  return useQuery({
    queryKey: getCellsQueryKey(boxId),
    queryFn: () => locationCellService.getAllCells(boxId),
    enabled: !!boxId,
  });
}

export function useBoxData(boxId: string) {
  const boxQuery = useBox(boxId);
  const cellsQuery = useCells(boxId);

  return {
    box: boxQuery.data ?? null,
    cellData: cellsQuery.data ?? {},
    isLoading: boxQuery.isLoading || cellsQuery.isLoading,
    isError: boxQuery.isError || cellsQuery.isError,
    refetch: () => {
      boxQuery.refetch();
      cellsQuery.refetch();
    },
  };
}

interface UpsertCellsInput {
  cells: Array<{ cellId: string; data: CellData }>;
  teamMemberId?: string;
  actionContext?: HistoryActionContext;
}

export function useUpsertCells(boxId: string, locationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cells, teamMemberId, actionContext }: UpsertCellsInput) =>
      locationCellService.upsertMultipleCells(boxId, cells, teamMemberId, actionContext),
    onMutate: async ({ cells }) => {
      await queryClient.cancelQueries({ queryKey: getCellsQueryKey(boxId) });
      const previousCellData = queryClient.getQueryData<Record<string, CellData>>(getCellsQueryKey(boxId));

      if (previousCellData) {
        const newCellData = { ...previousCellData };
        cells.forEach(({ cellId, data }) => {
          newCellData[cellId] = { ...data, is_crossed: false };
        });
        queryClient.setQueryData(getCellsQueryKey(boxId), newCellData);
      }

      return { previousCellData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousCellData) {
        queryClient.setQueryData(getCellsQueryKey(boxId), context.previousCellData);
      }
    },
    onSettled: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: ['boxes', locationId] });
      }
      queryClient.invalidateQueries({ queryKey: getHistoryQueryKey(boxId) });
      boxItemLinkService.syncAllForBox(boxId).then(() => {
        queryClient.invalidateQueries({ queryKey: ['folderItems'] });
        queryClient.invalidateQueries({ queryKey: ['lowStock'] });
      }).catch(() => {});
    },
  });
}

interface DeleteCellsInput {
  cellIds: string[];
  teamMemberId?: string;
  skipHistory?: boolean;
}

export function useDeleteCells(boxId: string, locationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cellIds, teamMemberId, skipHistory }: DeleteCellsInput) =>
      locationCellService.deleteMultipleCells(boxId, cellIds, teamMemberId, skipHistory),
    onMutate: async ({ cellIds }) => {
      await queryClient.cancelQueries({ queryKey: getCellsQueryKey(boxId) });
      const previousCellData = queryClient.getQueryData<Record<string, CellData>>(getCellsQueryKey(boxId));

      if (previousCellData) {
        const newCellData = { ...previousCellData };
        cellIds.forEach((cellId) => {
          delete newCellData[cellId];
        });
        queryClient.setQueryData(getCellsQueryKey(boxId), newCellData);
      }

      return { previousCellData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousCellData) {
        queryClient.setQueryData(getCellsQueryKey(boxId), context.previousCellData);
      }
    },
    onSettled: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: ['boxes', locationId] });
      }
      queryClient.invalidateQueries({ queryKey: getHistoryQueryKey(boxId) });
      queryClient.invalidateQueries({ queryKey: getSlideValuesQueryKey(boxId) });
      boxItemLinkService.syncAllForBox(boxId).then(() => {
        queryClient.invalidateQueries({ queryKey: ['folderItems'] });
        queryClient.invalidateQueries({ queryKey: ['lowStock'] });
      }).catch(() => {});
    },
  });
}

interface CrossCellsInput {
  cellIds: string[];
  teamMemberId?: string;
}

export function useCrossCells(boxId: string, locationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cellIds, teamMemberId }: CrossCellsInput) =>
      locationCellService.crossMultipleCells(boxId, cellIds, teamMemberId),
    onMutate: async ({ cellIds }) => {
      await queryClient.cancelQueries({ queryKey: getCellsQueryKey(boxId) });
      const previousCellData = queryClient.getQueryData<Record<string, CellData>>(getCellsQueryKey(boxId));

      if (previousCellData) {
        const newCellData = { ...previousCellData };
        cellIds.forEach((cellId) => {
          if (newCellData[cellId]) {
            newCellData[cellId] = { ...newCellData[cellId], is_crossed: true };
          }
        });
        queryClient.setQueryData(getCellsQueryKey(boxId), newCellData);
      }

      return { previousCellData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousCellData) {
        queryClient.setQueryData(getCellsQueryKey(boxId), context.previousCellData);
      }
    },
    onSettled: () => {
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: ['boxes', locationId] });
      }
      queryClient.invalidateQueries({ queryKey: getHistoryQueryKey(boxId) });
      boxItemLinkService.syncAllForBox(boxId).then(() => {
        queryClient.invalidateQueries({ queryKey: ['folderItems'] });
        queryClient.invalidateQueries({ queryKey: ['lowStock'] });
      }).catch(() => {});
    },
  });
}

export function prefetchBoxData(queryClient: ReturnType<typeof useQueryClient>, boxId: string) {
  queryClient.prefetchQuery({
    queryKey: getBoxQueryKey(boxId),
    queryFn: () => boxService.getBoxById(boxId),
  });
  queryClient.prefetchQuery({
    queryKey: getCellsQueryKey(boxId),
    queryFn: () => locationCellService.getAllCells(boxId),
  });
}

const HISTORY_PAGE_SIZE = 30;

export function useBoxHistory(boxId: string) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const initialQuery = useQuery({
    queryKey: getHistoryQueryKey(boxId),
    queryFn: async () => {
      const result = await historyService.getBoxHistory({
        boxId,
        limit: HISTORY_PAGE_SIZE,
        offset: 0,
      });
      return result;
    },
    enabled: !!boxId,
  });

  const dataRef = useRef(initialQuery.data);
  useEffect(() => {
    if (initialQuery.data && initialQuery.data !== dataRef.current) {
      dataRef.current = initialQuery.data;
      setEntries(initialQuery.data.entries);
      setHasMore(initialQuery.data.hasMore);
    }
  }, [initialQuery.data]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const result = await historyService.getBoxHistory({
        boxId,
        limit: HISTORY_PAGE_SIZE,
        offset: entries.length,
      });
      setEntries((prev) => [...prev, ...result.entries]);
      setHasMore(result.hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  }, [boxId, entries.length, hasMore, isLoadingMore]);

  return {
    entries,
    isLoading: initialQuery.isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refetch: initialQuery.refetch,
  };
}

export function useRevertGroups(boxId: string) {
  const query = useQuery({
    queryKey: ['revertGroups', boxId],
    queryFn: () => historyService.getRevertGroups(boxId),
    enabled: !!boxId,
  });

  return {
    groups: query.data || [] as RevertGroup[],
    isLoading: query.isLoading,
  };
}
