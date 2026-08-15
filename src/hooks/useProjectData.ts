import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService } from '../services/projectService';
import type { CreateProjectData, UpdateProjectData } from '../types/database';
import { useAuth } from '../contexts/AuthContext';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getAllProjects(),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { workspace } = useAuth();

  return useMutation({
    mutationFn: (data: Omit<CreateProjectData, 'workspace_id'>) =>
      projectService.createProject({ ...data, workspace_id: workspace!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: UpdateProjectData }) =>
      projectService.updateProject(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => projectService.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useReorderProjects() {
  const queryClient = useQueryClient();
  const { workspace } = useAuth();

  return useMutation({
    mutationFn: (projectIds: string[]) =>
      projectService.reorderProjects(workspace!.id, projectIds),
    onMutate: async (projectIds) => {
      await queryClient.cancelQueries({ queryKey: ['projects'] });
      const previous = queryClient.getQueryData(['projects']);
      queryClient.setQueryData(['projects'], (old: any) => {
        if (!old) return old;
        return projectIds.map((id, index) => {
          const p = old.find((proj: any) => proj.id === id);
          return p ? { ...p, display_order: index } : null;
        }).filter(Boolean);
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['projects'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
