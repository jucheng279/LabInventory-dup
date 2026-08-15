import { useState, useEffect, useRef } from 'react';
import { RotateCcw, Tag, FileText, Calendar, X, Paintbrush, Loader as Loader2, LayoutGrid, ChevronDown } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import Portal from './Portal';
import { ColorByField, GroupingMethod } from '../utils/cellDataUtils';

interface GridSettingsProps {
  nameFontDivisor: number;
  infoFontDivisor: number;
  onChange: (name: number, info: number) => void;
  onSave: (name: number, info: number) => void;
  isSaving?: boolean;
  onApplyColorBy: (filters: ColorByField[]) => Promise<void>;
  isApplyingColors?: boolean;
  onApplyGroups: (filters: ColorByField[], method: GroupingMethod) => Promise<void>;
  isApplyingGroups?: boolean;
  constrainGridHeight: boolean;
  onConstrainGridHeightChange: (value: boolean) => void;
  rotateGrid: boolean;
  onRotateGridChange: (value: boolean) => void;
  readOnly?: boolean;
}

const DEFAULT_NAME_DIVISOR = 8;
const DEFAULT_INFO_DIVISOR = 10;
const MIN_DIVISOR = 3;
const MAX_DIVISOR = 20;

const divisorToSlider = (divisor: number) => MAX_DIVISOR + MIN_DIVISOR - divisor;
const sliderToDivisor = (slider: number) => MAX_DIVISOR + MIN_DIVISOR - slider;

const COLOR_BY_OPTIONS: { field: ColorByField; label: string; icon: typeof Tag }[] = [
  { field: 'name', label: 'Name', icon: Tag },
  { field: 'information', label: 'Info', icon: FileText },
  { field: 'date', label: 'Date', icon: Calendar },
];

const GROUPING_METHODS: { value: GroupingMethod; label: string }[] = [
  { value: 1, label: 'Fill Grid (Snake)' },
  { value: 3, label: 'Fill Grid (Linear)' },
  { value: 2, label: 'Row per Group' },
];

