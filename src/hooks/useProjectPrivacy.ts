import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectPrivacyService } from '../services/projectPrivacyService';
import { useAuth } from '../contexts/AuthContext';
import type { ProjectAccessLevel } from '../types/database';

export function useProjectPrivacy(projectId: string | null) {
  return useQuery({
    queryKey: ['project-privacy', projectId],
    queryFn: () => projectPrivacyService.getProjectPrivacy(projectId!),
    enabled: !!projectId,
  });
}

export function useProjectAccess(projectId: string | null) {
  const { teamMember } = useAuth();

  return useQuery({
    queryKey: ['project-access', projectId, teamMember?.id],
    queryFn: () => projectPrivacyService.resolveProjectAccess(projectId!, teamMember!.id),
    enabled: !!projectId && !!teamMember?.id,
  });
}

export function useBatchProjectAccess(projectIds: string[]) {
  const { teamMember } = useAuth();

  return useQuery({
    queryKey: ['project-access-batch', projectIds.sort().join(','), teamMember?.id],
    queryFn: () => projectPrivacyService.batchResolveProjectAccess(projectIds, teamMember!.id),
    enabled: projectIds.length > 0 && !!teamMember?.id,
  });
}

export function useUpsertProjectPrivacy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      ownerId,
      privacyMode,
      ownerOnlyDelete,
      accessEntries,
    }: {
      projectId: string;
      ownerId: string;
      privacyMode: string;
      ownerOnlyDelete: boolean;
      accessEntries: { team_member_id: string; access_level: string }[];
    }) => projectPrivacyService.upsertProjectPrivacy(projectId, ownerId, privacyMode, ownerOnlyDelete, accessEntries),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-privacy', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-access'] });
      queryClient.invalidateQueries({ queryKey: ['project-access-batch'] });
    },
  });
}

export function canEditProject(accessLevel: ProjectAccessLevel | undefined): boolean {
  return accessLevel === 'owner' || accessLevel === 'edit' || accessLevel === 'open';
}

export function canViewProject(accessLevel: ProjectAccessLevel | undefined): boolean {
  return accessLevel !== 'none' && accessLevel !== undefined;
}
