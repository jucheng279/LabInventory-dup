import React, { useState, useEffect, useMemo } from 'react';
import { X, Shield, Globe, Lock, Check, Info } from 'lucide-react';
import Portal from './Portal';
import type { TeamMember, BoxPrivacyMode, BoxAccessEntry } from '../types/database';

interface BoxPrivacySettingsModalProps {
  onClose: () => void;
  onSave: (settings: PrivacyFormState) => void;
  teamMembers: TeamMember[];
  currentTeamMemberId: string;
  workspaceOwnerId?: string;
  readOnly?: boolean;
  initialSettings?: PrivacyFormState | null;
}

export interface PrivacyFormState {
  privacyMode: BoxPrivacyMode;
  ownerId: string;
  ownerOnlyDelete: boolean;
  editMembers: string[];
  viewMembers: string[];
}

const BoxPrivacySettingsModal: React.FC<BoxPrivacySettingsModalProps> = ({
  onClose,
  onSave,
  teamMembers,
  currentTeamMemberId,
  workspaceOwnerId,
  readOnly = false,
  initialSettings,
}) => {
  const [privacyMode, setPrivacyMode] = useState<BoxPrivacyMode>(
    initialSettings?.privacyMode || 'open'
  );
  const [ownerId, setOwnerId] = useState(
    initialSettings?.ownerId || currentTeamMemberId
  );
  const [ownerOnlyDelete, setOwnerOnlyDelete] = useState(
    initialSettings?.ownerOnlyDelete || false
  );
  const [editMembers, setEditMembers] = useState<Set<string>>(
    new Set(initialSettings?.editMembers || [])
  );
  const [viewMembers, setViewMembers] = useState<Set<string>>(
    new Set(initialSettings?.viewMembers || [])
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const eligibleMembers = useMemo(
    () => teamMembers.filter((m) => m.id !== ownerId && m.id !== workspaceOwnerId && m.workspace_id),
    [teamMembers, ownerId, workspaceOwnerId]
  );

  const handleOwnerChange = (newOwnerId: string) => {
    setOwnerId(newOwnerId);
    setEditMembers((prev) => {
      const next = new Set(prev);
      next.delete(newOwnerId);
      return next;
    });
    setViewMembers((prev) => {
      const next = new Set(prev);
      next.delete(newOwnerId);
      return next;
    });
  };

  const toggleEditMember = (memberId: string) => {
    setEditMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const toggleViewMember = (memberId: string) => {
    setViewMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const selectAllEdit = () => {
    setEditMembers(new Set(eligibleMembers.map((m) => m.id)));
  };

  const deselectAllEdit = () => {
    setEditMembers(new Set());
  };

  const selectAllView = () => {
    setViewMembers(new Set(eligibleMembers.map((m) => m.id)));
  };

  const deselectAllView = () => {
    setViewMembers(new Set());
  };

  const handleSave = () => {
    const excludeId = workspaceOwnerId;
    onSave({
      privacyMode,
      ownerId,
      ownerOnlyDelete,
      editMembers: Array.from(editMembers).filter((id) => id !== excludeId),
      viewMembers: Array.from(viewMembers).filter((id) => !editMembers.has(id) && id !== excludeId),
    });
    onClose();
  };

  const getMemberLabel = (m: TeamMember) =>
    m.display_name || m.email;

  const ownerMember = teamMembers.find((m) => m.id === ownerId);

  const allEditSelected = eligibleMembers.length > 0 && eligibleMembers.every((m) => editMembers.has(m.id));
  const allViewSelected = eligibleMembers.length > 0 && eligibleMembers.every((m) => viewMembers.has(m.id));

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          onClick={onClose}
        />

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
          <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50">
                <Shield size={20} className="text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                Access Settings
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
            {readOnly && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                <Info size={16} className="text-gray-400 flex-shrink-0" />
                <p className="text-xs text-gray-500">Only the box owner can change these settings.</p>
              </div>
            )}

            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => !readOnly && setPrivacyMode('open')}
                disabled={readOnly}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                  readOnly ? 'cursor-default' : ''
                } ${
                  privacyMode === 'open'
                    ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                    : `border-gray-200 ${readOnly ? '' : 'hover:border-gray-300'} bg-white`
                }`}
              >
                {privacyMode === 'open' && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                )}
                <Globe
                  size={24}
                  className={
                    privacyMode === 'open' ? 'text-blue-600' : 'text-gray-400'
                  }
                />
                <div className="text-center">
                  <div
                    className={`text-sm font-semibold ${
                      privacyMode === 'open'
                        ? 'text-blue-700'
                        : 'text-gray-700'
                    }`}
                  >
                    Open Access
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Everyone can view and edit
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => !readOnly && setPrivacyMode('restricted')}
                disabled={readOnly}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                  readOnly ? 'cursor-default' : ''
                } ${
                  privacyMode === 'restricted'
                    ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                    : `border-gray-200 ${readOnly ? '' : 'hover:border-gray-300'} bg-white`
                }`}
              >
                {privacyMode === 'restricted' && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                    <Check size={12} className="text-white" />
                  </div>
                )}
                <Lock
                  size={24}
                  className={
                    privacyMode === 'restricted'
                      ? 'text-amber-600'
                      : 'text-gray-400'
                  }
                />
                <div className="text-center">
                  <div
                    className={`text-sm font-semibold ${
                      privacyMode === 'restricted'
                        ? 'text-amber-700'
                        : 'text-gray-700'
                    }`}
                  >
                    Restricted Access
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Only allowed members
                  </div>
                </div>
              </button>
            </div>

            {/* Restricted mode panel */}
            {!readOnly && privacyMode === 'restricted' && (
              <div className="space-y-4 animate-fade-in">
                {/* Owner selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Box Owner <span className="font-normal text-gray-500">(The owner has full control over this box access.)</span>
                  </label>
                  <select
                    value={ownerId}
                    onChange={(e) => handleOwnerChange(e.target.value)}
                    disabled={readOnly}
                    className={`w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-sm bg-white ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {teamMembers
                      .filter((m) => m.workspace_id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {getMemberLabel(m)}
                          {m.id === currentTeamMemberId ? ' (you)' : ''}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Allow Edit */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Allow Edit <span className="font-normal text-gray-500">(Can edit the box.)</span>
                    </label>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={allEditSelected ? deselectAllEdit : selectAllEdit}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {allEditSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  <div className={`border border-gray-200 rounded-xl max-h-36 overflow-y-auto ${readOnly ? 'opacity-60' : ''}`}>
                    {eligibleMembers.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-gray-400 text-center">
                        No other workspace members
                      </div>
                    ) : (
                      eligibleMembers.map((m) => (
                        <label
                          key={m.id}
                          className={`flex items-center gap-3 px-3 py-2 transition-colors border-b border-gray-100 last:border-b-0 ${readOnly ? 'cursor-default' : 'hover:bg-gray-50 cursor-pointer'}`}
                        >
                          <input
                            type="checkbox"
                            checked={editMembers.has(m.id)}
                            onChange={() => toggleEditMember(m.id)}
                            disabled={readOnly}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-800 truncate">
                              {getMemberLabel(m)}
                            </div>
                            {m.display_name && (
                              <div className="text-xs text-gray-400 truncate">
                                {m.email}
                              </div>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Allow View */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Allow View <span className="font-normal text-gray-500">(Can only view box content.)</span>
                    </label>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={allViewSelected ? deselectAllView : selectAllView}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {allViewSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  <div className={`border border-gray-200 rounded-xl max-h-36 overflow-y-auto ${readOnly ? 'opacity-60' : ''}`}>
                    {eligibleMembers.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-gray-400 text-center">
                        No other workspace members
                      </div>
                    ) : (
                      eligibleMembers.map((m) => {
                        const hasEdit = editMembers.has(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`flex items-center gap-3 px-3 py-2 transition-colors border-b border-gray-100 last:border-b-0 ${
                              readOnly
                                ? 'cursor-default'
                                : hasEdit
                                  ? 'bg-gray-50 opacity-50'
                                  : 'hover:bg-gray-50 cursor-pointer'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={viewMembers.has(m.id) || hasEdit}
                              disabled={readOnly || hasEdit}
                              onChange={() => toggleViewMember(m.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-800 truncate">
                                {getMemberLabel(m)}
                                {hasEdit && (
                                  <span className="ml-1.5 text-xs text-blue-500 font-medium">
                                    (has edit access)
                                  </span>
                                )}
                              </div>
                              {m.display_name && (
                                <div className="text-xs text-gray-400 truncate">
                                  {m.email}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Owner-only delete toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="text-sm font-medium text-gray-700">
                    Only the box owner can delete this box
                  </div>
                  <button
                    type="button"
                    onClick={() => !readOnly && setOwnerOnlyDelete(!ownerOnlyDelete)}
                    disabled={readOnly}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                      readOnly ? 'cursor-not-allowed opacity-60' : ''
                    } ${
                      ownerOnlyDelete ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                        ownerOnlyDelete ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 flex gap-3 p-5 border-t border-gray-100">
            {readOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 py-2.5 px-4 rounded-xl font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md shadow-blue-500/20 transition-all"
                >
                  Save Settings
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default BoxPrivacySettingsModal;

export function privacyFormToAccessEntries(
  form: PrivacyFormState,
): { team_member_id: string; access_level: 'edit' | 'view' }[] {
  const entries: { team_member_id: string; access_level: 'edit' | 'view' }[] = [];
  const editSet = new Set(form.editMembers);

  for (const id of form.editMembers) {
    entries.push({ team_member_id: id, access_level: 'edit' });
  }

  for (const id of form.viewMembers) {
    if (!editSet.has(id)) {
      entries.push({ team_member_id: id, access_level: 'view' });
    }
  }

  return entries;
}

export function boxPrivacyDataToFormState(
  settings: { privacy_mode: string; owner_id: string; owner_only_delete: boolean } | null,
  accessList: { team_member_id: string; access_level: string }[],
): PrivacyFormState {
  if (!settings) {
    return {
      privacyMode: 'open',
      ownerId: '',
      ownerOnlyDelete: false,
      editMembers: [],
      viewMembers: [],
    };
  }

  return {
    privacyMode: settings.privacy_mode as 'open' | 'restricted',
    ownerId: settings.owner_id,
    ownerOnlyDelete: settings.owner_only_delete,
    editMembers: accessList
      .filter((e) => e.access_level === 'edit')
      .map((e) => e.team_member_id),
    viewMembers: accessList
      .filter((e) => e.access_level === 'view')
      .map((e) => e.team_member_id),
  };
}
