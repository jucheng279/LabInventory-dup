import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Package, AlertTriangle, Shield, QrCode } from 'lucide-react';
import { LocationBoxWithStats, UpdateBoxData } from '../services/boxService';
import { getGridPresetIcons, getDefaultHubConfig } from '../config/iconRegistry';
import SvgIcon from './SvgIcon';
import IconPresetRow from './IconPresetRow';
import ModalFrame from './ModalFrame';
import BoxPrivacySettingsModal, { PrivacyFormState, boxPrivacyDataToFormState } from './BoxPrivacySettingsModal';
import BoxQRCodeModal from './BoxQRCodeModal';
import { useBoxPrivacy } from '../hooks/useBoxPrivacy';
import { ACCENT_COLORS } from '../constants/accentColors';
import type { TeamMember } from '../types/database';

interface EditBoxModalProps {
  box: LocationBoxWithStats;
  onClose: () => void;
  onUpdate: (boxId: string, data: UpdateBoxData, privacySettings?: PrivacyFormState) => void | Promise<void>;
  teamMembers?: TeamMember[];
  currentTeamMemberId?: string;
  workspaceOwnerId?: string;
  workspaceId?: string;
}

const EditBoxModal: React.FC<EditBoxModalProps> = ({ box, onClose, onUpdate, teamMembers, currentTeamMemberId, workspaceOwnerId, workspaceId }) => {
  const [name, setName] = useState(box.name);
  const [description, setDescription] = useState(box.description || '');
  const [accentColor, setAccentColor] = useState<string | null>(box.accent_color || '#3b82f6');
  const [rows, setRows] = useState(String(box.rows));
  const [columns, setColumns] = useState(String(box.columns));
  const [iconId, setIconId] = useState<string | null>(box.icon_id || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<PrivacyFormState | null>(null);
  const [privacyChanged, setPrivacyChanged] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { data: existingPrivacy, isFetched: privacyFetched } = useBoxPrivacy(box.id);

  useEffect(() => {
    if (existingPrivacy && !privacySettings) {
      setPrivacySettings(boxPrivacyDataToFormState(existingPrivacy.settings, existingPrivacy.accessList));
    }
  }, [existingPrivacy, privacySettings]);

  const boxPresets = getGridPresetIcons('box', 4);
  const hubConfig = getDefaultHubConfig('box');

  const isValidDimension = (value: string) => {
    const num = parseInt(value);
    return !isNaN(num) && num >= 1 && num <= 20;
  };

  const rowsNum = parseInt(rows) || 0;
  const columnsNum = parseInt(columns) || 0;

  const isShrinking = useMemo(() => {
    return rowsNum < box.rows || columnsNum < box.columns;
  }, [rowsNum, columnsNum, box.rows, box.columns]);

  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  const isFormValid = name.trim() && isValidDimension(rows) && isValidDimension(columns);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onUpdate(
        box.id,
        {
          name: name.trim(),
          description: description.trim(),
          accent_color: accentColor,
          icon_id: iconId,
          rows: parseInt(rows),
          columns: parseInt(columns),
        },
        privacyChanged ? (privacySettings || undefined) : undefined,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges =
    name.trim() !== box.name ||
    description.trim() !== (box.description || '') ||
    accentColor !== (box.accent_color || '#3b82f6') ||
    iconId !== (box.icon_id || null) ||
    rowsNum !== box.rows ||
    columnsNum !== box.columns ||
    privacyChanged;

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
        <h2 className="text-lg font-semibold text-gray-900">Edit Box</h2>
      </div>
      <div className="flex items-center gap-1">
        {teamMembers && currentTeamMemberId && (
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            disabled={!privacyFetched}
            className={`p-2 rounded-lg transition-colors ${
              !privacyFetched
                ? 'opacity-40 cursor-not-allowed'
                : privacySettings?.privacyMode === 'restricted'
                  ? 'bg-amber-50 hover:bg-amber-100'
                  : 'hover:bg-gray-100'
            }`}
            title={!privacyFetched ? 'Loading...' : privacySettings?.privacyMode === 'restricted' ? 'Restricted Access' : 'Open Access'}
          >
            <Shield size={18} className={privacySettings?.privacyMode === 'restricted' ? 'text-amber-500' : 'text-gray-400'} />
          </button>
        )}
        {workspaceId && currentTeamMemberId && (currentTeamMemberId === workspaceOwnerId || privacySettings?.ownerId === currentTeamMemberId || (privacyFetched && !existingPrivacy)) && (
          <button
            type="button"
            onClick={() => setShowQR(true)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="QR Code"
          >
            <QrCode size={18} className="text-gray-400" />
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Reagents Box A"
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
              placeholder="Brief description of the box contents"
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
                  value={rows}
                  onChange={(e) => setRows(e.target.value)}
                  min={1}
                  max={20}
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
                  value={columns}
                  onChange={(e) => setColumns(e.target.value)}
                  min={1}
                  max={20}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-center"
                />
              </div>
            </div>
            {isShrinking && isValidDimension(rows) && isValidDimension(columns) && (
              <div className="mt-2 flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Reducing grid size will remove data from cells outside the new dimensions.
                </p>
              </div>
            )}
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
              disabled={!isFormValid || !hasChanges || isSubmitting}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${
                !isFormValid || !hasChanges || isSubmitting
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md shadow-blue-500/20'
              }`}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            </div>
          </form>

      {showPrivacy && teamMembers && currentTeamMemberId && (
        <BoxPrivacySettingsModal
          onClose={() => setShowPrivacy(false)}
          onSave={(settings) => {
            setPrivacySettings(settings);
            setPrivacyChanged(true);
          }}
          teamMembers={teamMembers}
          currentTeamMemberId={currentTeamMemberId}
          workspaceOwnerId={workspaceOwnerId}
          readOnly={!!privacySettings?.ownerId && privacySettings.ownerId !== currentTeamMemberId && currentTeamMemberId !== workspaceOwnerId}
          initialSettings={privacySettings}
        />
      )}

      {showQR && workspaceId && currentTeamMemberId && (
        <BoxQRCodeModal
          boxId={box.id}
          boxName={box.name}
          boxDescription={box.description || ''}
          boxRows={box.rows}
          boxColumns={box.columns}
          workspaceId={workspaceId}
          currentTeamMemberId={currentTeamMemberId}
          onClose={() => setShowQR(false)}
        />
      )}
    </ModalFrame>
  );
};

export default EditBoxModal;
