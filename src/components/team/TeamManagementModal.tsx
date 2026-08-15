import { useState, useMemo, useRef, useEffect } from 'react';
import { X, Users, UserPlus, Crown, Shield, User, Trash2, ChevronDown, Loader2, Pencil, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTeamMembers, useAddTeamMember, useUpdateMemberRole, useRemoveMember, useUpdateDisplayName } from '../../hooks/useTeam';
import { canRemoveMember, canChangeRole, type TeamRole, type TeamMember } from '../../services/teamService';
import Portal from '../Portal';

interface TeamManagementModalProps {
  onClose: () => void;
}

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

const roleColors = {
  owner: 'text-amber-600 bg-amber-50',
  manager: 'text-blue-600 bg-blue-50',
  member: 'text-gray-600 bg-gray-50',
};

const rolePriority: Record<string, number> = {
  owner: 0,
  manager: 1,
  member: 2,
};

function getNickname(member: TeamMember): string {
  return member.display_name || member.email.split('@')[0];
}

interface NicknameEditorProps {
  member: TeamMember;
  onSave: (name: string) => Promise<void>;
  isSaving: boolean;
}

function NicknameEditor({ member, onSave, isSaving }: NicknameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(getNickname(member));
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setValue(getNickname(member));
    }
  }, [member, isEditing]);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== getNickname(member)) {
      try {
        setError(null);
        await onSave(trimmed);
        setIsEditing(false);
      } catch {
        setError('Failed to save');
      }
    } else {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setValue(getNickname(member));
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setValue(getNickname(member));
    setIsEditing(false);
  };

  const handleBlur = () => {
    if (isSaving) return;
    setValue(getNickname(member));
    setIsEditing(false);
  };

  const preventBlur = (e: React.MouseEvent) => e.preventDefault();

  if (isEditing) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={`px-2 py-0.5 text-sm font-medium border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-32 ${error ? 'border-red-300' : 'border-blue-300'}`}
            disabled={isSaving}
          />
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
          ) : (
            <>
              <button
                onMouseDown={preventBlur}
                onClick={handleSave}
                className="p-0.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                title="Confirm"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onMouseDown={preventBlur}
                onClick={handleCancel}
                className="p-0.5 rounded hover:bg-red-100 text-red-500 transition-colors"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group/nick">
      <p className="font-medium text-gray-900 truncate">{getNickname(member)}</p>
      <button
        onClick={() => setIsEditing(true)}
        className="p-0.5 text-gray-400 hover:text-blue-600 transition-colors"
        title="Edit nickname"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function TeamManagementModal({ onClose }: TeamManagementModalProps) {
  const { teamMember: currentUser, isOwner, canManageTeam } = useAuth();
  const { data: members = [], isLoading } = useTeamMembers();
  const addMemberMutation = useAddTeamMember();
  const updateRoleMutation = useUpdateMemberRole();
  const removeMemberMutation = useRemoveMember();
  const updateDisplayNameMutation = useUpdateDisplayName();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<TeamRole>('member');
  const [addError, setAddError] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  const { activeMembers, invitedMembers } = useMemo(() => {
    const active: TeamMember[] = [];
    const invited: TeamMember[] = [];
    for (const m of members) {
      if (m.auth_user_id) active.push(m);
      else invited.push(m);
    }
    active.sort((a, b) => (rolePriority[a.role ?? 'member'] ?? 2) - (rolePriority[b.role ?? 'member'] ?? 2));
    invited.sort((a, b) => a.email.localeCompare(b.email));
    return { activeMembers: active, invitedMembers: invited };
  }, [members]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    try {
      await addMemberMutation.mutateAsync({ email: newEmail, role: newRole });
      setNewEmail('');
      setNewRole('member');
      setShowAddForm(false);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : 'Failed to add member');
    }
  };

  const handleRoleChange = async (member: TeamMember, newRole: TeamRole) => {
    try {
      await updateRoleMutation.mutateAsync({ memberId: member.id, newRole });
      setEditingRoleId(null);
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    const displayName = getNickname(member);
    if (!confirm(`Are you sure you want to remove ${displayName} from the team?`)) {
      return;
    }

    try {
      await removeMemberMutation.mutateAsync(member.id);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const handleNicknameSave = async (memberId: string, name: string) => {
    await updateDisplayNameMutation.mutateAsync({ memberId, displayName: name });
  };

  const currentRole = currentUser?.role || 'member';

  const canEditNickname = (member: TeamMember): boolean => {
    if (isOwner) return true;
    return member.id === currentUser?.id;
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-gray-900/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Team Management</h2>
              <p className="text-sm text-gray-500">{members.length} member{members.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {canManageTeam && (
            <div className="mb-6">
              {showAddForm ? (
                <form onSubmit={handleAddMember} className="bg-gray-50 rounded-xl p-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="team@example.com"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Role
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as TeamRole)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="member">Member</option>
                      {isOwner && <option value="manager">Manager</option>}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {newRole === 'manager'
                        ? 'Managers can add and remove members'
                        : 'Members can view and edit all location content'}
                    </p>
                  </div>

                  {addError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                      {addError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={addMemberMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {addMemberMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Add Member'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setAddError(null);
                      }}
                      className="px-4 py-2 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 text-gray-600 font-medium rounded-xl hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all"
                >
                  <UserPlus size={18} />
                  Add Team Member
                </button>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Active Members */}
              <div className="space-y-2">
                {activeMembers.map((member) => {
                  const memberRole = member.role || 'member';
                  const RoleIcon = roleIcons[memberRole];
                  const isCurrentUser = member.id === currentUser?.id;
                  const canRemove = !isCurrentUser && canRemoveMember(currentRole, member.role);
                  const canEditRole = !isCurrentUser && canChangeRole(currentRole, member.role, 'member');

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${roleColors[memberRole]}`}>
                          <RoleIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {canEditNickname(member) ? (
                              <NicknameEditor
                                member={member}
                                onSave={(name) => handleNicknameSave(member.id, name)}
                                isSaving={updateDisplayNameMutation.isPending}
                              />
                            ) : (
                              <p className="font-medium text-gray-900 truncate">{getNickname(member)}</p>
                            )}
                            {isCurrentUser && (
                              <span className="text-xs text-gray-400">(you)</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{member.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {editingRoleId === member.id && canEditRole ? (
                          <select
                            value={memberRole}
                            onChange={(e) => handleRoleChange(member, e.target.value as TeamRole)}
                            onBlur={() => setEditingRoleId(null)}
                            autoFocus
                            className="text-sm px-2 py-1 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="member">Member</option>
                            <option value="manager">Manager</option>
                          </select>
                        ) : (
                          <button
                            onClick={() => canEditRole && setEditingRoleId(member.id)}
                            disabled={!canEditRole}
                            className={`flex items-center gap-1 text-sm px-2 py-1 rounded-lg ${roleColors[memberRole]} ${canEditRole ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                          >
                            {roleLabels[memberRole]}
                            {canEditRole && <ChevronDown className="h-3 w-3" />}
                          </button>
                        )}

                        {canRemove && (
                          <button
                            onClick={() => handleRemoveMember(member)}
                            disabled={removeMemberMutation.isPending}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Invited Members (Pending) */}
              {invitedMembers.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                    Pending Invites
                  </h3>
                  <div className="space-y-2">
                    {invitedMembers.map((member) => {
                      const memberRole = member.role || 'member';
                      const RoleIcon = roleIcons[memberRole];
                      const canRemove = canRemoveMember(currentRole, member.role);

                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 rounded-lg bg-gray-100 text-gray-400">
                              <RoleIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-700 truncate">{member.email}</p>
                              <p className="text-xs text-gray-400">Waiting for registration</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-sm px-2 py-1 rounded-lg ${roleColors[memberRole]}`}>
                              {roleLabels[memberRole]}
                            </span>
                            {canRemove && (
                              <button
                                onClick={() => handleRemoveMember(member)}
                                disabled={removeMemberMutation.isPending}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Revoke invite"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </Portal>
  );
}