const GridSettings: React.FC<GridSettingsProps> = ({
  nameFontDivisor,
  infoFontDivisor,
  onChange,
  onSave,
  isSaving = false,
  onApplyColorBy,
  isApplyingColors = false,
  onApplyGroups,
  isApplyingGroups = false,
  constrainGridHeight,
  onConstrainGridHeightChange,
  rotateGrid,
  onRotateGridChange,
  readOnly = false,
}) => {
  const [localNameDivisor, setLocalNameDivisor] = useState(nameFontDivisor);
  const [localInfoDivisor, setLocalInfoDivisor] = useState(infoFontDivisor);
  const [colorByFilters, setColorByFilters] = useState<ColorByField[]>([]);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isBusy = isApplyingColors || isApplyingGroups;

  useEffect(() => {
    if (!showGroupDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setShowGroupDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGroupDropdown]);

  useEffect(() => {
    setLocalNameDivisor(nameFontDivisor);
    setLocalInfoDivisor(infoFontDivisor);
  }, [nameFontDivisor, infoFontDivisor]);

  const handleNameChange = (value: number) => {
    setLocalNameDivisor(value);
    onChange(value, localInfoDivisor);
  };

  const handleInfoChange = (value: number) => {
    setLocalInfoDivisor(value);
    onChange(localNameDivisor, value);
  };

  const handleNameRelease = () => {
    if (!readOnly) onSave(localNameDivisor, localInfoDivisor);
  };

  const handleInfoRelease = () => {
    if (!readOnly) onSave(localNameDivisor, localInfoDivisor);
  };

  const handleReset = () => {
    setLocalNameDivisor(DEFAULT_NAME_DIVISOR);
    setLocalInfoDivisor(DEFAULT_INFO_DIVISOR);
    onChange(DEFAULT_NAME_DIVISOR, DEFAULT_INFO_DIVISOR);
    if (!readOnly) onSave(DEFAULT_NAME_DIVISOR, DEFAULT_INFO_DIVISOR);
  };

  const isDefault = localNameDivisor === DEFAULT_NAME_DIVISOR && localInfoDivisor === DEFAULT_INFO_DIVISOR;

  const toggleColorByField = (field: ColorByField) => {
    if (isBusy) return;
    setColorByFilters(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const handleApplyColors = async () => {
    if (colorByFilters.length === 0 || isBusy) return;
    setShowGroupDropdown(false);
    await onApplyColorBy(colorByFilters);
    setColorByFilters([]);
  };

  const handleApplyGroupMethod = async (method: GroupingMethod) => {
    if (colorByFilters.length === 0 || isBusy) return;
    setShowGroupDropdown(false);
    await onApplyGroups(colorByFilters, method);
    setColorByFilters([]);
  };

  const headerRight = !readOnly ? (
    <button
      onClick={handleReset}
      disabled={isDefault || isSaving}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
        isDefault || isSaving
          ? 'text-gray-400 cursor-not-allowed'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      <RotateCcw className="h-4 w-4" />
      Reset
    </button>
  ) : undefined;

  return (
    <CollapsibleSection title="Grid Settings" defaultOpen={true} headerRight={headerRight}>
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="space-y-5 flex-shrink-0">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Name Font Size</label>
            <div className="max-w-[14rem]">
              <input
                type="range"
                min={MIN_DIVISOR}
                max={MAX_DIVISOR}
                value={divisorToSlider(localNameDivisor)}
                onChange={(e) => handleNameChange(sliderToDivisor(Number(e.target.value)))}
                onMouseUp={handleNameRelease}
                onTouchEnd={handleNameRelease}
                disabled={isSaving}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Small</span>
                <span>Large</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Info Font Size</label>
            <div className="max-w-[14rem]">
              <input
                type="range"
                min={MIN_DIVISOR}
                max={MAX_DIVISOR}
                value={divisorToSlider(localInfoDivisor)}
                onChange={(e) => handleInfoChange(sliderToDivisor(Number(e.target.value)))}
                onMouseUp={handleInfoRelease}
                onTouchEnd={handleInfoRelease}
                disabled={isSaving}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Small</span>
                <span>Large</span>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden sm:block w-px bg-gray-200 self-stretch" />
        <div className="block sm:hidden h-px bg-gray-200" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">Organize by</label>
            {colorByFilters.length > 0 && (
              <button
                onClick={() => { setColorByFilters([]); setShowGroupDropdown(false); }}
                disabled={isBusy}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_BY_OPTIONS.map(({ field, label, icon: Icon }) => {
              const isActive = colorByFilters.includes(field);
              return (
                <button
                  key={field}
                  onClick={() => toggleColorByField(field)}
                  disabled={isBusy}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>

          {!readOnly && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleApplyColors}
              disabled={colorByFilters.length === 0 || isBusy}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                colorByFilters.length === 0 || isBusy
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
              }`}
            >
              {isApplyingColors ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paintbrush className="h-4 w-4" />
              )}
              {isApplyingColors ? 'Applying...' : 'Apply Colors'}
            </button>
            <div className="relative">
              <button
                ref={triggerRef}
                onClick={() => {
                  if (!showGroupDropdown && triggerRef.current) {
                    const rect = triggerRef.current.getBoundingClientRect();
                    setDropdownPos({ top: rect.bottom + 4, left: rect.left });
                  }
                  setShowGroupDropdown(!showGroupDropdown);
                }}
                disabled={colorByFilters.length === 0 || isBusy}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                  colorByFilters.length === 0 || isBusy
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm hover:shadow-md'
                }`}
              >
                {isApplyingGroups ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LayoutGrid className="h-4 w-4" />
                )}
                {isApplyingGroups ? 'Grouping...' : 'Apply Groups'}
                {!isApplyingGroups && <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${showGroupDropdown ? 'rotate-180' : ''}`} />}
              </button>
              {showGroupDropdown && !isBusy && (
                <Portal>
                  <div
                    ref={dropdownRef}
                    className="fixed z-[9999] w-48 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden"
                    style={{ top: dropdownPos.top, left: dropdownPos.left }}
                  >
                    {GROUPING_METHODS.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => handleApplyGroupMethod(value)}
                        className="w-full px-4 py-2 text-sm font-medium text-gray-900 text-left hover:bg-teal-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Portal>
              )}
            </div>
          </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 divide-x divide-gray-200">
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                Constrain to screen height
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={constrainGridHeight}
                onClick={() => onConstrainGridHeightChange(!constrainGridHeight)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  constrainGridHeight ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    constrainGridHeight ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer group pl-4">
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                Rotate grid
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={rotateGrid}
                onClick={() => onRotateGridChange(!rotateGrid)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  rotateGrid ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    rotateGrid ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};

export default GridSettings;
