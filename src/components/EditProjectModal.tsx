import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { getGridPresetIcons, getDefaultHubConfig, getDefaultIconForContext } from '../config/iconRegistry';
import SvgIcon from './SvgIcon';
import IconPresetRow from './IconPresetRow';
import ModalFrame from './ModalFrame';
import { ACCENT_COLORS } from '../constants/accentColors';
import type { Project } from '../types/database';

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
  onSave: (data: { name: string; icon_id: string | null; accent_color: string | null }) => void;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, onClose, onSave }) => {
  const [name, setName] = useState(project.name);
  const [accentColor, setAccentColor] = useState<string | null>(project.accent_color || '#3b82f6');
  const [iconId, setIconId] = useState<string | null>(project.icon_id || getDefaultIconForContext('folder'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const folderPresets = getGridPresetIcons('folder', 4);
  const hubConfig = getDefaultHubConfig('folder');

  useEffect(() => { nameInputRef.current?.focus(); }, []);

  const isFormValid = name.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSave({ name: name.trim(), icon_id: iconId, accent_color: accentColor });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalFrame onClose={onClose}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
            <SvgIcon iconId={iconId || 'folder1'} size={20} color={accentColor || '#3b82f6'} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Edit Project</h2>
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
              <IconPresetRow presetIcons={folderPresets} selectedIconId={iconId} onSelect={setIconId} gridLayout="1x5" seeAllCategory={hubConfig.defaultCategory} seeAllSubcategory={hubConfig.defaultSubcategory} />
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
          </form>

      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
        <button onClick={handleSubmit} disabled={!isFormValid || isSubmitting} className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </ModalFrame>
  );
};

export default EditProjectModal;
