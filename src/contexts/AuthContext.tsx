import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import type { TeamMember, TeamRole } from '../services/teamService';
import type { Workspace } from '../services/workspaceService';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import { getCurrentTeamMember, updateDisplayName } from '../services/teamService';
import {
  getWorkspaceForUser,
  createWorkspace as createWorkspaceService,
  linkOwnerToWorkspace,
  updateWorkspaceName,
} from '../services/workspaceService';
import { clearAIChatState } from '../hooks/useAIChat';

type AuthStatus = 'loading' | 'unauthenticated' | 'pending_access' | 'pending_workspace_setup' | 'authenticated' | 'password_recovery';

interface AuthContextValue {
  user: User | null;
  teamMember: TeamMember | null;
  workspace: Workspace | null;
  status: AuthStatus;
  isOwner: boolean;
  isManager: boolean;
  isMember: boolean;
  canManageTeam: boolean;
  canManageManagers: boolean;
  refreshTeamMember: () => Promise<void>;
  createWorkspace: (name: string) => Promise<boolean>;
  renameWorkspace: (name: string) => Promise<void>;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const checkTeamMembership = useCallback(async (authUser: User) => {
    try {
      let member = await getCurrentTeamMember(authUser.id);

      if (member && !member.display_name && member.email) {
        const defaultName = member.email.split('@')[0];
        try {
          member = await updateDisplayName(member.id, defaultName);
        } catch (_) { /* non-critical */ }
      }

      setTeamMember(member);

      if (!member || !member.role) {
        setStatus('pending_access');
        return;
      }

      if (member.role === 'owner' && !member.workspace_id) {
        setStatus('pending_workspace_setup');
        return;
      }

      if (!member.workspace_id) {
        setStatus('pending_access');
        return;
      }

      const userWorkspace = await getWorkspaceForUser();
      setWorkspace(userWorkspace);
      setStatus('authenticated');
    } catch (error) {
      console.error('Error checking team membership:', error);
      setStatus('pending_access');
    }
  }, []);

  const refreshTeamMember = useCallback(async () => {
    if (user) {
      await checkTeamMembership(user);
    }
  }, [user, checkTeamMembership]);

  const createWorkspace = useCallback(async (name: string): Promise<boolean> => {
    if (!teamMember) return false;

    try {
      const newWorkspace = await createWorkspaceService(name, teamMember.id);
      await linkOwnerToWorkspace(teamMember.id, newWorkspace.id);

      setWorkspace(newWorkspace);
      setTeamMember(prev => prev ? { ...prev, workspace_id: newWorkspace.id } : null);
      setStatus('authenticated');
      return true;
    } catch (error) {
      console.error('Error creating workspace:', error);
      return false;
    }
  }, [teamMember]);

  const renameWorkspace = useCallback(async (name: string): Promise<void> => {
    if (!workspace) throw new Error('No workspace loaded');
    const updated = await updateWorkspaceName(workspace.id, name);
    setWorkspace(updated);
  }, [workspace]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const authUser = session?.user ?? null;
        setUser(authUser);

        if (event === 'PASSWORD_RECOVERY') {
          setStatus('password_recovery');
          return;
        }

        if (authUser) {
          if (event === 'SIGNED_IN') {
            queryClient.removeQueries();
            clearAIChatState();
          }
          checkTeamMembership(authUser);
        } else {
          setTeamMember(null);
          setWorkspace(null);
          setStatus('unauthenticated');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [checkTeamMembership]);

  const clearPasswordRecovery = useCallback(() => {
    if (user) {
      checkTeamMembership(user);
    }
    window.history.replaceState({}, '', '/');
  }, [user, checkTeamMembership]);

  const role: TeamRole | null = teamMember?.role ?? null;
  const isOwner = role === 'owner';
  const isManager = role === 'manager';
  const isMember = role === 'member';
  const canManageTeam = isOwner || isManager;
  const canManageManagers = isOwner;

  return (
    <AuthContext.Provider
      value={{
        user,
        teamMember,
        workspace,
        status,
        isOwner,
        isManager,
        isMember,
        canManageTeam,
        canManageManagers,
        refreshTeamMember,
        createWorkspace,
        renameWorkspace,
        clearPasswordRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
