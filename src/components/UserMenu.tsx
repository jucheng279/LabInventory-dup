import { useState, useRef, useEffect } from 'react';
import { User, Users, LogOut, ChevronDown, Crown, Shield, Settings, HardDrive } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../services/authService';
import { queryClient } from '../lib/queryClient';
import { clearAIChatState } from '../hooks/useAIChat';
import TeamManagementModal from './team/TeamManagementModal';
import WorkspaceModal from './WorkspaceModal';
import BackupModal from './BackupModal';

const roleIcons = {
  owner: Crown,
  manager: Shield,
  member: User,
};

const roleLabels = {
  owner: 'Owner',
  manager: 'Manager',
  member: 'Member',
};

export default function UserMenu() {
  const { user, teamMember, canManageTeam } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      queryClient.clear();
      clearAIChatState();
      localStorage.removeItem('selectedLocationId');
      localStorage.removeItem('selectedSublocationId');
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const role = teamMember?.role || 'member';
  const RoleIcon = roleIcons[role];

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-medium">
            {(teamMember?.display_name || user?.email)?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
              {teamMember?.display_name || user?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <RoleIcon className="h-3 w-3" />
              {roleLabels[role]}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900 truncate">{teamMember?.display_name || user?.email?.split('@')[0]}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <RoleIcon className="h-3 w-3" />
                {roleLabels[role]}
              </p>
            </div>

            <button
              onClick={() => {
                setIsOpen(false);
                setShowWorkspaceModal(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings className="h-4 w-4 text-gray-400" />
              Manage Workspace
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                setShowTeamModal(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Users className="h-4 w-4 text-gray-400" />
              {canManageTeam ? 'Manage Team' : 'View Team'}
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                setShowBackupModal(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <HardDrive className="h-4 w-4 text-gray-400" />
              Manage Backup
            </button>

            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showTeamModal && (
        <TeamManagementModal onClose={() => setShowTeamModal(false)} />
      )}

      {showWorkspaceModal && (
        <WorkspaceModal onClose={() => setShowWorkspaceModal(false)} />
      )}

      {showBackupModal && (
        <BackupModal onClose={() => setShowBackupModal(false)} />
      )}
    </>
  );
}
