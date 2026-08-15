import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
import { SublocationWithStats, UpdateSublocationData } from '../services/sublocationService';
import { getGridPresetIcons, getDefaultHubConfig } from '../config/iconRegistry';
import SvgIcon from './SvgIcon';
import IconPresetRow from './IconPresetRow';
import ModalFrame from './ModalFrame';
import { ACCENT_COLORS } from '../constants/accentColors';

interface EditSublocationModalProps {
  sublocation: SublocationWithStats;
  onClose: () => void;
  onUpdate: (sublocationId: string, data: UpdateSublocationData) => void;
  onDelete: () => void;
}

const EditSublocationModal: React.FC<EditSublocationModalProps> = ({
  sublocation,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [name, setName] = useState(sublocation.name);
  const [accentColor, setAccentColor] = useState<string | null>(sublocation.accent_color || '#6b7280');
  const [iconId, setIconId] = useState<string | null>(sublocation.icon_id || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const locationPresets = getGridPresetIcons('location', 7);
  const hubConfig = getDefaultHubConfig('location');

  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  const isFormValid = name.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onUpdate(sublocation.id, {
        name: name.trim(),
        accent_color: accentColor,
        location_type: sublocation.location_type, icon_id: iconId,
      });
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
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <SvgIcon iconId={iconId} size={20} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Edit Sub-Location</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            <div>
              <label htmlFor="sublocationName" className="block text-sm font-medium text-gray-700 mb-1">
                Sub-Location Name
              </label>
              <input
                ref={nameInputRef}
                type="text"
                id="sublocationName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                required
              />
            </div>

          <IconPresetRow
            label="Location Type"
            presetIcons={locationPresets}
            selectedIconId={iconId}
            onSelect={setIconId}
            gridLayout="2x4"
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

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onDelete}
                className="flex-shrink-0 p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Delete sub-location"
              >
                <Trash2 size={18} />
              </button>
              <div className="flex flex-1 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-medium text-white transition-all ${
                    !isFormValid || isSubmitting
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md shadow-blue-500/20'
                  }`}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
    </ModalFrame>
  );
};

export default EditSublocationModal;
