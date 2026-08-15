import React, { useState } from 'react';
import { ChevronRight, Grid2x2 as Grid2X2 } from 'lucide-react';
import SvgIcon from './SvgIcon';
import IconHubModal from './IconHubModal';
import type { IconCategory, IconSubcategory, PresetIcon } from '../config/iconRegistry';
import { getIconById, getSubcategoryLabel, ITEM_FALLBACK_ICON_ID } from '../config/iconRegistry';

interface HubTarget {
  category: IconCategory;
  subcategory: IconSubcategory;
}

interface IconPresetRowProps {
  presetIcons: PresetIcon[];
  selectedIconId: string | null;
  onSelect: (iconId: string) => void;
  onDeselect?: () => void;
  label?: string;
  gridLayout: '2x4' | '1x5';
  seeAllCategory?: IconCategory;
  seeAllSubcategory?: IconSubcategory;
  showFallback?: boolean;
}

const IconPresetRow: React.FC<IconPresetRowProps> = ({
  presetIcons,
  selectedIconId,
  onSelect,
  onDeselect,
  label,
  gridLayout,
  seeAllCategory,
  seeAllSubcategory,
  showFallback = false,
}) => {
  const [showHub, setShowHub] = useState(false);
  const [hubTarget, setHubTarget] = useState<HubTarget | null>(null);

  const cols = gridLayout === '2x4' ? 4 : 5;
  const totalSlots = gridLayout === '2x4' ? 8 : 5;

  const presetSlots = totalSlots - 1;
  const displayPresets = presetIcons.slice(0, presetSlots);

  const isFallbackActive = showFallback && !selectedIconId;
  const selectedEntry = selectedIconId ? getIconById(selectedIconId) : null;
  const selectedLabel = selectedEntry
    ? getSubcategoryLabel(selectedEntry.subcategory)
    : '';

  const emptyCount = presetSlots - displayPresets.length;
  const emptySlots = emptyCount > 0 ? Array.from({ length: emptyCount }) : [];

  const isSingleSubcategory = displayPresets.length > 0 &&
    displayPresets.every((p) => p.category === displayPresets[0].category && p.subcategory === displayPresets[0].subcategory);

  const openHub = (target?: HubTarget) => {
    setHubTarget(target || null);
    setShowHub(true);
  };

  const closeHub = () => {
    setShowHub(false);
    setHubTarget(null);
  };

  const hubCategory = hubTarget?.category ?? seeAllCategory;
  const hubSubcategory = hubTarget?.subcategory ?? seeAllSubcategory;

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <button
            type="button"
            onClick={() => openHub()}
            className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-blue-500 transition-colors"
          >
            See all
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        <button
          type="button"
          onClick={() => {
            if (selectedIconId && onDeselect) {
              onDeselect();
            }
          }}
          className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200 h-20 justify-center ${
            selectedIconId
              ? 'border-2 border-blue-300 bg-blue-50/70 shadow-sm'
              : isFallbackActive
                ? 'border-2 border-blue-300 bg-blue-50/70 shadow-sm'
                : 'border-2 border-dashed border-gray-300 bg-gray-50/50'
          }`}
        >
          {selectedIconId ? (
            <>
              <SvgIcon iconId={selectedIconId} size={28} color="#3b82f6" forceColorful />
              <span className="text-xs font-semibold leading-tight text-center truncate w-full text-blue-600">
                {selectedLabel}
              </span>
            </>
          ) : isFallbackActive ? (
            <>
              <SvgIcon iconId={ITEM_FALLBACK_ICON_ID} size={28} color="#3b82f6" forceColorful />
              <span className="text-xs font-semibold leading-tight text-center truncate w-full text-blue-600">
                Default
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-400">None</span>
          )}
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-medium text-gray-400 bg-white px-1.5 rounded">
            Selected
          </span>
        </button>

        {displayPresets.map((preset) => {
          const isSelected = selectedIconId === preset.id;
          return (
            <div key={preset.id} className="relative group">
              <button
                type="button"
                onClick={() => {
                  if (isSelected && onDeselect) {
                    onDeselect();
                  } else {
                    onSelect(preset.id);
                  }
                }}
                className={`w-full flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 h-20 justify-center ${
                  isSelected
                    ? 'border-blue-300 bg-blue-50/70 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <SvgIcon
                  iconId={preset.id}
                  size={28}
                  color={isSelected ? '#3b82f6' : '#9ca3af'}
                  forceColorful
                />
                <span className={`text-xs font-semibold leading-tight text-center truncate w-full ${
                  isSelected ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {preset.subcategoryLabel}
                </span>
              </button>
              {!isSingleSubcategory && (
                <button
                  type="button"
                  title={`Browse ${preset.subcategoryLabel}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openHub({ category: preset.category, subcategory: preset.subcategory });
                  }}
                  className="absolute top-1 right-1 p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-white/80 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                >
                  <Grid2X2 size={11} className="text-gray-400 hover:text-blue-500 transition-colors" />
                </button>
              )}
            </div>
          );
        })}

        {emptySlots.map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-transparent h-20 justify-center"
          />
        ))}
      </div>
      <IconHubModal
        isOpen={showHub}
        onClose={closeHub}
        onSelect={onSelect}
        defaultCategory={hubCategory}
        defaultSubcategory={hubSubcategory}
        selectedIconId={selectedIconId}
      />
    </div>
  );
};

export default IconPresetRow;
