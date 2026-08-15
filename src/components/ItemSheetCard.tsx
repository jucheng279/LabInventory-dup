import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pencil, Trash2, ArrowRightLeft, Table2 } from 'lucide-react';
import type { ItemSheetWithStats } from '../types/database';
import Portal from './Portal';

interface ItemSheetCardProps {
  sheet: ItemSheetWithStats;
  onOpen: (sheet: ItemSheetWithStats) => void;
  onEdit: (sheet: ItemSheetWithStats) => void;
  onDelete: (sheet: ItemSheetWithStats) => void;
  onMove: (sheet: ItemSheetWithStats) => void;
  isExiting?: boolean;
}

const ItemSheetCard: React.FC<ItemSheetCardProps> = ({ sheet, onOpen, onEdit, onDelete, onMove, isExiting = false }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
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

  const accentColor = sheet.accent_color || '#3b82f6';

  return (
    <div
      className={`group relative bg-white rounded-xl overflow-hidden transition-all duration-300 cursor-pointer shadow-sm h-[150px] ${
        isExiting
          ? 'animate-card-exit pointer-events-none'
          : 'hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-0.5'
      }`}
      onClick={() => !isExiting && onOpen(sheet)}
    >
      <div
        className="absolute top-0 left-0 w-0.5 h-full transition-all duration-300 group-hover:w-1"
        style={{ backgroundColor: accentColor }}
      />

      <div className="absolute top-2 right-2 z-10">
        <button
          ref={btnRef}
          onClick={openMenu}
          className="p-1 rounded-md bg-white/80 backdrop-blur-sm border border-gray-200/50 opacity-0 group-hover:opacity-100 touch-visible transition-all duration-200 hover:bg-gray-100"
        >
          <MoreVertical size={14} className="text-gray-500" />
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
                onEdit(sheet);
              }}
              className="w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Pencil size={12} />
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onMove(sheet);
              }}
              className="w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <ArrowRightLeft size={12} />
              Move
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                onDelete(sheet);
              }}
              className="w-full px-2.5 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        </Portal>
      )}

      <div className="p-3 h-full flex flex-col justify-between">
        <div className="flex items-start gap-3">
          <div
            className="relative flex-shrink-0 w-14 h-14 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
            style={{
              background: `linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}40 100%)`,
            }}
          >
            <Table2 size={28} style={{ color: accentColor }} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate text-sm leading-tight">
              {sheet.name}
            </h3>
            {sheet.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                {sheet.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Items</span>
          <span
            className="font-semibold text-sm"
            style={{ color: accentColor }}
          >
            {sheet.item_count}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ItemSheetCard;
