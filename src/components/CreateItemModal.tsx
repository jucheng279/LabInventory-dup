import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Calendar, CalendarClock, Ban, CircleAlert as AlertCircle } from 'lucide-react';
import { ItemType, ITEM_TYPES } from '../services/itemService';
import type { ItemSheetHeader, CreateItemData, DisplayMode } from '../types/database';
import { getGridPresetIcons, getDefaultHubConfig } from '../config/iconRegistry';
import SvgIcon from './SvgIcon';
import IconPresetRow from './IconPresetRow';
import UnitSelector from './UnitSelector';
import ModalFrame from './ModalFrame';
import { ACCENT_COLORS } from '../constants/accentColors';

interface ExistingSiblingItem {
  id: string;
  name: string;
  customValues?: Record<string, string>;
}

interface CreateItemModalProps {
  folderHeaders?: ItemSheetHeader[];
  existingSiblings?: ExistingSiblingItem[];
  onClose: () => void;
  onCreate: (
    data: Omit<CreateItemData, 'location_id' | 'sublocation_id' | 'position_id' | 'folder_id'>,
    customValues?: { header_id: string; value: string }[],
  ) => void;
  prefillName?: string;
  prefillNote?: string;
  prefillStockNumber?: number;
  prefillCustomValues?: Record<string, string>;
  placeholderName?: string;
  lockStock?: boolean;
  prefillDisplayMode?: DisplayMode;
  prefillDate?: string | null;
  prefillDateType?: string;
}

