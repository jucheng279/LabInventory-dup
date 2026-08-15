import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  sublocationService,
  SublocationWithStats,
  CreateSublocationData,
  UpdateSublocationData,
} from '../services/sublocationService';
import { LOCATIONS_QUERY_KEY } from './useLocations';
import { getBoxesQueryKey, getItemsQueryKey } from './useWorkspaceData';
import { useReorderMutation } from './useReorderMutation';

export const ALL_SUBLOCATIONS_QUERY_KEY = ['sublocations', 'all'];
export const getSublocationsQueryKey = (locationId: string) => ['sublocations', locationId];

export function useAllSublocations() {
  return useQuery({
    queryKey: ALL_SUBLOCATIONS_QUERY_KEY,
    queryFn: () => sublocationService.getAllSublocationsWithStats(),
  });
}

export function useSublocations(locationId: string) {
  return useQuery({
    queryKey: getSublocationsQueryKey(locationId),
    queryFn: () => sublocationService.getSublocationsForLocation(locationId),
    enabled: !!locationId,
    placeholderData: keepPreviousData,
  });
}

export function useCreateSublocation(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<CreateSublocationData, 'location_id'>) =>
      sublocationService.createSublocation({ ...data, location_id: locationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: ALL_SUBLOCATIONS_QUERY_KEY });
    },
  });
}

export function useUpdateSublocation(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sublocationId, data }: { sublocationId: string; data: UpdateSublocationData }) =>
      sublocationService.updateSublocation(sublocationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: ALL_SUBLOCATIONS_QUERY_KEY });
    },
  });
}

export function useDeleteSublocation(locationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sublocationId: string) => sublocationService.deleteSublocation(sublocationId),
    onMutate: async (sublocationId) => {
      await queryClient.cancelQueries({ queryKey: getSublocationsQueryKey(locationId) });
      const previousSublocations = queryClient.getQueryData<SublocationWithStats[]>(
        getSublocationsQueryKey(locationId)
      );

      if (previousSublocations) {
        queryClient.setQueryData(
          getSublocationsQueryKey(locationId),
          previousSublocations.filter((s) => s.id !== sublocationId)
        );
      }

      return { previousSublocations };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousSublocations) {
        queryClient.setQueryData(getSublocationsQueryKey(locationId), context.previousSublocations);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: ALL_SUBLOCATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: getBoxesQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: getItemsQueryKey(locationId) });
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
    },
  });
}

export function useReorderSublocations(locationId: string) {
  return useReorderMutation<SublocationWithStats>({
    queryKey: getSublocationsQueryKey(locationId),
    mutationFn: (sublocationIds) => sublocationService.reorderSublocations(locationId, sublocationIds),
    additionalInvalidations: [ALL_SUBLOCATIONS_QUERY_KEY],
  });
}
