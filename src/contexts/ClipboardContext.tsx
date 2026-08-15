import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ClipboardData } from '../types/clipboard';
import type { BoxType } from '../types/database';

interface ClipboardContextValue {
  clipboard: ClipboardData | null;
  setClipboard: (data: ClipboardData | null) => void;
  moveStaged: ClipboardData | null;
  setMoveStaged: (data: ClipboardData | null) => void;
  hasClipboard: boolean;
  hasMoveStaged: boolean;
  clipboardCellIds: Set<string>;
  moveStagedCellIds: Set<string>;
  clipboardOperation: 'copy' | 'cut' | null;
  sourceBoxId: string | null;
  sourceBoxType: BoxType | null;
  sourceBoxName: string | null;
  moveStagedBoxId: string | null;
  moveStagedBoxType: BoxType | null;
  moveStagedBoxName: string | null;
  canPasteIntoBox: (targetBoxType: BoxType) => boolean;
  canMoveIntoBox: (targetBoxType: BoxType) => boolean;
  isCrossBoxMove: (currentBoxId: string) => boolean;
  clearClipboard: () => void;
  clearMoveStaged: () => void;
}

const ClipboardContext = createContext<ClipboardContextValue | null>(null);

export function ClipboardProvider({ children }: { children: React.ReactNode }) {
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [moveStaged, setMoveStaged] = useState<ClipboardData | null>(null);

  const clipboardCellIds = useMemo(() => {
    if (!clipboard) return new Set<string>();
    return new Set(clipboard.sourceCellIds);
  }, [clipboard]);

  const moveStagedCellIds = useMemo(() => {
    if (!moveStaged) return new Set<string>();
    return new Set(moveStaged.sourceCellIds);
  }, [moveStaged]);

  const clipboardOperation = useMemo<'copy' | 'cut' | null>(() => {
    return clipboard?.operation ?? null;
  }, [clipboard]);

  const canPasteIntoBox = useCallback((targetBoxType: BoxType) => {
    if (!clipboard) return false;
    return clipboard.sourceBoxType === targetBoxType;
  }, [clipboard]);

  const canMoveIntoBox = useCallback((targetBoxType: BoxType) => {
    if (!moveStaged) return false;
    return moveStaged.sourceBoxType === targetBoxType;
  }, [moveStaged]);

  const isCrossBoxMove = useCallback((currentBoxId: string) => {
    if (!moveStaged) return false;
    return moveStaged.sourceBoxId !== currentBoxId;
  }, [moveStaged]);

  const clearClipboard = useCallback(() => setClipboard(null), []);
  const clearMoveStaged = useCallback(() => setMoveStaged(null), []);

  const value = useMemo<ClipboardContextValue>(() => ({
    clipboard,
    setClipboard,
    moveStaged,
    setMoveStaged,
    hasClipboard: clipboard !== null,
    hasMoveStaged: moveStaged !== null,
    clipboardCellIds,
    moveStagedCellIds,
    clipboardOperation,
    sourceBoxId: clipboard?.sourceBoxId ?? null,
    sourceBoxType: clipboard?.sourceBoxType ?? null,
    sourceBoxName: clipboard?.sourceBoxName ?? null,
    moveStagedBoxId: moveStaged?.sourceBoxId ?? null,
    moveStagedBoxType: moveStaged?.sourceBoxType ?? null,
    moveStagedBoxName: moveStaged?.sourceBoxName ?? null,
    canPasteIntoBox,
    canMoveIntoBox,
    isCrossBoxMove,
    clearClipboard,
    clearMoveStaged,
  }), [clipboard, moveStaged, clipboardCellIds, moveStagedCellIds, clipboardOperation, canPasteIntoBox, canMoveIntoBox, isCrossBoxMove, clearClipboard, clearMoveStaged]);

  return (
    <ClipboardContext.Provider value={value}>
      {children}
    </ClipboardContext.Provider>
  );
}

export function useClipboardContext(): ClipboardContextValue {
  const ctx = useContext(ClipboardContext);
  if (!ctx) throw new Error('useClipboardContext must be used within ClipboardProvider');
  return ctx;
}
