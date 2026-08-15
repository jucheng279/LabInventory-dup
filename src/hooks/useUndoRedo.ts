import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { undoRedoService } from '../services/undoRedoService';
import { getCellsQueryKey, getHistoryQueryKey } from './useBoxData';
import type { HistoryEntry } from '../types/database';

export function useUndoRedo(boxId: string, locationId?: string) {
  const queryClient = useQueryClient();
  const [isUndoing, setIsUndoing] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getCellsQueryKey(boxId) });
    queryClient.invalidateQueries({ queryKey: getHistoryQueryKey(boxId) });
    queryClient.invalidateQueries({ queryKey: ['revertGroups', boxId] });
    if (locationId) {
      queryClient.invalidateQueries({ queryKey: ['boxes', locationId] });
    }
    queryClient.invalidateQueries({ queryKey: ['folderItems'] });
    queryClient.invalidateQueries({ queryKey: ['lowStock'] });
  }, [queryClient, boxId, locationId]);

  const canUndoEntry = useCallback((entry: HistoryEntry): boolean => {
    return (
      entry.batch_id === null &&
      !entry.is_undone &&
      entry.previous_cell_data !== null &&
      entry.previous_cell_data !== undefined &&
      !entry.related_box_id
    );
  }, []);

  const canRedoEntry = useCallback((entry: HistoryEntry): boolean => {
    return (
      entry.is_undone === true &&
      entry.batch_id === null &&
      entry.redo_cell_data !== null &&
      entry.redo_cell_data !== undefined
    );
  }, []);

  const canUndoFromEntries = useCallback((entries: HistoryEntry[]): boolean => {
    return entries.some(e => canUndoEntry(e));
  }, [canUndoEntry]);

  const canRedoFromEntries = useCallback((entries: HistoryEntry[]): boolean => {
    return entries.some(e => canRedoEntry(e));
  }, [canRedoEntry]);

  const undo = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setIsUndoing(true);
    try {
      const result = await undoRedoService.undoLatest(boxId);
      if (result.success) invalidateQueries();
      return result;
    } finally {
      setIsUndoing(false);
    }
  }, [boxId, invalidateQueries]);

  const redo = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setIsRedoing(true);
    try {
      const result = await undoRedoService.redoLatest(boxId);
      if (result.success) invalidateQueries();
      return result;
    } finally {
      setIsRedoing(false);
    }
  }, [boxId, invalidateQueries]);

  const revertToEntry = useCallback(async (
    targetEntryId: string,
    teamMemberId: string
  ): Promise<{ success: boolean; revertedCount: number; error?: string }> => {
    setIsReverting(true);
    try {
      const result = await undoRedoService.revertToEntry(targetEntryId, boxId, teamMemberId);
      if (result.success) invalidateQueries();
      return result;
    } finally {
      setIsReverting(false);
    }
  }, [boxId, invalidateQueries]);

  const restoreLatestRevert = useCallback(async (): Promise<{ success: boolean; restoredCount: number; error?: string }> => {
    setIsRestoring(true);
    try {
      const result = await undoRedoService.restoreLatestRevert(boxId);
      if (result.success) invalidateQueries();
      return result;
    } finally {
      setIsRestoring(false);
    }
  }, [boxId, invalidateQueries]);

  return {
    undo,
    redo,
    revertToEntry,
    restoreLatestRevert,
    canUndoEntry,
    canRedoEntry,
    canUndoFromEntries,
    canRedoFromEntries,
    isUndoing,
    isRedoing,
    isReverting,
    isRestoring,
  };
}
