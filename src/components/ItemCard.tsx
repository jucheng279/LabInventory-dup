import React, { useState } from 'react';
import { EllipsisVertical, Pencil, Trash2, Minus, Plus, ArrowRightLeft, TriangleAlert as AlertTriangle, Link2, Unlink, Snowflake, FolderKanban, Calendar, CalendarClock } from 'lucide-react';
import { getExpirationColor } from '../utils/cellDataUtils';
import { InventoryItem } from '../services/itemService';
import type { BoxGridItemLink } from '../types/database';
import SvgIcon from './SvgIcon';
import Portal from './Portal';
import { ITEM_FALLBACK_ICON_ID } from '../config/iconRegistry';

interface ItemCardProps {
  item: InventoryItem;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onMove?: (item: InventoryItem) => void;
  onAdjustStock: (itemId: string, delta: number) => void;
  onAdjustFreezeThaw?: (itemId: string, delta: number) => void;
  isExiting?: boolean;
  link?: BoxGridItemLink | null;
  onLinkedDecrement?: (link: BoxGridItemLink) => void;
  onUnlink?: (linkId: string) => void;
  onNavigateToLinkedBox?: (link: BoxGridItemLink) => void;
  onAddToProject?: (item: InventoryItem) => void;
  onView?: (item: InventoryItem) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, onEdit, onDelete, onMove, onAdjustStock, onAdjustFreezeThaw, isExiting = false, link, onLinkedDecrement, onUnlink, onNavigateToLinkedBox, onAddToProject, onView }) => {
  const isLinked = !!link;
  const hasUnit = !!item.unit;
  const isStockLinked = isLinked && !hasUnit;
  const isFreezeThawMode = (item.display_mode || 'stock') === 'freeze_thaw';
  const displayValue = isFreezeThawMode ? (item.freeze_thaw_cycles || 0) : item.stock_number;

  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [isEditingStock, setIsEditingStock] = useState(false);
  const [stockInput, setStockInput] = useState(String(displayValue));
  const menuRef = React.useRef<HTMLDivElement>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const stockInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        btnRef.current && !btnRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };
    const handleDismiss = () => setShowMenu(false);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', handleDismiss);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
    };
  }, [showMenu]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showMenu) {
      setShowMenu(false);
      return;
    }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setShowMenu(true);
  };

  React.useEffect(() => {
    setStockInput(String(displayValue));
  }, [displayValue]);

  const getAccentBorder = () => {
    return item.accent_color || '#3b82f6';
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFreezeThawMode) {
      if ((item.freeze_thaw_cycles || 0) > 0 && onAdjustFreezeThaw) {
        onAdjustFreezeThaw(item.id, -1);
      }
    } else if (isStockLinked && link && onLinkedDecrement) {
      onLinkedDecrement(link);
    } else if (item.stock_number > 0) {
      onAdjustStock(item.id, -1);
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFreezeThawMode) {
      onAdjustFreezeThaw?.(item.id, 1);
    } else {
      onAdjustStock(item.id, 1);
    }
  };

  const handleStockInputClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFreezeThawMode || !isStockLinked) {
      setIsEditingStock(true);
      setTimeout(() => stockInputRef.current?.select(), 0);
    }
  };

  const handleStockInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setStockInput(value);
    }
  };

  const handleStockInputBlur = () => {
    setIsEditingStock(false);
    const newVal = Math.max(0, parseInt(stockInput) || 0);
    const delta = newVal - displayValue;
    if (delta !== 0) {
      if (isFreezeThawMode) {
        onAdjustFreezeThaw?.(item.id, delta);
      } else {
        onAdjustStock(item.id, delta);
      }
    } else {
      setStockInput(String(displayValue));
    }
  };

  const handleStockInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStockInputBlur();
    } else if (e.key === 'Escape') {
      setStockInput(String(displayValue));
      setIsEditingStock(false);
    }
  };

  const isLowStock =
    !isFreezeThawMode &&
    !item.non_counted &&
    item.stock_threshold != null &&
    item.stock_number <= item.stock_threshold;

  const showStockLocked = isStockLinked && !isFreezeThawMode;

  return (
    <div
      className={`group relative bg-white rounded-xl overflow-hidden transition-all duration-300 h-[150px] shadow-sm ${
        isExiting
          ? 'animate-card-exit pointer-events-none'
          : 'hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-0.5'
      }`}
    >
      <div
        className="absolute top-0 left-0 w-0.5 h-full transition-all duration-300 group-hover:w-1"
        style={{ backgroundColor: getAccentBorder() }}
      />

      {isLowStock && (
        <div
          className="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 shadow-sm"
          title={`Low stock — at or below threshold of ${item.stock_threshold}`}
        >
          <AlertTriangle size={11} className="text-amber-700" strokeWidth={2.5} />
          <span className="text-[10px] font-semibold text-amber-800 leading-none">Low</span>
        </div>
      )}

      <div className="absolute top-2 right-2 z-10">
        <button
          ref={btnRef}
          onClick={openMenu}
          className="p-1 rounded-md bg-white/80 backdrop-blur-sm border border-gray-200/50 opacity-0 group-hover:opacity-100 touch-visible transition-all duration-200 hover:bg-gray-100"
        >
          <EllipsisVertical size={14} className="text-gray-500" />
        </button>
      </div>

      {showMenu && (
        <Portal>
          <div
            ref={menuRef}
            className="fixed w-28 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[9999]"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onEdit(item);
              }}
              className="w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Pencil size={12} />
              Edit
            </button>
            {onMove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onMove(item);
                }}
                className="w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
              >
                <ArrowRightLeft size={12} />
                Move
              </button>
            )}
            {isLinked && onUnlink && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onUnlink(link!.id);
                }}
                className="w-full px-2.5 py-1.5 text-left text-xs text-amber-600 hover:bg-amber-50 flex items-center gap-1.5"
              >
                <Unlink size={12} />
                Unlink
              </button>
            )}
            {onAddToProject && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onAddToProject(item);
                }}
                className="w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
              >
                <FolderKanban size={12} />
                Add to Project
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onDelete(item);
              }}
              className="w-full px-2.5 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </Portal>
      )}

      <div className="p-3">
        <div
          className={`flex items-start gap-3 ${onView ? 'cursor-pointer' : ''}`}
          onClick={(e) => {
            if (onView && !isExiting) {
              e.stopPropagation();
              onView(item);
            }
          }}
        >
          <div
            className="relative flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
            style={{
              background: `linear-gradient(135deg, ${getAccentBorder()}20 0%, ${getAccentBorder()}40 100%)`,
            }}
          >
            <SvgIcon iconId={item.icon_id || ITEM_FALLBACK_ICON_ID} size={32} color={getAccentBorder()} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate text-sm leading-tight">
              {item.name}
            </h3>
            {item.note && (
              <p className={`text-xs text-gray-500 mt-1 ${item.date && item.date_type && item.date_type !== 'none' ? 'truncate' : 'line-clamp-2'}`}>
                {item.note}
              </p>
            )}
            {item.date && item.date_type && item.date_type !== 'none' && (
              <p className={`text-xs mt-0.5 flex items-center gap-1 ${
                item.date_type === 'expiration' ? getExpirationColor(item.date) : 'text-gray-400'
              }`}>
                {item.date_type === 'expiration' ? <CalendarClock className="h-3 w-3 flex-shrink-0" /> : <Calendar className="h-3 w-3 flex-shrink-0" />}
                {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-1.5">
              {isFreezeThawMode ? (
                <Snowflake size={13} className="text-sky-500" />
              ) : (
                <span className="text-gray-500">Stock</span>
              )}
              {isLinked && link && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onNavigateToLinkedBox?.(link); }}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors cursor-pointer"
                  title={`Go to ${link.box_name || 'linked grid'}`}
                >
                  <Link2 size={9} />
                  {link.box_name || 'Grid'}
                </button>
              )}
            </div>
            {!isFreezeThawMode && !item.non_counted && item.unit && (
              <span className="text-xs font-semibold text-black tracking-wide">
                {item.unit === 'unit' ? (item.stock_number === 1 ? 'unit' : 'units') : item.unit}
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            {item.non_counted && !showStockLocked ? (
              <div
                className="w-16 h-8 flex items-center justify-center font-semibold text-lg"
                style={{ color: getAccentBorder() }}
              >
                <span className="leading-none text-2xl">n</span>
              </div>
            ) : (
              <>
                <button
                  onClick={handleDecrement}
                  disabled={displayValue === 0}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    displayValue === 0
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                  }`}
                >
                  <Minus size={16} />
                </button>

                {showStockLocked ? (
                  <div
                    className="w-16 h-8 text-center font-semibold text-lg rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center"
                    style={{ color: getAccentBorder() }}
                    title="Stock is tracked from freezer box grid"
                  >
                    {item.stock_number}
                  </div>
                ) : (
                  <input
                    ref={stockInputRef}
                    type="text"
                    value={isEditingStock ? stockInput : displayValue}
                    onClick={handleStockInputClick}
                    onChange={handleStockInputChange}
                    onBlur={handleStockInputBlur}
                    onKeyDown={handleStockInputKeyDown}
                    className={`w-16 h-8 text-center font-semibold text-lg rounded-lg border transition-all duration-200 ${
                      isEditingStock
                        ? 'border-blue-500 bg-white ring-2 ring-blue-500/20'
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100 cursor-pointer'
                    }`}
                    style={{ color: getAccentBorder() }}
                  />
                )}

                {(!isStockLinked || isFreezeThawMode) && (
                  <button
                    onClick={handleIncrement}
                    className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center transition-all duration-200 hover:bg-gray-200 hover:text-gray-800"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemCard;
