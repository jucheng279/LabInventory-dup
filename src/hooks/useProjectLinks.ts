import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectLinkService } from '../services/projectLinkService';

export function useProjectBoxLinks(projectId: string | null, experimentId?: string | null) {
  return useQuery({
    queryKey: ['project-box-links', projectId, experimentId],
    queryFn: () => projectLinkService.getProjectBoxLinks(projectId!, experimentId),
    enabled: !!projectId,
  });
}

export function useProjectItemLinks(projectId: string | null, experimentId?: string | null) {
  return useQuery({
    queryKey: ['project-item-links', projectId, experimentId],
    queryFn: () => projectLinkService.getProjectItemLinks(projectId!, experimentId),
    enabled: !!projectId,
  });
}

export function useAllProjectLinks(projectId: string | null) {
  return useQuery({
    queryKey: ['project-all-links', projectId],
    queryFn: () => projectLinkService.getAllLinksForProject(projectId!),
    enabled: !!projectId,
  });
}

export function useAddBoxToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, experimentId, boxId }: { projectId: string; experimentId: string | null; boxId: string }) =>
      projectLinkService.addBoxToProject(projectId, experimentId, boxId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-box-links'] });
      queryClient.invalidateQueries({ queryKey: ['project-all-links'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });
}

export function useAddItemToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, experimentId, itemId }: { projectId: string; experimentId: string | null; itemId: string }) =>
      projectLinkService.addItemToProject(projectId, experimentId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-item-links'] });
      queryClient.invalidateQueries({ queryKey: ['project-all-links'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });
}

export function useRemoveBoxFromProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => projectLinkService.removeBoxFromProject(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-box-links'] });
      queryClient.invalidateQueries({ queryKey: ['project-all-links'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });
}

export function useRemoveItemFromProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => projectLinkService.removeItemFromProject(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-item-links'] });
      queryClient.invalidateQueries({ queryKey: ['project-all-links'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });
}

export function useMoveBoxLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ linkId, targetProjectId, targetExperimentId }: { linkId: string; targetProjectId: string; targetExperimentId: string | null }) =>
      projectLinkService.moveBoxLink(linkId, targetProjectId, targetExperimentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-box-links'] });
      queryClient.invalidateQueries({ queryKey: ['project-all-links'] });
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });
}

export function useMoveItemLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ linkId, targetProjectId, targetExperimentId }: { linkId: string; targetProjectId: string; targetExperimentId: string | null }) =>
      projectLinkService.moveItemLink(linkId, targetProjectId, targetExperimentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-item-links'] });
      queryClient.invalidateQueries({ queryKey: ['project-all-links'] });
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });
}
