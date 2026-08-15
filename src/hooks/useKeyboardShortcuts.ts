import { useEffect, useRef } from 'react';

interface KeyboardShortcutOptions {
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onApply: () => void;
  onCross: () => void;
  onMoveStage: () => void;
  onMoveExecute: () => void;
  hasSelection: boolean;
  hasClipboard: boolean;
  hasNonEmptyCells: boolean;
  hasMoveStaged: boolean;
  hasSelectedCells: boolean;
  disabled: boolean;
}

const isInputElement = (el: Element | null): boolean => {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
};

export function useKeyboardShortcuts(options: KeyboardShortcutOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const opts = optionsRef.current;
      if (opts.disabled) return;
      if (isInputElement(document.activeElement)) return;

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 'c' && !e.shiftKey) {
        if (opts.hasSelection) {
          e.preventDefault();
          opts.onCopy();
        }
        return;
      }

      if (isMod && e.key === 'x' && !e.shiftKey) {
        if (opts.hasSelection) {
          e.preventDefault();
          opts.onCut();
        }
        return;
      }

      if (isMod && e.key === 'v' && !e.shiftKey) {
        if (opts.hasClipboard) {
          e.preventDefault();
          opts.onPaste();
        }
        return;
      }

      if (isMod && e.key === 'm' && !e.shiftKey) {
        if (opts.hasMoveStaged) {
          e.preventDefault();
          opts.onMoveExecute();
        } else if (opts.hasSelection) {
          e.preventDefault();
          opts.onMoveStage();
        }
        return;
      }

      if ((e.key === 'Backspace' || e.key === 'Delete') && !isMod && !e.shiftKey) {
        if (opts.hasNonEmptyCells) {
          e.preventDefault();
          opts.onDelete();
        }
        return;
      }

      if (e.key === ' ' && !isMod && !e.shiftKey) {
        if (opts.hasSelectedCells) {
          e.preventDefault();
          opts.onApply();
        }
        return;
      }

      if (e.key === 'x' && !isMod && !e.shiftKey) {
        if (opts.hasNonEmptyCells) {
          e.preventDefault();
          opts.onCross();
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
