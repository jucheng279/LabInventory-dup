import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { slideBoxHeaderService, SlideBoxHeader } from '../services/slideBoxHeaderService';
import { slideCellValueService, SlideValuesMap } from '../services/slideCellValueService';
import { locationCellService, CellData } from '../services/locationCellService';
import { boxService } from '../services/boxService';
import { boxItemLinkService } from '../services/boxItemLinkService';
import { presetOptionService } from '../services/presetOptionService';
import { getBoxQueryKey, getCellsQueryKey, getSlideValuesQueryKey, getHistoryQueryKey } from './useBoxData';
import type { HistoryActionContext } from '../types/database';

export const getSlideHeadersQueryKey = (boxId: string) => ['slideHeaders', boxId];
export { getSlideValuesQueryKey };

export function useSlideBoxHeaders(boxId: string) {
  return useQuery({
    queryKey: getSlideHeadersQueryKey(boxId),
    queryFn: async () => {
      const headers = await slideBoxHeaderService.getHeaders(boxId);
      const presetHeaderIds = headers.filter(h => h.header_type === 'preset').map(h => h.id);
      if (presetHeaderIds.length > 0) {
        const optionsMap = await presetOptionService.getOptionsForHeaders(presetHeaderIds, 'slide_box');
        for (const h of headers) {
          if (h.header_type === 'preset') {
            h.preset_options = optionsMap[h.id] || [];
          }
        }
      }
      return headers;
    },
    enabled: !!boxId,
  });
}

export function useSlideBoxCellValues(boxId: string) {
  return useQuery({
    queryKey: getSlideValuesQueryKey(boxId),
    queryFn: () => slideCellValueService.getValuesForBox(boxId),
    enabled: !!boxId,
  });
}

export function useSlideBoxData(boxId: string) {
  const boxQuery = useQuery({
    queryKey: getBoxQueryKey(boxId),
    queryFn: () => boxService.getBoxById(boxId),
    enabled: !!boxId,
  });

  const cellsQuery = useQuery({
    queryKey: getCellsQueryKey(boxId),
    queryFn: () => locationCellService.getAllCells(boxId),
    enabled: !!boxId,
  });

  const headersQuery = useSlideBoxHeaders(boxId);
  const valuesQuery = useSlideBoxCellValues(boxId);

  return {
    box: boxQuery.data ?? null,
    cellData: cellsQuery.data ?? {},
    headers: headersQuery.data ?? [],
    slideValues: valuesQuery.data ?? {},
    isLoading: boxQuery.isLoading || cellsQuery.isLoading || headersQuery.isLoading || valuesQuery.isLoading,
    isError: boxQuery.isError || cellsQuery.isError || headersQuery.isError || valuesQuery.isError,
  };
}

interface UpsertSlideCellsInput {
  cells: Array<{
    cellId: string;
    data: CellData;
    headerValues: Array<{ headerId: string; value: string }>;
  }>;
  teamMemberId?: string;
  actionContext?: HistoryActionContext;
}

