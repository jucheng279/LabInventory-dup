import React, { useState, useRef } from 'react';
import { X, Lock, Globe } from 'lucide-react';
import { getGridPresetIcons, getDefaultHubConfig, getDefaultIconForContext } from '../config/iconRegistry';
import SvgIcon from './SvgIcon';
import IconPresetRow from './IconPresetRow';
import ModalFrame from './ModalFrame';
import type { TeamMember } from '../types/database';
import { ACCENT_COLORS } from '../constants/accentColors';

interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (data: { name: string; icon_id: string | null; accent_color: string | null }) => void;
  teamMembers: TeamMember[];
  currentTeamMemberId: string;
  onSetupPrivacy?: (projectId: string, ownerId: string, privacyMode: string, ownerOnlyDelete: boolean, accessEntries: { team_member_id: string; access_level: string }[]) => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  onClose,
  onCreate,
  teamMembers,
  currentTeamMemberId,
}) => {
  const [name, setName] = useState('');
  const [accentColor, setAccentColor] = useState<string | null>('#3b82f6');
  const [iconId, setIconId] = useState<string | null>(getDefaultIconForContext('folder'));
  const [privacyMode, setPrivacyMode] = useState<'open' | 'restricted'>('open');
  const [ownerId, setOwnerId] = useState(currentTeamMemberId);
  const [editAccess, setEditAccess] = useState<Set<string>>(new Set());
  const [viewAccess, setViewAccess] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const folderPresets = getGridPresetIcons('folder', 4);
  const hubConfig = getDefaultHubConfig('folder');

  React.useEffect(() => { nameInputRef.current?.focus(); }, []);

  const isFormValid = name.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCreate({ name: name.trim(), icon_id: iconId, accent_color: accentColor });
    } finally {
      setIsSubmitting(false);
    }
  };

  const otherMembers = teamMembers.filter(m => m.id !== ownerId && m.workspace_id);

  const toggleEdit = (id: string) => {
    const next = new Set(editAccess);
    if (next.has(id)) { next.delete(id); } else { next.add(id); viewAccess.delete(id); setViewAccess(new Set(viewAccess)); }
    setEditAccess(next);
  };

  const toggleView = (id: string) => {
    if (editAccess.has(id)) return;
    const next = new Set(viewAccess);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    setViewAccess(next);
  };

  return (
    <ModalFrame onClose={onClose}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
            <SvgIcon iconId={iconId || 'folder1'} size={20} color={accentColor || '#3b82f6'} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <X size={18} className="text-gray-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Name</label>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
              <IconPresetRow
                presetIcons={folderPresets}
                selectedIconId={iconId}
                onSelect={setIconId}
                gridLayout="1x5"
                seeAllCategory={hubConfig.defaultCategory}
                seeAllSubcategory={hubConfig.defaultSubcategory}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Accent Color</label>
              <div className="flex flex-wrap gap-2">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setAccentColor(color.value)}
                    className={`w-8 h-8 rounded-full transition-all duration-200 ${accentColor === color.value ? 'ring-2 ring-offset-2 scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: color.value, ringColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Access Control</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrivacyMode('open')}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${privacyMode === 'open' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <Globe size={18} className={privacyMode === 'open' ? 'text-blue-600' : 'text-gray-400'} />
                  <span className={`text-xs font-medium ${privacyMode === 'open' ? 'text-blue-700' : 'text-gray-600'}`}>Open Access</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrivacyMode('restricted')}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${privacyMode === 'restricted' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <Lock size={18} className={privacyMode === 'restricted' ? 'text-amber-600' : 'text-gray-400'} />
                  <span className={`text-xs font-medium ${privacyMode === 'restricted' ? 'text-amber-700' : 'text-gray-600'}`}>Restricted</span>
                </button>
              </div>
            </div>

            {privacyMode === 'restricted' && otherMembers.length > 0 && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Owner</label>
                  <select
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {teamMembers.filter(m => m.workspace_id).map(m => (
                      <option key={m.id} value={m.id}>{m.display_name || m.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Allow Edit</label>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                    {otherMembers.map(m => (
                      <label key={m.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={editAccess.has(m.id)} onChange={() => toggleEdit(m.id)} className="rounded text-blue-500" />
                        <span className="text-xs text-gray-700 truncate">{m.display_name || m.email}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Allow View</label>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                    {otherMembers.map(m => (
                      <label key={m.id} className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer ${editAccess.has(m.id) ? 'opacity-50' : 'hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={viewAccess.has(m.id) || editAccess.has(m.id)} onChange={() => toggleView(m.id)} disabled={editAccess.has(m.id)} className="rounded text-blue-500" />
                        <span className="text-xs text-gray-700 truncate">{m.display_name || m.email}</span>
                        {editAccess.has(m.id) && <span className="text-[10px] text-gray-400 ml-auto">(has edit)</span>}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </form>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid || isSubmitting}
              className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
    </ModalFrame>
  );
};

export default CreateProjectModal;

export function buildProjectAccessEntries(
  editAccess: Set<string>,
  viewAccess: Set<string>
): { team_member_id: string; access_level: string }[] {
  const entries: { team_member_id: string; access_level: string }[] = [];
  editAccess.forEach(id => entries.push({ team_member_id: id, access_level: 'edit' }));
  viewAccess.forEach(id => { if (!editAccess.has(id)) entries.push({ team_member_id: id, access_level: 'view' }); });
  return entries;
}
