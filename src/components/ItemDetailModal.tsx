import React, { useState, useEffect, useRef } from 'react';
import { X, Pencil, Minus, Plus, Snowflake, Link2, Calendar, CalendarClock, Ban } from 'lucide-react';
import { InventoryItem, UpdateItemData } from '../services/itemService';
import type { ItemFolderHeader, BoxGridItemLink } from '../types/database';
import { getExpirationColor } from '../utils/cellDataUtils';
import SvgIcon from './SvgIcon';
import ModalFrame from './ModalFrame';
import { ITEM_FALLBACK_ICON_ID } from '../config/iconRegistry';

interface ItemDetailModalProps {
  item: InventoryItem;
  folderHeaders?: ItemFolderHeader[];
  customValues?: Record<string, string>;
  link?: BoxGridItemLink | null;
  onClose: () => void;
  onUpdate: (
    itemId: string,
    data: UpdateItemData,
    customValues?: { header_id: string; value: string }[],
  ) => void;
  onAdjustStock: (itemId: string, delta: number) => void;
  onAdjustFreezeThaw?: (itemId: string, delta: number) => void;
  onLinkedDecrement?: (link: BoxGridItemLink) => void;
  onNavigateToLinkedBox?: (link: BoxGridItemLink) => void;
}

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  folderHeaders = [],
  customValues = {},
  link,
  onClose,
  onUpdate,
  onAdjustStock,
  onAdjustFreezeThaw,
  onLinkedDecrement,
  onNavigateToLinkedBox,
}) => {
  const isLinked = !!link;
  const hasUnit = !!item.unit;
  const isStockLinked = isLinked && !hasUnit;
  const isFreezeThawMode = (item.display_mode || 'stock') === 'freeze_thaw';
  const [localQty, setLocalQty] = useState(() =>
    isFreezeThawMode ? (item.freeze_thaw_cycles || 0) : item.stock_number
  );
  const [qtyInputValue, setQtyInputValue] = useState(String(localQty));

  useEffect(() => {
    const next = isFreezeThawMode ? (item.freeze_thaw_cycles || 0) : item.stock_number;
    setLocalQty(next);
    setQtyInputValue(String(next));
  }, [item.stock_number, item.freeze_thaw_cycles, isFreezeThawMode]);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editNote, setEditNote] = useState(item.note || '');
  const [editDateType, setEditDateType] = useState<'date' | 'expiration' | 'none'>((item.date_type as 'date' | 'expiration' | 'none') || 'none');
  const [editDate, setEditDate] = useState(item.date || '');
  const [editHeaderValues, setEditHeaderValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    folderHeaders.forEach((h) => {
      initial[h.id] = customValues[h.id] || '';
    });
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const accentColor = item.accent_color || '#3b82f6';
  const hasFolderHeaders = folderHeaders.length > 0;

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isEditing]);

  const startEditing = () => {
    setEditName(item.name);
    setEditNote(item.note || '');
    setEditDateType((item.date_type as 'date' | 'expiration' | 'none') || 'none');
    setEditDate(item.date || '');
    const vals: Record<string, string> = {};
    folderHeaders.forEach((h) => { vals[h.id] = customValues[h.id] || ''; });
    setEditHeaderValues(vals);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const cv = folderHeaders
        .filter((h) => editHeaderValues[h.id]?.trim())
        .map((h) => ({ header_id: h.id, value: editHeaderValues[h.id].trim() }));

      const notePlaceholder = folderHeaders
        .map((h) => editHeaderValues[h.id]?.trim())
        .filter(Boolean)
        .join(' / ');
      const effectiveNote = editNote.trim() || notePlaceholder;

      await onUpdate(
        item.id,
        {
          name: editName.trim() || item.name,
          note: effectiveNote,
          date: editDateType === 'none' ? null : (editDate || null),
          date_type: editDateType,
        },
        cv.length > 0 ? cv : undefined,
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecrement = () => {
    if (localQty <= 0) return;
    const next = localQty - 1;
    setLocalQty(next);
    setQtyInputValue(String(next));
    if (isFreezeThawMode) {
      onAdjustFreezeThaw?.(item.id, -1);
    } else if (isStockLinked && link && onLinkedDecrement) {
      onLinkedDecrement(link);
    } else {
      onAdjustStock(item.id, -1);
    }
  };

  const handleIncrement = () => {
    const next = localQty + 1;
    setLocalQty(next);
    setQtyInputValue(String(next));
    if (isFreezeThawMode) {
      onAdjustFreezeThaw?.(item.id, 1);
    } else {
      onAdjustStock(item.id, 1);
    }
  };

  const commitQtyInput = () => {
    const parsed = parseInt(qtyInputValue, 10);
    if (isNaN(parsed) || parsed < 0) {
      setQtyInputValue(String(localQty));
      return;
    }
    const delta = parsed - localQty;
    if (delta === 0) return;
    setLocalQty(parsed);
    if (isFreezeThawMode) {
      onAdjustFreezeThaw?.(item.id, delta);
    } else {
      onAdjustStock(item.id, delta);
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
            <SvgIcon iconId={item.icon_id || ITEM_FALLBACK_ICON_ID} size={22} color={accentColor} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 truncate max-w-[200px]">
            {item.name}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Pencil size={14} />
              Edit
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

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-5">
        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Name</label>
            {isEditing ? (
              <input
                ref={nameInputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-sm"
              />
            ) : (
              <p className="text-sm text-gray-900 font-medium">{item.name}</p>
            )}
          </div>

          {/* Column values for folder items */}
          {hasFolderHeaders && (
            <div className="space-y-3">
              {folderHeaders.map((header) => (
                <div key={header.id}>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    {header.header_text}
                  </label>
                  {isEditing ? (
                    header.header_type === 'preset' ? (
                      <select
                        value={editHeaderValues[header.id] || ''}
                        onChange={(e) => setEditHeaderValues((prev) => ({ ...prev, [header.id]: e.target.value }))}
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
                      value={editHeaderValues[header.id] || ''}
                      onChange={(e) => setEditHeaderValues((prev) => ({ ...prev, [header.id]: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-sm"
                    />
                    )
                  ) : (
                    <p className="text-sm text-gray-900">
                      {customValues[header.id] || <span className="text-gray-400 italic">--</span>}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Info / Note */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              {hasFolderHeaders ? 'Notes' : 'Information'}
            </label>
            {isEditing ? (
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-shadow text-sm"
              />
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {item.note || <span className="text-gray-400 italic">--</span>}
              </p>
            )}
          </div>

          {/* Date - only for standalone items (no folder headers) */}
          {!hasFolderHeaders && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Date</label>
                {isEditing && (
                  <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setEditDateType('date');
                        if (!editDate) setEditDate(new Date().toISOString().split('T')[0]);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                        editDateType === 'date'
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
                        setEditDateType('expiration');
                        if (!editDate) setEditDate(new Date().toISOString().split('T')[0]);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                        editDateType === 'expiration'
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
                        setEditDateType('none');
                        setEditDate('');
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                        editDateType === 'none'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Ban className="h-3 w-3" />
                      None
                    </button>
                  </div>
                )}
              </div>
              {isEditing ? (
                <>
                  {editDateType !== 'none' && (
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className={`w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-shadow text-sm ${
                        editDateType === 'expiration'
                          ? 'border-amber-300 focus:ring-amber-500'
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                    />
                  )}
                </>
              ) : (
                <>
                  {item.date && item.date_type && item.date_type !== 'none' ? (
                    <p className={`text-sm flex items-center gap-1.5 ${
                      item.date_type === 'expiration' ? getExpirationColor(item.date) : 'text-gray-700'
                    }`}>
                      {item.date_type === 'expiration'
                        ? <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" />
                        : <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                      }
                      {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      <span className="text-xs text-gray-400 ml-1">
                        ({item.date_type === 'expiration' ? 'Expiration' : 'Date'})
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">--</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Edit mode action buttons */}
          {isEditing && (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={cancelEditing}
                className="flex-1 py-2.5 px-4 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!editName.trim() || isSubmitting}
                className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${
                  !editName.trim() || isSubmitting
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-md shadow-blue-500/20'
                }`}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 mt-5" />

        {/* Quantity Section */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[160px] pt-6">
          {isLinked && link && (
            <button
              type="button"
              onClick={() => onNavigateToLinkedBox?.(link)}
              className="inline-flex items-center gap-1 px-2 py-1 mb-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
            >
              <Link2 size={10} />
              {link.box_name || 'Grid'}
            </button>
          )}

          {item.non_counted && !isStockLinked ? (
            <div className="flex items-center justify-center py-2">
              <span className="text-2xl font-semibold" style={{ color: accentColor }}>n</span>
              <span className="text-xs text-gray-400 ml-2">Non-counted</span>
            </div>
          ) : (
            <div className="flex items-center w-full">
              {/* Stock + Unit label block */}
              <div className="flex flex-col items-start flex-shrink-0 w-16">
                {isFreezeThawMode ? (
                  <>
                    <Snowflake size={16} className="text-sky-500" />
                    <span className="text-[10px] font-medium text-gray-400 mt-0.5">cycles</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</span>
                    {item.unit && (
                      <span className="text-[11px] text-gray-400 mt-0.5">
                        {item.unit.toLowerCase()}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Quantity selector centered in remaining space */}
              <div className="flex-1 flex items-center justify-center gap-4">
                <button
                  onClick={handleDecrement}
                  disabled={localQty === 0}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    localQty === 0
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 active:scale-95'
                  }`}
                >
                  <Minus size={18} />
                </button>

                <input
                  type="text"
                  inputMode="numeric"
                  value={qtyInputValue}
                  onChange={(e) => setQtyInputValue(e.target.value.replace(/[^0-9]/g, ''))}
                  onBlur={commitQtyInput}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitQtyInput(); }}
                  className="w-20 h-10 text-center font-bold text-xl rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ color: accentColor }}
                />

                {(!isStockLinked || isFreezeThawMode) && (
                  <button
                    onClick={handleIncrement}
                    className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center transition-all duration-200 hover:bg-gray-200 hover:text-gray-800 active:scale-95"
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>
            </div>
          )}

          {isStockLinked && !isFreezeThawMode && (
            <p className="text-[11px] text-gray-400 text-center mt-2">Stock tracked from linked grid</p>
          )}
        </div>

      </div>
    </ModalFrame>
  );
};

export default ItemDetailModal;