export function useUpsertSlideCells(boxId: string, locationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cells, teamMemberId, actionContext }: UpsertSlideCellsInput) => {
      const cellRecords = cells.map(({ cellId, data }) => ({
        cellId,
        data,
      }));

      await locationCellService.upsertMultipleCells(boxId, cellRecords, teamMemberId, actionContext);

      const valueEntries = cells
        .filter(c => c.headerValues.length > 0)
        .map(c => ({
          cellTextId: c.cellId,
          headerValues: c.headerValues,
        }));

      if (valueEntries.length > 0) {
        await slideCellValueService.upsertMultipleCellValues(boxId, valueEntries);
      }
    },
    onMutate: async ({ cells }) => {
      await queryClient.cancelQueries({ queryKey: getCellsQueryKey(boxId) });
      await queryClient.cancelQueries({ queryKey: getSlideValuesQueryKey(boxId) });

      const previousCellData = queryClient.getQueryData<Record<string, CellData>>(getCellsQueryKey(boxId));
      const previousValues = queryClient.getQueryData<SlideValuesMap>(getSlideValuesQueryKey(boxId));

      if (previousCellData) {
        const newCellData = { ...previousCellData };
        cells.forEach(({ cellId, data }) => {
          newCellData[cellId] = { ...data, is_crossed: false };
        });
        queryClient.setQueryData(getCellsQueryKey(boxId), newCellData);
      }

      if (previousValues) {
        const headers = queryClient.getQueryData<SlideBoxHeader[]>(getSlideHeadersQueryKey(boxId));
        const headerIdToOrder: Record<string, number> = {};
        if (headers) {
          for (const h of headers) {
            headerIdToOrder[h.id] = h.display_order;
          }
        }

        const newValues = { ...previousValues };
        cells.forEach(({ cellId, headerValues }) => {
          if (!newValues[cellId]) newValues[cellId] = {};
          else newValues[cellId] = { ...newValues[cellId] };
          for (const { headerId, value } of headerValues) {
            const order = headerIdToOrder[headerId];
            if (order !== undefined) {
              newValues[cellId][order] = value;
            }
          }
        });
        queryClient.setQueryData(getSlideValuesQueryKey(boxId), newValues);
      }

      return { previousCellData, previousValues };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousCellData) {
        queryClient.setQueryData(getCellsQueryKey(boxId), context.previousCellData);
      }
      if (context?.previousValues) {
        queryClient.setQueryData(getSlideValuesQueryKey(boxId), context.previousValues);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: getCellsQueryKey(boxId) });
      queryClient.invalidateQueries({ queryKey: getSlideValuesQueryKey(boxId) });
      queryClient.invalidateQueries({ queryKey: getHistoryQueryKey(boxId) });
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: ['boxes', locationId] });
      }
      boxItemLinkService.syncAllForBox(boxId).then(() => {
        queryClient.invalidateQueries({ queryKey: ['folderItems'] });
        queryClient.invalidateQueries({ queryKey: ['lowStock'] });
      }).catch(() => {});
    },
  });
}

interface DeleteSlideCellsInput {
  cellIds: string[];
  teamMemberId?: string;
  skipHistory?: boolean;
}

export function useDeleteSlideCells(boxId: string, locationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cellIds, teamMemberId, skipHistory }: DeleteSlideCellsInput) =>
      locationCellService.deleteMultipleCells(boxId, cellIds, teamMemberId, skipHistory),
    onMutate: async ({ cellIds }) => {
      await queryClient.cancelQueries({ queryKey: getCellsQueryKey(boxId) });
      await queryClient.cancelQueries({ queryKey: getSlideValuesQueryKey(boxId) });

      const previousCellData = queryClient.getQueryData<Record<string, CellData>>(getCellsQueryKey(boxId));
      const previousValues = queryClient.getQueryData<SlideValuesMap>(getSlideValuesQueryKey(boxId));

      if (previousCellData) {
        const newCellData = { ...previousCellData };
        cellIds.forEach((cellId) => {
          delete newCellData[cellId];
        });
        queryClient.setQueryData(getCellsQueryKey(boxId), newCellData);
      }

      if (previousValues) {
        const newValues = { ...previousValues };
        cellIds.forEach((cellId) => {
          delete newValues[cellId];
        });
        queryClient.setQueryData(getSlideValuesQueryKey(boxId), newValues);
      }

      return { previousCellData, previousValues };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousCellData) {
        queryClient.setQueryData(getCellsQueryKey(boxId), context.previousCellData);
      }
      if (context?.previousValues) {
        queryClient.setQueryData(getSlideValuesQueryKey(boxId), context.previousValues);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: getCellsQueryKey(boxId) });
      queryClient.invalidateQueries({ queryKey: getSlideValuesQueryKey(boxId) });
      queryClient.invalidateQueries({ queryKey: getHistoryQueryKey(boxId) });
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: ['boxes', locationId] });
      }
      boxItemLinkService.syncAllForBox(boxId).then(() => {
        queryClient.invalidateQueries({ queryKey: ['folderItems'] });
        queryClient.invalidateQueries({ queryKey: ['lowStock'] });
      }).catch(() => {});
    },
  });
}

interface CrossSlideCellsInput {
  cellIds: string[];
  teamMemberId?: string;
}

export function useCrossSlideCells(boxId: string, locationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cellIds, teamMemberId }: CrossSlideCellsInput) =>
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
      queryClient.invalidateQueries({ queryKey: getCellsQueryKey(boxId) });
      queryClient.invalidateQueries({ queryKey: getHistoryQueryKey(boxId) });
      if (locationId) {
        queryClient.invalidateQueries({ queryKey: ['boxes', locationId] });
      }
      boxItemLinkService.syncAllForBox(boxId).then(() => {
        queryClient.invalidateQueries({ queryKey: ['folderItems'] });
        queryClient.invalidateQueries({ queryKey: ['lowStock'] });
      }).catch(() => {});
    },
  });
}
