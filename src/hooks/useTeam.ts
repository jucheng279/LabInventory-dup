import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import {
  getTeamMembers,
  addTeamMember,
  updateMemberRole,
  removeMember,
  updateDisplayName,
  type AddMemberData,
  type TeamRole,
} from '../services/teamService';

export const TEAM_QUERY_KEY = ['team-members'];

export function useTeamMembers() {
  return useQuery({
    queryKey: TEAM_QUERY_KEY,
    queryFn: getTeamMembers,
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();
  const { teamMember, workspace } = useAuth();

  return useMutation({
    mutationFn: (data: AddMemberData) => {
      if (!teamMember) {
        throw new Error('Not authenticated');
      }
      if (!workspace) {
        throw new Error('No workspace found');
      }
      return addTeamMember(data, teamMember.id, workspace.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, newRole }: { memberId: string; newRole: TeamRole }) =>
      updateMemberRole(memberId, newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  const { workspace } = useAuth();

  return useMutation({
    mutationFn: (memberId: string) => removeMember(memberId, workspace!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY });
    },
  });
}

export function useUpdateDisplayName() {
  const queryClient = useQueryClient();
  const { refreshTeamMember } = useAuth();

  return useMutation({
    mutationFn: ({ memberId, displayName }: { memberId: string; displayName: string | null }) =>
      updateDisplayName(memberId, displayName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY });
      refreshTeamMember();
    },
  });
}