const CreateItemModal: React.FC<CreateItemModalProps> = ({
  folderHeaders = [],
  existingSiblings = [],
  onClose,
  onCreate,
  prefillName,
  prefillNote,
  prefillStockNumber,
  prefillCustomValues,
  placeholderName,
  lockStock,
  prefillDisplayMode,
  prefillDate,
  prefillDateType,
}) => {
  const [name, setName] = useState(prefillName || '');
  const [note, setNote] = useState(prefillNote || '');
  const [displayMode, setDisplayMode] = useState<DisplayMode>(prefillDisplayMode || 'stock');
  const [dateType, setDateType] = useState<'date' | 'expiration' | 'none'>((prefillDateType as 'date' | 'expiration' | 'none') || 'none');
  const [date, setDate] = useState(prefillDate || '');
  const [stockNumber, setStockNumber] = useState(
    prefillStockNumber !== undefined ? String(prefillStockNumber) : '',
  );
  const [freezeThawCycles, setFreezeThawCycles] = useState('');
  const [stockThreshold, setStockThreshold] = useState('');
  const [unit, setUnit] = useState('');
  const [nonCounted, setNonCounted] = useState(false);
  const [itemType, setItemType] = useState<ItemType>('Antibody');
  const [iconId, setIconId] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>('#3b82f6');
  const [headerValues, setHeaderValues] = useState<Record<string, string>>(prefillCustomValues || {});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const notePlaceholder = useMemo(() => {
    const parts = folderHeaders
      .map((h) => headerValues[h.id]?.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : '';
  }, [folderHeaders, headerValues]);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const itemPresets = getGridPresetIcons('item', 7);
  const hubConfig = getDefaultHubConfig('item');

  const isStockMode = displayMode === 'stock';
  const activeValue = isStockMode ? stockNumber : freezeThawCycles;

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const isDuplicate = useMemo(() => {
    if (existingSiblings.length === 0 || folderHeaders.length === 0) return false;
    const trimmedName = (name.trim() || placeholderName || '').toLowerCase();
    if (!trimmedName) return false;
    return existingSiblings.some(s => {
      if (s.name.trim().toLowerCase() !== trimmedName) return false;
      const sVals = s.customValues || {};
      for (const h of folderHeaders) {
        if ((sVals[h.id] || '').trim().toLowerCase() !== (headerValues[h.id] || '').trim().toLowerCase()) return false;
      }
      return true;
    });
  }, [name, placeholderName, headerValues, existingSiblings, folderHeaders]);

  const isFormValid = (name.trim() || placeholderName) && !isDuplicate && (nonCounted || (activeValue === '' || parseInt(activeValue) >= 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const effectiveNote = note.trim() || notePlaceholder;

      const customValues = folderHeaders
        .filter((h) => headerValues[h.id]?.trim())
        .map((h) => ({ header_id: h.id, value: headerValues[h.id].trim() }));

      await onCreate(
        {
          name: name.trim() || placeholderName || '',
          note: effectiveNote,
          stock_number: nonCounted ? 0 : (parseInt(stockNumber) || 0),
          stock_threshold: nonCounted || stockThreshold === '' ? null : Math.max(0, parseInt(stockThreshold) || 0),
          unit: isStockMode ? unit : '',
          non_counted: nonCounted,
          item_type: itemType,
          icon_id: iconId,
          accent_color: accentColor,
          freeze_thaw_cycles: parseInt(freezeThawCycles) || 0,
          display_mode: displayMode,
          date: dateType === 'none' ? null : (date || null),
          date_type: dateType,
        },
        customValues,
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
          <h2 className="text-lg font-semibold text-gray-900">Add New Item</h2>
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
          <label htmlFor="itemName" className="block text-sm font-medium text-gray-700 mb-1">
            Item Name
          </label>
          <input
            ref={nameInputRef}
            type="text"
            id="itemName"
            data-tutorial-id="create-item-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholderName || undefined}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            required={!placeholderName}
          />
        </div>

        {folderHeaders.length === 0 && (
          <>
            <div>
              <label htmlFor="itemNote" className="block text-sm font-medium text-gray-700 mb-1">
                Item Information
              </label>
              <textarea
                id="itemNote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={notePlaceholder || undefined}
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-shadow"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">Date</label>
                <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setDateType('date');
                      if (!date) setDate(new Date().toISOString().split('T')[0]);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                      dateType === 'date'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Calendar className="h-3 w-3" />
                    Date
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDateType('expiration');
                      if (!date) setDate(new Date().toISOString().split('T')[0]);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                      dateType === 'expiration'
                        ? 'bg-white text-amber-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <CalendarClock className="h-3 w-3" />
                    Expiration
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDateType('none');
                      setDate('');
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                      dateType === 'none'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Ban className="h-3 w-3" />
                    None
                  </button>
                </div>
              </div>
              {dateType !== 'none' && (
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow ${
                    dateType === 'expiration'
                      ? 'border-amber-300 focus:ring-amber-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
              )}
            </div>

            <div className="border-t border-gray-200" />
          </>
        )}

        <div className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setDisplayMode('stock')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                    isStockMode
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Stock
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('freeze_thaw')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                    !isStockMode
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Freeze-Thaw
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  id="trackingValue"
                  data-tutorial-id="create-item-stock-input"
                  value={isStockMode ? stockNumber : freezeThawCycles}
                  onChange={(e) => isStockMode ? setStockNumber(e.target.value) : setFreezeThawCycles(e.target.value)}
                  placeholder="0"
                  min={0}
                  disabled={nonCounted || (isStockMode && lockStock)}
                  title={isStockMode && lockStock ? 'Stock is tracked from freezer box grid' : undefined}
                  className={`w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${
                    nonCounted || (isStockMode && lockStock) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setNonCounted(!nonCounted)}
                  title={nonCounted ? 'Non-counted (click to count)' : 'Counted (click to mark non-counted)'}
                  className={`absolute inset-y-0 right-0 flex items-center justify-center w-9 text-sm font-bold transition-colors duration-200 rounded-r-xl ${
                    nonCounted
                      ? 'text-blue-600 hover:text-blue-700'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  n
                </button>
              </div>
              {isStockMode && (
                <UnitSelector value={unit} onChange={setUnit} disabled={nonCounted} />
              )}
            </div>
          </div>
          {isStockMode && (
            <div className="w-24 flex-shrink-0">
              <label htmlFor="stockThreshold" className="block text-sm font-medium text-gray-700 mb-1">
                Threshold
              </label>
              <input
                type="number"
                id="stockThreshold"
                value={stockThreshold}
                onChange={(e) => setStockThreshold(e.target.value)}
                min={0}
                disabled={nonCounted}
                placeholder="-"
                title="Warn when stock is at or below this value. Leave empty for no warning."
                className={`w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-shadow text-center ${
                  nonCounted ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                }`}
              />
            </div>
          )}
        </div>

        <IconPresetRow
          label="Item Type"
          presetIcons={itemPresets}
          selectedIconId={iconId}
          onSelect={setIconId}
          onDeselect={() => setIconId(null)}
          showFallback
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

        {folderHeaders.length > 0 && (
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-medium text-gray-600">Column Values</h3>
            {folderHeaders.map((header) => (
              <div key={header.id}>
                <label htmlFor={`header-${header.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                  {header.header_text}
                </label>
                {header.header_type === 'preset' ? (
                  <select
                    id={`header-${header.id}`}
                    value={headerValues[header.id] || ''}
                    onChange={(e) => setHeaderValues((prev) => ({ ...prev, [header.id]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white transition-shadow text-sm"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
                  >
                    <option value="">—</option>
                    {(header.preset_options || []).map((opt) => (
                      <option key={opt.id} value={opt.option_label}>{opt.option_label}</option>
                    ))}
                  </select>
                ) : (
                <input
                  type={header.header_type === 'date' || header.header_type === 'expiration' ? 'date' : 'text'}
                  id={`header-${header.id}`}
                  value={headerValues[header.id] || ''}
                  onChange={(e) => setHeaderValues((prev) => ({ ...prev, [header.id]: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
                )}
              </div>
            ))}
          </div>
        )}

        {isDuplicate && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-amber-700">
              An item with identical column values already exists in this sheet.
            </span>
          </div>
        )}

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
            data-tutorial-id="create-item-save-btn"
            disabled={!isFormValid || isSubmitting}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${
              !isFormValid || isSubmitting
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md shadow-blue-500/20'
            }`}
          >
            {isSubmitting ? 'Adding...' : 'Add Item'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
};

export default CreateItemModal;
