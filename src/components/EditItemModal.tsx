import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, SlidersHorizontal, ArrowLeft, Link2, Calendar, CalendarClock, Ban, CircleAlert as AlertCircle } from 'lucide-react';
import { InventoryItem, UpdateItemData, ItemType, ITEM_TYPES } from '../services/itemService';
import type { ItemFolderHeader, BoxGridItemLink, DisplayMode } from '../types/database';
import { getItemTypeIcon } from '../utils/itemTypeIcons';
import { getGridPresetIcons, getDefaultHubConfig } from '../config/iconRegistry';
import SvgIcon from './SvgIcon';
import IconPresetRow from './IconPresetRow';
import UnitSelector from './UnitSelector';
import ModalFrame from './ModalFrame';
import { ACCENT_COLORS } from '../constants/accentColors';
import { boxItemLinkService } from '../services/boxItemLinkService';

interface DuplicateCheckItem {
  id: string;
  name: string;
  note: string;
  date: string | null;
  customValues?: Record<string, string>;
}

interface EditItemModalProps {
  item: InventoryItem;
  folderHeaders?: ItemFolderHeader[];
  customValues?: Record<string, string>;
  onClose: () => void;
  onUpdate: (
    itemId: string,
    data: UpdateItemData,
    customValues?: { header_id: string; value: string }[],
  ) => void;
  link?: BoxGridItemLink | null;
  placeholderName?: string;
  siblingItems?: DuplicateCheckItem[];
}

