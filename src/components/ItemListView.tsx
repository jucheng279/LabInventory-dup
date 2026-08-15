import React, { useState, useMemo } from 'react';
import { EllipsisVertical, Pencil, Trash2, ArrowRightLeft, TriangleAlert as AlertTriangle, Link2, Snowflake } from 'lucide-react';
import { InventoryItem } from '../services/itemService';
import type { ItemFolderHeader, ItemCustomValuesMap, BoxGridItemLink } from '../types/database';
import SvgIcon from './SvgIcon';
import { ITEM_FALLBACK_ICON_ID } from '../config/iconRegistry';
import { formatStockWithUnit } from '../utils/unitOptions';

interface ItemListViewProps {
  items: InventoryItem[];
  headers?: ItemFolderHeader[];
  customValues?: ItemCustomValuesMap;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onMove: (item: InventoryItem) => void;
  itemLinks?: Record<string, BoxGridItemLink>;
  showMovePerItem?: boolean;
  highlightItemId?: string | null;
}

const ItemRowMenu: React.FC<{
  item: InventoryItem;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onMove: (item: InventoryItem) => void;
  showMove?: boolean;
}> = ({ item, onEdit, onDelete, onMove, showMove = true }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
      >
        <EllipsisVertical size={16} className="text-gray-400" />
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-1 w-28 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
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
          {showMove && (
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
      )}
    </div>
  );
};

const ItemListView: React.FC<ItemListViewProps> = ({ items, headers = [], customValues = {}, onEdit, onDelete, onMove, itemLinks = {}, showMovePerItem = true, highlightItemId }) => {
  const highlightRef = React.useRef<HTMLTableRowElement>(null);
  React.useEffect(() => {
    if (highlightItemId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightItemId]);
  const totalCols = 2 + headers.length + 1 + 1;
  const minWidth = Math.max(600, totalCols * 120);

  const { majorityHeader, minorityMode } = useMemo(() => {
    const stockCount = items.filter(i => (i.display_mode || 'stock') === 'stock').length;
    const ftCount = items.length - stockCount;
    if (ftCount > stockCount) {
      return { majorityHeader: 'F/T', minorityMode: 'stock' as const };
    }
    return { majorityHeader: 'Stock', minorityMode: 'freeze_thaw' as const };
  }, [items]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full table-fixed" style={{ minWidth: `${minWidth}px` }}>
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
              Name
            </th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-20">
              {majorityHeader}
            </th>
            {headers.map((h) => (
              <th
                key={h.id}
                className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3"
              >
                {h.header_text}
              </th>
            ))}
            <th className="w-10 px-2 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => {
            const accentColor = item.accent_color || '#3b82f6';
            const itemCustom = customValues[item.id] || {};
            const itemMode = item.display_mode || 'stock';
            const isFreezeThaw = itemMode === 'freeze_thaw';
            const isMinority = itemMode === minorityMode;
            const displayValue = isFreezeThaw ? (item.freeze_thaw_cycles || 0) : item.stock_number;

            const isHighlighted = highlightItemId === item.id;
            return (
              <tr
                key={item.id}
                ref={isHighlighted ? highlightRef : undefined}
                className={`hover:bg-gray-50/50 transition-colors group ${isHighlighted ? 'ring-2 ring-emerald-400 ring-inset bg-emerald-50/40' : ''}`}
              >
                <td className="px-4 py-3 overflow-hidden">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}40 100%)`,
                      }}
                    >
                      <SvgIcon iconId={item.icon_id || ITEM_FALLBACK_ICON_ID} size={18} color={accentColor} />
                    </div>
                    <span className="font-medium text-sm text-gray-900 truncate">
                      {item.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const isLowStock =
                      !isFreezeThaw &&
                      !item.non_counted &&
                      item.stock_threshold != null &&
                      item.stock_number <= item.stock_threshold;
                    const hasLink = !!itemLinks[item.id];
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                          isLowStock ? 'text-amber-700' : 'text-gray-900'
                        }`}
                        title={isLowStock ? `Low stock — at or below threshold of ${item.stock_threshold}` : hasLink ? 'Stock tracked from grid' : undefined}
                      >
                        {hasLink && <Link2 size={12} className="text-emerald-600" />}
                        {isLowStock && <AlertTriangle size={14} className="text-amber-600" strokeWidth={2.5} />}
                        {item.non_counted ? (
                          <span className="text-lg font-semibold leading-none">n</span>
                        ) : isFreezeThaw ? (
                          String(displayValue)
                        ) : (
                          formatStockWithUnit(item.stock_number, item.unit)
                        )}
                        {isMinority && (
                          <span className="ml-1 px-1.5 py-0.5 text-[9px] font-medium rounded bg-gray-100 text-gray-500 border border-gray-200 leading-none inline-flex items-center">
                            {isFreezeThaw ? <Snowflake size={9} className="text-sky-500" /> : 'Stock'}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </td>
                {headers.map((h) => (
                  <td key={h.id} className="px-4 py-3 overflow-hidden">
                    <span className="text-sm text-gray-600 truncate block">
                      {itemCustom[h.id] || '-'}
                    </span>
                  </td>
                ))}
                <td className="px-2 py-3">
                  <ItemRowMenu
                    item={item}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMove={onMove}
                    showMove={showMovePerItem}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ItemListView;
