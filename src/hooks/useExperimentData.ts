import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { experimentService } from '../services/experimentService';
import type { CreateExperimentData, UpdateExperimentData } from '../types/database';

export function useExperiments(projectId: string | null) {
  return useQuery({
    queryKey: ['experiments', projectId],
    queryFn: () => experimentService.getExperimentsForProject(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateExperiment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<CreateExperimentData, 'project_id'>) =>
      experimentService.createExperiment({ ...data, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateExperiment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ experimentId, data }: { experimentId: string; data: UpdateExperimentData }) =>
      experimentService.updateExperiment(experimentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteExperiment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (experimentId: string) => experimentService.deleteExperiment(experimentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-box-links'] });
      queryClient.invalidateQueries({ queryKey: ['project-item-links'] });
    },
  });
}

export function useReorderExperiments(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (experimentIds: string[]) =>
      experimentService.reorderExperiments(projectId, experimentIds),
    onMutate: async (experimentIds) => {
      await queryClient.cancelQueries({ queryKey: ['experiments', projectId] });
      const previous = queryClient.getQueryData(['experiments', projectId]);
      queryClient.setQueryData(['experiments', projectId], (old: any) => {
        if (!old) return old;
        return experimentIds.map((id, index) => {
          const e = old.find((exp: any) => exp.id === id);
          return e ? { ...e, display_order: index } : null;
        }).filter(Boolean);
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['experiments', projectId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments', projectId] });
    },
  });
}
