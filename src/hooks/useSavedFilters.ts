import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { searchFilterService } from '../services/searchFilterService';
import type { SavedSearchFilter } from '../types/search';

const SAVED_FILTERS_KEY = ['saved-search-filters'];
const SLIDE_HEADERS_KEY = ['workspace-slide-headers'];
const ITEM_FOLDER_HEADERS_KEY = ['workspace-item-folder-headers'];
const ITEM_FOLDER_NAMES_KEY = ['workspace-item-folder-names'];
const FREEZER_BOX_HEADERS_KEY = ['workspace-freezer-box-headers'];

export function useSavedFilters() {
  const { workspace, teamMember } = useAuth();
  const queryClient = useQueryClient();

  const filtersQuery = useQuery({
    queryKey: [...SAVED_FILTERS_KEY, workspace?.id, teamMember?.id],
    queryFn: () => searchFilterService.getSavedFilters(workspace!.id, teamMember!.id),
    enabled: !!workspace?.id && !!teamMember?.id,
  });

  const addMutation = useMutation({
    mutationFn: (filterText: string) =>
      searchFilterService.createFilter(workspace!.id, teamMember!.id, filterText),
    onMutate: async (filterText) => {
      await queryClient.cancelQueries({ queryKey: [...SAVED_FILTERS_KEY, workspace?.id, teamMember?.id] });
      const previous = queryClient.getQueryData<SavedSearchFilter[]>([...SAVED_FILTERS_KEY, workspace?.id, teamMember?.id]);
      queryClient.setQueryData<SavedSearchFilter[]>(
        [...SAVED_FILTERS_KEY, workspace?.id, teamMember?.id],
        (old) => [
          ...(old || []),
          {
            id: `temp-${Date.now()}`,
            workspaceId: workspace!.id,
            teamMemberId: teamMember!.id,
            filterText,
            createdAt: new Date().toISOString(),
          },
        ],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData([...SAVED_FILTERS_KEY, workspace?.id, teamMember?.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [...SAVED_FILTERS_KEY, workspace?.id, teamMember?.id] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (filterId: string) => searchFilterService.deleteFilter(filterId),
    onMutate: async (filterId) => {
      await queryClient.cancelQueries({ queryKey: [...SAVED_FILTERS_KEY, workspace?.id, teamMember?.id] });
      const previous = queryClient.getQueryData<SavedSearchFilter[]>([...SAVED_FILTERS_KEY, workspace?.id, teamMember?.id]);
      queryClient.setQueryData<SavedSearchFilter[]>(
        [...SAVED_FILTERS_KEY, workspace?.id, teamMember?.id],
        (old) => (old || []).filter((f) => f.id !== filterId),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData([...SAVED_FILTERS_KEY, workspace?.id, teamMember?.id], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [...SAVED_FILTERS_KEY, workspace?.id, teamMember?.id] });
    },
  });

  return {
    savedFilters: filtersQuery.data || [],
    isLoading: filtersQuery.isLoading,
    addFilter: addMutation.mutate,
    removeFilter: removeMutation.mutate,
  };
}

export function useWorkspaceSlideHeaders() {
  return useQuery({
    queryKey: SLIDE_HEADERS_KEY,
    queryFn: () => searchFilterService.getWorkspaceSlideHeaders(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWorkspaceItemFolderHeaders() {
  return useQuery({
    queryKey: ITEM_FOLDER_HEADERS_KEY,
    queryFn: () => searchFilterService.getWorkspaceItemFolderHeaders(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWorkspaceItemFolderNames() {
  return useQuery({
    queryKey: ITEM_FOLDER_NAMES_KEY,
    queryFn: () => searchFilterService.getWorkspaceItemFolderNames(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWorkspaceFreezerBoxHeaders() {
  return useQuery({
    queryKey: FREEZER_BOX_HEADERS_KEY,
    queryFn: () => searchFilterService.getWorkspaceFreezerBoxHeaders(),
    staleTime: 5 * 60 * 1000,
  });
}
