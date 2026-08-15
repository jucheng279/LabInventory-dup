import React, { useState, useEffect, useRef } from 'react';
import { X, Package, Shield } from 'lucide-react';
import { CreateBoxData } from '../services/boxService';
import { getGridPresetIcons, getDefaultHubConfig, getDefaultIconForContext } from '../config/iconRegistry';
import SvgIcon from './SvgIcon';
import IconPresetRow from './IconPresetRow';
import ModalFrame from './ModalFrame';
import BoxPrivacySettingsModal, { PrivacyFormState } from './BoxPrivacySettingsModal';
import { ACCENT_COLORS } from '../constants/accentColors';
import type { TeamMember } from '../types/database';
import { useTutorial } from '../tutorial/TutorialContext';

interface CreateBoxModalProps {
  onClose: () => void;
  onCreate: (data: Omit<CreateBoxData, 'location_id'>, privacySettings?: PrivacyFormState) => void;
  teamMembers?: TeamMember[];
  currentTeamMemberId?: string;
  workspaceOwnerId?: string;
}

const CreateBoxModal: React.FC<CreateBoxModalProps> = ({ onClose, onCreate, teamMembers, currentTeamMemberId, workspaceOwnerId }) => {
  const { state: tutorialState } = useTutorial();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accentColor, setAccentColor] = useState<string | null>('#3b82f6');
  const [rows, setRows] = useState(() => tutorialState.isActive ? '9' : '');
  const [columns, setColumns] = useState(() => tutorialState.isActive ? '9' : '');
  const [iconId, setIconId] = useState<string | null>(getDefaultIconForContext('box'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<PrivacyFormState | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const boxPresets = getGridPresetIcons('box', 4);
  const hubConfig = getDefaultHubConfig('box');

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);


  const isValidDimension = (value: string) => {
    const num = parseInt(value);
    return !isNaN(num) && num >= 1 && num <= 20;
  };

  const isFormValid = name.trim() && isValidDimension(rows) && isValidDimension(columns);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!tutorialState.isActive && !isFormValid) return;

    setIsSubmitting(true);
    try {
      await onCreate(
        {
          name: name.trim(),
          description: description.trim(),
          accent_color: accentColor,
          icon_id: iconId,
          rows: parseInt(rows),
          columns: parseInt(columns),
        },
        privacySettings || undefined,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalFrame onClose={onClose} allowOverflow>
        <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <SvgIcon iconId={iconId} size={20} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Create New Box</h2>
          </div>
          <div className="flex items-center gap-1">
            {teamMembers && currentTeamMemberId && (
              <button
                type="button"
                onClick={() => setShowPrivacy(true)}
                className={`p-2 rounded-lg transition-colors ${
                  privacySettings?.privacyMode === 'restricted'
                    ? 'bg-amber-50 hover:bg-amber-100'
                    : 'hover:bg-gray-100'
                }`}
                title={privacySettings?.privacyMode === 'restricted' ? 'Restricted Access' : 'Open Access'}
              >
                <Shield size={18} className={privacySettings?.privacyMode === 'restricted' ? 'text-amber-500' : 'text-gray-400'} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <div>
            <label htmlFor="boxName" className="block text-sm font-medium text-gray-700 mb-1">
              Box Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              id="boxName"
              data-tutorial-id="create-box-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              required
            />
          </div>

          <div>
            <label htmlFor="boxDescription" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              id="boxDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-shadow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grid Dimensions
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label htmlFor="boxRows" className="block text-xs text-gray-500 mb-1">
                  Rows
                </label>
                <input
                  type="number"
                  id="boxRows"
                  data-tutorial-id="create-box-rows-input"
                  value={rows}
                  onChange={(e) => setRows(e.target.value)}
                  min={1}
                  max={20}
                  placeholder="1-20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-center"
                />
              </div>
              <span className="text-gray-400 mt-5">x</span>
              <div className="flex-1">
                <label htmlFor="boxColumns" className="block text-xs text-gray-500 mb-1">
                  Columns
                </label>
                <input
                  type="number"
                  id="boxColumns"
                  data-tutorial-id="create-box-columns-input"
                  value={columns}
                  onChange={(e) => setColumns(e.target.value)}
                  min={1}
                  max={20}
                  placeholder="1-20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-center"
                />
              </div>
            </div>
          </div>

          <IconPresetRow
            label="Box Type"
            presetIcons={boxPresets}
            selectedIconId={iconId}
            onSelect={setIconId}
            gridLayout="1x5"
            seeAllCategory={hubConfig.category}
            seeAllSubcategory={hubConfig.subcategory}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Accent Color
            </label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setAccentColor(color.value)}
                  className={`w-8 h-8 rounded-full transition-all duration-200 ${
                    accentColor === color.value
                      ? 'ring-2 ring-offset-2 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: color.value,
                    ringColor: color.value,
                  }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-tutorial-id="create-box-save-btn"
              disabled={!isFormValid || isSubmitting}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${
                !isFormValid || isSubmitting
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md shadow-blue-500/20'
              }`}
            >
              {isSubmitting ? 'Creating...' : 'Create Box'}
            </button>
          </div>
        </form>

        {showPrivacy && teamMembers && currentTeamMemberId && (
          <BoxPrivacySettingsModal
            onClose={() => setShowPrivacy(false)}
            onSave={setPrivacySettings}
            teamMembers={teamMembers}
            currentTeamMemberId={currentTeamMemberId}
            workspaceOwnerId={workspaceOwnerId}
            initialSettings={privacySettings}
          />
        )}
    </ModalFrame>
  );
};

export default CreateBoxModal;
