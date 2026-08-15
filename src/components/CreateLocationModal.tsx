import React, { useState, useRef } from 'react';
import { X, Grid3x3 as Grid3X3, Package } from 'lucide-react';
import { CreateLocationData } from '../services/locationManagerService';
import { getGridPresetIcons, getDefaultHubConfig, getDefaultIconForContext } from '../config/iconRegistry';
import SvgIcon from './SvgIcon';
import IconPresetRow from './IconPresetRow';
import ModalFrame from './ModalFrame';
import { ACCENT_COLORS } from '../constants/accentColors';

interface CreateLocationModalProps {
  onClose: () => void;
  onCreate: (data: CreateLocationData) => void;
}

const CreateLocationModal: React.FC<CreateLocationModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [accentColor, setAccentColor] = useState<string | null>('#3b82f6');
  const [iconId, setIconId] = useState<string | null>(getDefaultIconForContext('location'));
  const [showStorageBoxes, setShowStorageBoxes] = useState(true);
  const [showInventoryItems, setShowInventoryItems] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const locationPresets = getGridPresetIcons('location', 7);
  const hubConfig = getDefaultHubConfig('location');

  const handleToggleSection = (section: 'boxes' | 'items') => {
    if (section === 'boxes') {
      if (showStorageBoxes && !showInventoryItems) return;
      setShowStorageBoxes(!showStorageBoxes);
    } else {
      if (showInventoryItems && !showStorageBoxes) return;
      setShowInventoryItems(!showInventoryItems);
    }
  };

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
        name: name.trim(),
        accent_color: accentColor,
        show_storage_boxes: showStorageBoxes,
        show_inventory_items: showInventoryItems,
        location_type: 'fridge',
        icon_id: iconId,
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
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <SvgIcon iconId={iconId} size={20} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Add Location</h2>
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
            <label htmlFor="locationName" className="block text-sm font-medium text-gray-700 mb-1">
              Location Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              id="locationName"
              data-tutorial-id="create-location-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Fridge, Storage Room B, Freezer A"
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
                  data-tutorial-id={color.name === 'Blue' ? 'create-location-color-blue' : undefined}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content Sections
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleToggleSection('boxes')}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                  showStorageBoxes
                    ? 'border-blue-300 bg-blue-50/80 shadow-sm'
                    : 'border-gray-200 bg-gray-50 opacity-50 hover:opacity-70'
                } ${showStorageBoxes && !showInventoryItems ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className={`p-2 rounded-lg transition-colors ${
                  showStorageBoxes ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <Grid3X3 size={20} className={showStorageBoxes ? 'text-blue-600' : 'text-gray-400'} />
                </div>
                <span className={`text-sm font-medium ${
                  showStorageBoxes ? 'text-blue-900' : 'text-gray-500'
                }`}>
                  Storage Boxes
                </span>
                <div className={`absolute top-2 right-2 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                  showStorageBoxes
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300 bg-white'
                }`}>
                  {showStorageBoxes && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleToggleSection('items')}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                  showInventoryItems
                    ? 'border-emerald-300 bg-emerald-50/80 shadow-sm'
                    : 'border-gray-200 bg-gray-50 opacity-50 hover:opacity-70'
                } ${showInventoryItems && !showStorageBoxes ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className={`p-2 rounded-lg transition-colors ${
                  showInventoryItems ? 'bg-emerald-100' : 'bg-gray-100'
                }`}>
                  <Package size={20} className={showInventoryItems ? 'text-emerald-600' : 'text-gray-400'} />
                </div>
                <span className={`text-sm font-medium ${
                  showInventoryItems ? 'text-emerald-900' : 'text-gray-500'
                }`}>
                  Inventory Items
                </span>
                <div className={`absolute top-2 right-2 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                  showInventoryItems
                    ? 'border-emerald-500 bg-emerald-500'
                    : 'border-gray-300 bg-white'
                }`}>
                  {showInventoryItems && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
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
              data-tutorial-id="create-location-save-btn"
              disabled={!isFormValid || isSubmitting}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${
                !isFormValid || isSubmitting
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md shadow-blue-500/20'
              }`}
            >
              {isSubmitting ? 'Adding...' : 'Add Location'}
            </button>
            </div>
          </form>
    </ModalFrame>
  );
};

export default CreateLocationModal;