const EditItemModal: React.FC<EditItemModalProps> = ({ item, folderHeaders = [], customValues = {}, onClose, onUpdate, link, placeholderName, siblingItems = [] }) => {
  const isLinked = !!link;
  const isPlaceholderMode = !!placeholderName;
  const [name, setName] = useState(isPlaceholderMode ? '' : item.name);
  const [note, setNote] = useState(item.note || '');
  const [displayMode, setDisplayMode] = useState<DisplayMode>(item.display_mode || 'stock');
  const [stockNumber, setStockNumber] = useState(String(item.stock_number));
  const [freezeThawCycles, setFreezeThawCycles] = useState(String(item.freeze_thaw_cycles || 0));
  const [stockThreshold, setStockThreshold] = useState(
    item.stock_threshold != null ? String(item.stock_threshold) : ''
  );
  const [unit, setUnit] = useState(item.unit || '');
  const [nonCounted, setNonCounted] = useState(item.non_counted);
  const [itemType, setItemType] = useState<ItemType>(item.item_type);
  const [iconId, setIconId] = useState<string | null>(item.icon_id || null);
  const [accentColor, setAccentColor] = useState<string | null>(item.accent_color || '#3b82f6');
  const [headerValues, setHeaderValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    folderHeaders.forEach((h) => {
      initial[h.id] = customValues[h.id] || '';
    });
    return initial;
  });
  const [dateType, setDateType] = useState<'date' | 'expiration' | 'none'>((item.date_type as 'date' | 'expiration' | 'none') || 'none');
  const [date, setDate] = useState(item.date || '');
  const [showColumnInfo, setShowColumnInfo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const initialCustomValuesRef = useRef(JSON.stringify(customValues));

  const itemPresets = getGridPresetIcons('item', 7);
  const hubConfig = getDefaultHubConfig('item');

  const isStockMode = displayMode === 'stock';
  const isStockLinked = isLinked && isStockMode && !unit;
  const activeValue = isStockMode ? stockNumber : freezeThawCycles;

  useEffect(() => {
    if (!showColumnInfo) {
      nameInputRef.current?.focus();
      if (!isPlaceholderMode) {
        nameInputRef.current?.select();
      }
    }
  }, [showColumnInfo, isPlaceholderMode]);

  const notePlaceholder = useMemo(() => {
    const parts = folderHeaders
      .map((h) => headerValues[h.id]?.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : '';
  }, [folderHeaders, headerValues]);

  const effectiveNote = note.trim() || notePlaceholder;

  const handleUnitChange = (newUnit: string) => {
    if (isLinked && isStockMode) {
      if (newUnit && !unit) {
        setStockNumber('');
      } else if (!newUnit && unit && link) {
        boxItemLinkService
          .getLinkedCellCount(link.box_id, link.linked_name, link.linked_info, link.link_type)
          .then((count) => setStockNumber(String(count)))
          .catch(() => setStockNumber(String(item.stock_number)));
      }
    }
    setUnit(newUnit);
  };

  const isDuplicate = useMemo(() => {
    if (siblingItems.length === 0) return false;
    const trimmedName = name.trim().toLowerCase();
    if (!trimmedName) return false;
    const isStandalone = !item.folder_id;

    if (isStandalone) {
      const trimmedNote = note.trim().toLowerCase();
      const effectiveDate = dateType === 'none' ? null : (date || null);
      return siblingItems.some(s =>
        s.id !== item.id &&
        s.name.trim().toLowerCase() === trimmedName &&
        (s.note || '').trim().toLowerCase() === trimmedNote &&
        (s.date || null) === effectiveDate
      );
    } else {
      return siblingItems.some(s => {
        if (s.id === item.id) return false;
        if (s.name.trim().toLowerCase() !== trimmedName) return false;
        const sVals = s.customValues || {};
        for (const h of folderHeaders) {
          if ((sVals[h.id] || '').trim().toLowerCase() !== (headerValues[h.id] || '').trim().toLowerCase()) return false;
        }
        return true;
      });
    }
  }, [name, note, dateType, date, headerValues, siblingItems, item.id, item.folder_id, folderHeaders]);

  const isFormValid = (name.trim() || placeholderName) && !isDuplicate && (nonCounted || (activeValue !== '' && parseInt(activeValue) >= 0));

  const currentCustomJson = JSON.stringify(
    folderHeaders.reduce<Record<string, string>>((acc, h) => {
      if (headerValues[h.id]?.trim()) acc[h.id] = headerValues[h.id].trim();
      return acc;
    }, {})
  );
  const initialCustomJson = initialCustomValuesRef.current;

  const parsedThreshold = stockThreshold === '' ? null : Math.max(0, parseInt(stockThreshold) || 0);

  const initialName = isPlaceholderMode ? '' : item.name;
  const hasChanges =
    name.trim() !== initialName ||
    effectiveNote !== (item.note || '') ||
    parseInt(stockNumber) !== item.stock_number ||
    parsedThreshold !== (item.stock_threshold ?? null) ||
    unit !== (item.unit || '') ||
    nonCounted !== item.non_counted ||
    itemType !== item.item_type ||
    accentColor !== (item.accent_color || '#3b82f6') ||
    iconId !== (item.icon_id || null) ||
    displayMode !== (item.display_mode || 'stock') ||
    (parseInt(freezeThawCycles) || 0) !== (item.freeze_thaw_cycles || 0) ||
    dateType !== ((item.date_type as string) || 'none') ||
    (dateType === 'none' ? '' : date) !== (item.date || '') ||
    currentCustomJson !== initialCustomJson;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !hasChanges || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const cv = folderHeaders
        .filter((h) => headerValues[h.id]?.trim())
        .map((h) => ({ header_id: h.id, value: headerValues[h.id].trim() }));

      await onUpdate(
        item.id,
        {
          name: name.trim() || placeholderName || item.name,
          note: effectiveNote,
          stock_number: parseInt(stockNumber) || 0,
          stock_threshold: parsedThreshold,
          unit: isStockMode ? unit : (item.unit || ''),
          non_counted: nonCounted,
          item_type: itemType,
          icon_id: iconId,
          accent_color: accentColor,
          display_mode: displayMode,
          freeze_thaw_cycles: parseInt(freezeThawCycles) || 0,
          date: dateType === 'none' ? null : (date || null),
          date_type: dateType,
        },
        cv,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalFrame onClose={onClose} allowOverflow>
      <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {showColumnInfo ? (
            <button
              type="button"
              onClick={() => setShowColumnInfo(false)}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
          ) : (
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <SvgIcon iconId={iconId} size={20} />
            </div>
          )}
          <h2 className="text-lg font-semibold text-gray-900">
            {showColumnInfo ? 'Column Info and Note' : 'Edit Item'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            {!showColumnInfo ? (
              <>
                <div>
                  <label htmlFor="itemName" className="block text-sm font-medium text-gray-700 mb-1">
                    Item Name
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    id="itemName"
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
                      {isStockMode && isLinked && (
                        <span className="inline-flex items-center gap-0 sm:gap-0.5 text-[10px] text-emerald-700" title="Grid-linked">
                          <Link2 size={9} className="flex-shrink-0" />
                          <span className="hidden sm:inline">{unit ? 'Grid-linked' : 'Grid-linked'}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          id="trackingValue"
                          value={isStockMode ? stockNumber : freezeThawCycles}
                          onChange={(e) => isStockMode ? setStockNumber(e.target.value) : setFreezeThawCycles(e.target.value)}
                          min={0}
                          disabled={nonCounted || isStockLinked}
                          title={isStockLinked ? 'Stock is tracked from freezer box grid' : undefined}
                          placeholder={isStockMode && isLinked && unit ? 'Enter stock' : undefined}
                          className={`w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${
                            nonCounted || isStockLinked ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
                          }`}
                        />
                        {!isStockLinked && (
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
                        )}
                      </div>
                      {isStockMode && (
                        <UnitSelector value={unit} onChange={handleUnitChange} disabled={nonCounted} />
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

                <button
                  type="button"
                  onClick={() => setShowColumnInfo(true)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <SlidersHorizontal size={14} />
                  <span>Column Info and Note</span>
                </button>
              </>
            ) : (
              <>
                {folderHeaders.length > 0 && (
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
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

                <div>
                  <label htmlFor="itemNote" className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    id="itemNote"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={notePlaceholder || undefined}
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-shadow"
                  />
                </div>
              </>
            )}

            {isDuplicate && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-amber-700">
                  {item.folder_id
                    ? 'An item with identical column values already exists in this sheet.'
                    : 'An identical standalone item already exists at this location with the same name, info, and date.'}
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
    </ModalFrame>
  );
};

export default EditItemModal;
