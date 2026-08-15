import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { CreatePositionData } from '../services/positionService';
import { getGridPresetIcons, getDefaultHubConfig, getDefaultIconForContext } from '../config/iconRegistry';
import SvgIcon from './SvgIcon';
import IconPresetRow from './IconPresetRow';
import ModalFrame from './ModalFrame';
import { ACCENT_COLORS } from '../constants/accentColors';

interface CreatePositionModalProps {
  sublocationId: string;
  onClose: () => void;
  onCreate: (data: CreatePositionData) => void;
}

const CreatePositionModal: React.FC<CreatePositionModalProps> = ({
  sublocationId,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [accentColor, setAccentColor] = useState<string | null>('#6b7280');
  const [iconId, setIconId] = useState<string | null>(getDefaultIconForContext('location'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const locationPresets = getGridPresetIcons('location', 7);
  const hubConfig = getDefaultHubConfig('location');

  React.useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const isFormValid = name.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onCreate({
        sublocation_id: sublocationId,
        name: name.trim(),
        accent_color: accentColor,
        location_type: 'general', icon_id: iconId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalFrame onClose={onClose}>
      <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <SvgIcon iconId={iconId} size={20} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Add Position</h2>
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
              <label htmlFor="positionName" className="block text-sm font-medium text-gray-700 mb-1">
                Position Name
              </label>
              <input
                ref={nameInputRef}
                type="text"
                id="positionName"
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
                disabled={!isFormValid || isSubmitting}
                className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${
                  !isFormValid || isSubmitting
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md shadow-blue-500/20'
                }`}
              >
                {isSubmitting ? 'Adding...' : 'Add Position'}
              </button>
            </div>
          </form>
    </ModalFrame>
  );
};

export default CreatePositionModal;
