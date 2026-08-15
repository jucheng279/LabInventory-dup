import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transferService } from '../services/transferService';
import { LOCATIONS_QUERY_KEY } from './useLocations';
import { getBoxesQueryKey, getItemsQueryKey } from './useWorkspaceData';
import { getSublocationsQueryKey } from './useSublocationData';
import { getFoldersQueryKey } from './useItemFolderData';

function invalidateAllLocationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  locationIds: string[]
) {
  for (const locationId of locationIds) {
    queryClient.invalidateQueries({ queryKey: getBoxesQueryKey(locationId) });
    queryClient.invalidateQueries({ queryKey: getItemsQueryKey(locationId) });
    queryClient.invalidateQueries({ queryKey: getFoldersQueryKey(locationId) });
    queryClient.invalidateQueries({ queryKey: getSublocationsQueryKey(locationId) });
  }
  queryClient.invalidateQueries({ queryKey: ['sublocations'] });
  queryClient.invalidateQueries({ queryKey: ['positions'] });
  queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: ['folderItems'] });
  queryClient.invalidateQueries({ queryKey: ['folderCustomValues'] });
}

export function useTransferLocationToLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceLocationId, targetLocationId }: {
      sourceLocationId: string;
      targetLocationId: string;
    }) => transferService.transferLocationToLocation(sourceLocationId, targetLocationId),
    onSettled: (_data, _err, { sourceLocationId, targetLocationId }) => {
      invalidateAllLocationQueries(queryClient, [sourceLocationId, targetLocationId]);
    },
  });
}

export function useTransferLocationToSublocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceLocationId, targetSublocationId }: {
      sourceLocationId: string;
      targetSublocationId: string;
      targetLocationId: string;
    }) => transferService.transferLocationToSublocation(sourceLocationId, targetSublocationId),
    onSettled: (_data, _err, { sourceLocationId, targetLocationId }) => {
      invalidateAllLocationQueries(queryClient, [sourceLocationId, targetLocationId]);
    },
  });
}

export function useTransferSublocationToLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceSublocationId, targetLocationId }: {
      sourceSublocationId: string;
      targetLocationId: string;
      sourceLocationId: string;
    }) => transferService.transferSublocationToLocation(sourceSublocationId, targetLocationId),
    onSettled: (_data, _err, { sourceLocationId, targetLocationId }) => {
      invalidateAllLocationQueries(queryClient, [sourceLocationId, targetLocationId]);
    },
  });
}

export function useTransferSublocationToSublocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceSublocationId, targetSublocationId }: {
      sourceSublocationId: string;
      targetSublocationId: string;
      sourceLocationId: string;
      targetLocationId: string;
    }) => transferService.transferSublocationToSublocation(sourceSublocationId, targetSublocationId),
    onSettled: (_data, _err, { sourceLocationId, targetLocationId }) => {
      invalidateAllLocationQueries(queryClient, [sourceLocationId, targetLocationId]);
    },
  });
}

export function useTransferPositionToLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourcePositionId, targetLocationId }: {
      sourcePositionId: string;
      targetLocationId: string;
      sourceLocationId: string;
    }) => transferService.transferPositionToLocation(sourcePositionId, targetLocationId),
    onSettled: (_data, _err, { sourceLocationId, targetLocationId }) => {
      invalidateAllLocationQueries(queryClient, [sourceLocationId, targetLocationId]);
    },
  });
}

export function useTransferPositionToSublocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourcePositionId, targetSublocationId }: {
      sourcePositionId: string;
      targetSublocationId: string;
      sourceLocationId: string;
      targetLocationId: string;
    }) => transferService.transferPositionToSublocation(sourcePositionId, targetSublocationId),
    onSettled: (_data, _err, { sourceLocationId, targetLocationId }) => {
      invalidateAllLocationQueries(queryClient, [sourceLocationId, targetLocationId]);
    },
  });
}
