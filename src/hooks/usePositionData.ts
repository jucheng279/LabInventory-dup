import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  positionService,
  PositionWithStats,
  CreatePositionData,
  UpdatePositionData,
} from '../services/positionService';
import { ALL_SUBLOCATIONS_QUERY_KEY, getSublocationsQueryKey } from './useSublocationData';
import { LOCATIONS_QUERY_KEY } from './useLocations';
import { getBoxesQueryKey, getItemsQueryKey } from './useWorkspaceData';
import { useReorderMutation } from './useReorderMutation';

export const ALL_POSITIONS_QUERY_KEY = ['positions', 'all'];
export const getPositionsQueryKey = (sublocationId: string) => ['positions', sublocationId];

export function useAllPositions() {
  return useQuery({
    queryKey: ALL_POSITIONS_QUERY_KEY,
    queryFn: () => positionService.getAllPositionsWithStats(),
  });
}

export function usePositions(sublocationId: string) {
  return useQuery({
    queryKey: getPositionsQueryKey(sublocationId),
    queryFn: () => positionService.getPositionsForSublocation(sublocationId),
    enabled: !!sublocationId,
    placeholderData: keepPreviousData,
  });
}

export function useCreatePosition(sublocationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<CreatePositionData, 'sublocation_id'>) =>
      positionService.createPosition({ ...data, sublocation_id: sublocationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getPositionsQueryKey(sublocationId) });
      queryClient.invalidateQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
    },
  });
}

export function useUpdatePosition(sublocationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ positionId, data }: { positionId: string; data: UpdatePositionData }) =>
      positionService.updatePosition(positionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getPositionsQueryKey(sublocationId) });
      queryClient.invalidateQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
    },
  });
}

export function useReorderPositions(sublocationId: string) {
  return useReorderMutation<PositionWithStats>({
    queryKey: getPositionsQueryKey(sublocationId),
    mutationFn: (positionIds) => positionService.reorderPositions(sublocationId, positionIds),
    additionalInvalidations: [ALL_POSITIONS_QUERY_KEY],
  });
}

export function useDeletePosition(sublocationId: string, locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (positionId: string) => positionService.deletePosition(positionId),
    onMutate: async (positionId) => {
      await queryClient.cancelQueries({ queryKey: getPositionsQueryKey(sublocationId) });
      const previousPositions = queryClient.getQueryData<PositionWithStats[]>(
        getPositionsQueryKey(sublocationId)
      );

      if (previousPositions) {
        queryClient.setQueryData(
          getPositionsQueryKey(sublocationId),
          previousPositions.filter((p) => p.id !== positionId)
        );
      }

      return { previousPositions };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousPositions) {
        queryClient.setQueryData(getPositionsQueryKey(sublocationId), context.previousPositions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: getPositionsQueryKey(sublocationId) });
      queryClient.invalidateQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ALL_SUBLOCATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getBoxesQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getItemsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
    },
  });
}
