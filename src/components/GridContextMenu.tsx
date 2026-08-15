import React, { useEffect, useRef } from 'react';
import { Copy, Scissors, ClipboardPaste, Move, X, Trash2, Palette } from 'lucide-react';
import Portal from './Portal';
import { COLORS } from './ColorPicker';

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? '\u2318' : 'Ctrl+';
const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

interface GridContextMenuProps {
  x: number;
  y: number;
  hasSelection: boolean;
  hasClipboard: boolean;
  hasMoveStaged: boolean;
  hasSelectionAny: boolean;
  canPaste?: boolean;
  canMove?: boolean;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onMoveStage: () => void;
  onMoveExecute: () => void;
  onCancelMove: () => void;
  onDelete: () => void;
  onCross: () => void;
  hasNonEmptyCells: boolean;
  onColorSelect: (color: string | null) => void;
  onClose: () => void;
}

const GridContextMenu: React.FC<GridContextMenuProps> = ({
  x,
  y,
  hasSelection,
  hasClipboard,
  hasMoveStaged,
  hasSelectionAny,
  canPaste = true,
  canMove = true,
  onCopy,
  onCut,
  onPaste,
  onMoveStage,
  onMoveExecute,
  onCancelMove,
  onDelete,
  onCross,
  hasNonEmptyCells,
  onColorSelect,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  useEffect(() => {
    if (!menuRef.current) return;
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    if (rect.right > viewportW) {
      menu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > viewportH) {
      menu.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  if (hasMoveStaged) {
    const moveItems = [
      { label: canMove ? 'Move Here' : 'Move Here (incompatible type)', icon: Move, action: onMoveExecute, enabled: canMove, shortcut: `${modKey}M` },
      { label: 'Cancel Move', icon: X, action: onCancelMove, enabled: true, shortcut: 'Esc' },
    ];

    return (
      <Portal>
        <div
          ref={menuRef}
          className="fixed z-[60] bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[160px] animate-scale-in origin-top-left"
          style={{ left: x, top: y }}
        >
          {moveItems.map(({ label, icon: Icon, action, enabled, shortcut }) => (
            <button
              key={label}
              onClick={() => {
                if (enabled) {
                  action();
                  onClose();
                }
              }}
              disabled={!enabled}
              className={`w-full flex items-center gap-3 px-3.5 py-2 text-sm transition-colors ${
                enabled
                  ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                  : 'text-gray-300 cursor-not-allowed'
              }`}
            >
              <Icon size={16} className={enabled ? 'text-gray-500' : 'text-gray-300'} />
              <span>{label}</span>
              {!isTouchDevice && <span className="ml-auto text-xs text-gray-400">{shortcut}</span>}
            </button>
          ))}
        </div>
      </Portal>
    );
  }

  const pasteEnabled = hasClipboard && canPaste;
  const clipboardItems = [
    { label: 'Copy', icon: Copy, action: onCopy, enabled: hasSelection, shortcut: `${modKey}C` },
    { label: 'Cut', icon: Scissors, action: onCut, enabled: hasSelection, shortcut: `${modKey}X` },
    { label: pasteEnabled ? 'Paste' : hasClipboard ? 'Paste (incompatible type)' : 'Paste', icon: ClipboardPaste, action: onPaste, enabled: pasteEnabled, shortcut: `${modKey}V` },
    { label: 'Move', icon: Move, action: onMoveStage, enabled: hasSelection, shortcut: `${modKey}M` },
  ];

  return (
    <Portal>
      <div
        ref={menuRef}
        className="fixed z-[60] bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[200px] animate-scale-in origin-top-left"
        style={{ left: x, top: y }}
      >
        {clipboardItems.map(({ label, icon: Icon, action, enabled, shortcut }) => (
          <button
            key={label}
            onClick={() => {
              if (enabled) {
                action();
                onClose();
              }
            }}
            disabled={!enabled}
            className={`w-full flex items-center gap-3 px-3.5 py-2 text-sm transition-colors ${
              enabled
                ? 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            <Icon size={16} className={enabled ? 'text-gray-500' : 'text-gray-300'} />
            <span>{label}</span>
            {!isTouchDevice && <span className={`ml-auto text-xs ${enabled ? 'text-gray-400' : 'text-gray-300'}`}>{shortcut}</span>}
          </button>
        ))}

        <div className="border-t border-gray-100 my-1" />

        <button
          onClick={() => {
            if (hasNonEmptyCells) {
              onCross();
              onClose();
            }
          }}
          disabled={!hasNonEmptyCells}
          className={`w-full flex items-center gap-3 px-3.5 py-2 text-sm transition-colors ${
            hasNonEmptyCells
              ? 'text-amber-600 hover:bg-amber-50 cursor-pointer'
              : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          <X size={16} className={hasNonEmptyCells ? 'text-amber-500' : 'text-gray-300'} />
          <span>Cross</span>
          {!isTouchDevice && <span className={`ml-auto text-xs ${hasNonEmptyCells ? 'text-gray-400' : 'text-gray-300'}`}>X</span>}
        </button>

        <button
          onClick={() => {
            if (hasSelection) {
              onDelete();
              onClose();
            }
          }}
          disabled={!hasSelection}
          className={`w-full flex items-center gap-3 px-3.5 py-2 text-sm transition-colors ${
            hasSelection
              ? 'text-red-600 hover:bg-red-50 cursor-pointer'
              : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          <Trash2 size={16} className={hasSelection ? 'text-red-500' : 'text-gray-300'} />
          <span>Delete</span>
          {!isTouchDevice && <span className={`ml-auto text-xs ${hasSelection ? 'text-gray-400' : 'text-gray-300'}`}>{isMac ? '\u232B' : 'Del'}</span>}
        </button>

        <div className="border-t border-gray-100 my-1" />

        <div className={`px-3.5 py-2 ${!hasSelectionAny ? 'opacity-40' : ''}`}>
          <div className="flex items-center gap-3 mb-2">
            <Palette size={16} className={hasSelectionAny ? 'text-gray-500' : 'text-gray-300'} />
            <span className={`text-sm ${hasSelectionAny ? 'text-gray-700' : 'text-gray-300'}`}>Color</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (hasSelectionAny) {
                  onColorSelect(null);
                  onClose();
                }
              }}
              disabled={!hasSelectionAny}
              className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                hasSelectionAny
                  ? 'border-gray-300 hover:border-gray-500 hover:scale-110 cursor-pointer'
                  : 'border-gray-200 cursor-not-allowed'
              }`}
              title="No color"
            >
              <X size={10} className="text-gray-400" />
            </button>
            {COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => {
                  if (hasSelectionAny) {
                    onColorSelect(color.value);
                    onClose();
                  }
                }}
                disabled={!hasSelectionAny}
                className={`w-5 h-5 rounded-full border transition-all ${
                  hasSelectionAny
                    ? 'border-gray-200 hover:border-gray-500 hover:scale-110 cursor-pointer'
                    : 'border-gray-200 cursor-not-allowed'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default GridContextMenu;
