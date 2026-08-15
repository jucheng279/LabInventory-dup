import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  locationManagerService,
  LocationWithStats,
  UpdateLocationData,
} from '../services/locationManagerService';
import { useAuth } from '../contexts/AuthContext';
import { useReorderMutation } from './useReorderMutation';

export const LOCATIONS_QUERY_KEY = ['locations'];

export interface CreateLocationInput {
  name: string;
  description?: string;
  accent_color?: string | null;
  show_storage_boxes?: boolean;
  show_inventory_items?: boolean;
}

export function useLocations() {
  return useQuery({
    queryKey: LOCATIONS_QUERY_KEY,
    queryFn: () => locationManagerService.getAllLocationsWithStats(),
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  const { workspace } = useAuth();

  return useMutation({
    mutationFn: (data: CreateLocationInput) => {
      if (!workspace) {
        throw new Error('No workspace found');
      }
      return locationManagerService.createLocation({
        ...data,
        workspace_id: workspace.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
    },
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ locationId, data }: { locationId: string; data: UpdateLocationData }) =>
      locationManagerService.updateLocation(locationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
    },
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (locationId: string) => locationManagerService.deleteLocation(locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
    },
  });
}

export function useReorderLocations() {
  return useReorderMutation<LocationWithStats>({
    queryKey: LOCATIONS_QUERY_KEY,
    mutationFn: (locationIds) => locationManagerService.updateLocationOrder(locationIds),
  });
}

export function invalidateLocations(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
}
