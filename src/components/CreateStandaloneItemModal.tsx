import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Calendar, CalendarClock, Ban, AlertCircle } from 'lucide-react';
import ModalFrame from './ModalFrame';
import IconPresetRow from './IconPresetRow';
import UnitSelector from './UnitSelector';
import SvgIcon from './SvgIcon';
import { ACCENT_COLORS } from '../constants/accentColors';
import { getGridPresetIcons, getDefaultHubConfig } from '../config/iconRegistry';
import type { DisplayMode } from '../types/database';

interface ExistingStandaloneItem {
  id: string;
  name: string;
  note: string;
  date: string | null;
}

interface CreateStandaloneItemModalProps {
  existingItems?: ExistingStandaloneItem[];
  onClose: () => void;
  onCreate: (itemData: {
    name: string;
    note: string;
    stock_number: number;
    stock_threshold: number | null;
    unit: string;
    non_counted: boolean;
    item_type: string;
    accent_color: string | null;
    icon_id: string | null;
    display_mode: string;
    freeze_thaw_cycles: number;
    date: string | null;
    date_type: string;
  }) => void;
}

const CreateStandaloneItemModal: React.FC<CreateStandaloneItemModalProps> = ({ existingItems = [], onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('stock');
  const [stockNumber, setStockNumber] = useState('');
  const [freezeThawCycles, setFreezeThawCycles] = useState('');
  const [stockThreshold, setStockThreshold] = useState('');
  const [unit, setUnit] = useState('');
  const [nonCounted, setNonCounted] = useState(false);
  const [accentColor, setAccentColor] = useState<string | null>(ACCENT_COLORS[0].value);
  const [iconId, setIconId] = useState<string | null>(null);
  const [dateType, setDateType] = useState<'date' | 'expiration' | 'none'>('none');
  const [date, setDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const itemPresets = getGridPresetIcons('item', 7);
  const hubConfig = getDefaultHubConfig('item');

  const isStockMode = displayMode === 'stock';
  const activeValue = isStockMode ? stockNumber : freezeThawCycles;

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const isDuplicate = useMemo(() => {
    const trimmedName = name.trim().toLowerCase();
    const trimmedNote = note.trim().toLowerCase();
    const effectiveDate = dateType === 'none' ? null : (date || null);
    if (!trimmedName) return false;
    return existingItems.some(item =>
      item.name.trim().toLowerCase() === trimmedName &&
      (item.note || '').trim().toLowerCase() === trimmedNote &&
      (item.date || null) === effectiveDate
    );
  }, [name, note, dateType, date, existingItems]);

  const isFormValid = name.trim() && !isDuplicate && (nonCounted || (activeValue === '' || parseInt(activeValue) >= 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        note: note.trim(),
        stock_number: nonCounted ? 0 : (parseInt(stockNumber) || 0),
        stock_threshold: nonCounted || stockThreshold === '' ? null : Math.max(0, parseInt(stockThreshold) || 0),
        unit: isStockMode ? unit : '',
        non_counted: nonCounted,
        item_type: 'Antibody',
        accent_color: accentColor,
        icon_id: iconId,
        display_mode: displayMode,
        freeze_thaw_cycles: parseInt(freezeThawCycles) || 0,
        date: dateType === 'none' ? null : (date || null),
        date_type: dateType,
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            placeholder=""
            required
          />
        </div>

        <div>
          <label htmlFor="itemNote" className="block text-sm font-medium text-gray-700 mb-1">
            Item Information
          </label>
          <input
            type="text"
            id="itemNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            placeholder=""
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
                  value={isStockMode ? stockNumber : freezeThawCycles}
                  onChange={(e) => isStockMode ? setStockNumber(e.target.value) : setFreezeThawCycles(e.target.value)}
                  placeholder="0"
                  min={0}
                  disabled={nonCounted}
                  className={`w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${
                    nonCounted ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''
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

        {isDuplicate && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-amber-700">
              An identical standalone item already exists at this location with the same name, info, and date.
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

export default CreateStandaloneItemModal;
