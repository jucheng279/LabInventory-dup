import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Layers, ChevronLeft, ChevronRight, Columns3, ALargeSmall, RotateCcw, Factory as History, QrCode } from 'lucide-react';
import SlideGrid from './SlideGrid';
import MultiColumnSlideGrid from './MultiColumnSlideGrid';
import SlideInputSection from './SlideInputSection';
import SlideDetailModal from './SlideDetailModal';
import SlideHistoryModal from './SlideHistoryModal';
import GridContextMenu from './GridContextMenu';
import PasteConfirmModal from './PasteConfirmModal';
import BoxLabelViewModal from './BoxLabelViewModal';
import Toast from './Toast';
import { CellData, locationCellService } from '../services/locationCellService';
import { historyService } from '../services/historyService';
import { useSlideBoxData, useUpsertSlideCells } from '../hooks/useSlideBoxData';
import { useDeleteCells, useCrossCells, getCellsQueryKey } from '../hooks/useBoxData';
import { getBoxesQueryKey, getItemsQueryKey, useUpdateBox } from '../hooks/useWorkspaceData';
import { useAuth } from '../contexts/AuthContext';
import { detectCommonSlideData, SlidePartialMatch, SlideFieldMatchStatus } from '../utils/slideDataUtils';
import { useGridClipboard } from '../hooks/useGridClipboard';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { PasteResult, SwapResult, SlideHeaderSnapshot } from '../utils/clipboardUtils';
import { scaled, computeIdealRowWidth, computeScaleFactor } from '../utils/scaleUtils';
import type { HistoryActionContext } from '../types/database';
import { useBoxAccessLevel } from '../hooks/useBoxPrivacy';

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRST';
const STORAGE_KEY_ALL_COLUMNS = 'slideBoxView_showAllColumns';

interface SlideBoxViewProps {
  boxId: string;
  boxName: string;
  boxAccentColor?: string | null;
  locationId: string;
  onBack: () => void;
  highlightCellId?: string;
  highlightColumn?: number;
}

const SlideBoxView: React.FC<SlideBoxViewProps> = ({
  boxId,
  boxName,
  boxAccentColor,
  locationId,
  onBack,
  highlightCellId,
  highlightColumn,
}) => {
  const accentColor = boxAccentColor || '#3b82f6';
  const queryClient = useQueryClient();
  const { teamMember } = useAuth();
  const accessLevel = useBoxAccessLevel(boxId);
  const readOnly = accessLevel === 'view' || accessLevel === 'none';

  const { box, cellData, headers, slideValues, isLoading } = useSlideBoxData(boxId);
  const upsertSlideMutation = useUpsertSlideCells(boxId, locationId);
  const deleteCellsMutation = useDeleteCells(boxId, locationId);
  const crossCellsMutation = useCrossCells(boxId, locationId);
  const updateBoxMutation = useUpdateBox(locationId);

  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const [partialMatch, setPartialMatch] = useState<SlidePartialMatch | null>(null);
  const [detailCellId, setDetailCellId] = useState<string | null>(null);
  const [showAllColumns, setShowAllColumns] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_ALL_COLUMNS) === 'true';
    } catch {
      return false;
    }
  });
  const [showFontSizePopover, setShowFontSizePopover] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [localSlideFontDivisor, setLocalSlideFontDivisor] = useState(10);
  const fontSizeButtonRef = useRef<HTMLButtonElement>(null);

  const formDataRef = useRef<{
    headerValues: Record<number, string>;
    color: string | null;
    activeFields: SlideFieldMatchStatus;
  }>({
    headerValues: {},
    color: null,
    activeFields: { headerFields: {}, color: true },
  });

  const singleColumnRef = useRef<HTMLDivElement>(null);
  const [singleScaleFactor, setSingleScaleFactor] = useState(1);
  const hoveredCellRef = useRef<string | null>(null);

  const {
    clipboard, hasClipboard, clipboardCellIds, clipboardOperation,
    copyToClipboard, cutToClipboard, getPastePreview, clearClipboard,
    hasMoveStaged, moveStagedCellIds, stageForMove, getMovePreview, clearMoveStaged,
    canPasteIntoBox, canMoveIntoBox, isCrossBoxMove,
    sourceBoxName, moveStagedBoxId, moveStagedBoxName,
  } = useGridClipboard();

  const boxSource = useMemo(() => ({ boxId, boxType: 'slide' as const, boxName }), [boxId, boxName]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [showLabelView, setShowLabelView] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; anchorCellId: string } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    operation: 'paste' | 'swap';
    pasteResult?: PasteResult;
    swapResult?: SwapResult;
    clipboardRef?: { operation: 'copy' | 'cut'; sourceCellIds: string[]; sourceBoxId?: string; sourceBoxName?: string };
  } | null>(null);

  const rows = box?.rows ?? 0;
  const columns = box?.columns ?? 1;
  const activeColumn = ROW_LABELS[activeColumnIndex] || 'A';

  useEffect(() => {
    if (box?.slide_font_divisor !== undefined) {
      setLocalSlideFontDivisor(box.slide_font_divisor);
    }
  }, [box?.slide_font_divisor]);

  const sortedHeaders = useMemo(
    () => [...headers].sort((a, b) => a.display_order - b.display_order),
    [headers]
  );

  const handleToggleAllColumns = useCallback((value: boolean) => {
    setShowAllColumns(value);
    try {
      localStorage.setItem(STORAGE_KEY_ALL_COLUMNS, String(value));
    } catch { /* ignore */ }
    if (!value) {
      setActiveColumnIndex(0);
    }
  }, []);

  const handleSlideFontDivisorChange = useCallback((divisor: number) => {
    setLocalSlideFontDivisor(divisor);
  }, []);

  const handleSlideFontDivisorSave = useCallback(async (divisor: number) => {
    try {
      await updateBoxMutation.mutateAsync({
        boxId,
        data: { slide_font_divisor: divisor },
      });
    } catch (error) {
      console.error('Failed to save slide font setting:', error);
    }
  }, [boxId, updateBoxMutation]);

  const handleResetSlideFontDivisor = useCallback(() => {
    setLocalSlideFontDivisor(10);
    handleSlideFontDivisorSave(10);
  }, [handleSlideFontDivisorSave]);

  useEffect(() => {
    if (!showFontSizePopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const popover = document.getElementById('slide-font-popover');
      if (
        popover && !popover.contains(target) &&
        fontSizeButtonRef.current && !fontSizeButtonRef.current.contains(target)
      ) {
        setShowFontSizePopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFontSizePopover]);

  useEffect(() => {
    if (headers.length > 0) {
      const match = detectCommonSlideData(selectedCells, cellData, slideValues, headers);
      setPartialMatch(match.hasAnyData ? match : null);
    } else {
      setPartialMatch(null);
    }
  }, [selectedCells, cellData, slideValues, headers]);

  const highlightAppliedRef = useRef(false);
  useEffect(() => {
    if (box && !highlightAppliedRef.current) {
      if (highlightColumn !== undefined) {
        setActiveColumnIndex(highlightColumn);
      } else if (highlightCellId) {
        const letter = highlightCellId.charAt(0).toUpperCase();
        const idx = ROW_LABELS.indexOf(letter);
        if (idx >= 0) setActiveColumnIndex(idx);
      }
      if (highlightCellId) {
        setSelectedCells(new Set([highlightCellId]));
      }
      if (highlightCellId || highlightColumn !== undefined) {
        highlightAppliedRef.current = true;
      }
    }
  }, [highlightCellId, highlightColumn, box]);

  const singleColIdealWidth = useMemo(
    () => computeIdealRowWidth(sortedHeaders.length),
    [sortedHeaders.length]
  );

  useEffect(() => {
    const el = singleColumnRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSingleScaleFactor(computeScaleFactor(entry.contentRect.width, singleColIdealWidth));
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [singleColIdealWidth]);

  useEffect(() => {
    if (!hasMoveStaged) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearMoveStaged();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [hasMoveStaged, clearMoveStaged]);

  useEffect(() => {
    if (!hasClipboard) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearClipboard();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [hasClipboard, clearClipboard]);

  const handleCellSelection = useCallback((cellId: string, isSelected: boolean) => {
    setSelectedCells((prev) => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(cellId);
      } else {
        newSet.delete(cellId);
      }
      return newSet;
    });
  }, []);

  const handleApply = useCallback(
    async (headerValues: Record<number, string>, color: string | null, activeFields: SlideFieldMatchStatus) => {
      if (selectedCells.size === 0 || headers.length === 0) return;

      try {
        const headerByOrder: Record<number, string> = {};
        for (const h of headers) {
          headerByOrder[h.display_order] = h.id;
        }

        const cellsToUpdate = Array.from(selectedCells).map((cellId) => {
          const existing = cellData[cellId];
          const existingValues = slideValues[cellId] || {};

          const mergedHeaderValues: Array<{ headerId: string; value: string }> = [];
          for (const h of headers) {
            const isActive = activeFields.headerFields[h.display_order] ?? true;
            const value = isActive
              ? (headerValues[h.display_order] || '')
              : (existingValues[h.display_order] || '');
            mergedHeaderValues.push({ headerId: h.id, value });
          }

          const mergedColor = activeFields.color ? color : (existing?.color ?? null);

          const data: CellData = {
            name: existing?.name ?? '',
            information: existing?.information ?? '',
            date: existing?.date ?? null,
            color: mergedColor,
            date_type: existing?.date_type ?? 'none',
            slide_image_url: existing?.slide_image_url ?? null,
          };

          return { cellId, data, headerValues: mergedHeaderValues };
        });

        setSelectedCells(new Set());
        await upsertSlideMutation.mutateAsync({
          cells: cellsToUpdate,
          teamMemberId: teamMember?.id,
        });
      } catch (error) {
        console.error('Failed to apply slide data:', error);
      }
    },
    [selectedCells, cellData, slideValues, headers, upsertSlideMutation, teamMember]
  );

  const handleClear = useCallback(async () => {
    try {
      const cellIds = Array.from(selectedCells).filter(cellId => cellData[cellId]);
      if (cellIds.length === 0) return;
      setSelectedCells(new Set());
      await deleteCellsMutation.mutateAsync({
        cellIds,
        teamMemberId: teamMember?.id,
      });
    } catch (error) {
      console.error('Failed to clear slide data:', error);
    }
  }, [selectedCells, cellData, deleteCellsMutation, teamMember]);

  const handleCross = useCallback(async () => {
    try {
      const cellIds = Array.from(selectedCells).filter(cellId => cellData[cellId]);
      if (cellIds.length === 0) return;
      setSelectedCells(new Set());
      await crossCellsMutation.mutateAsync({
        cellIds,
        teamMemberId: teamMember?.id,
      });
    } catch (error) {
      console.error('Failed to cross slide data:', error);
    }
  }, [selectedCells, cellData, crossCellsMutation, teamMember]);

  const handleColumnChange = useCallback((direction: 'prev' | 'next') => {
    setActiveColumnIndex(prev => {
      if (direction === 'prev') return Math.max(0, prev - 1);
      return Math.min(columns - 1, prev + 1);
    });
    setSelectedCells(new Set());
  }, [columns]);

  const handlePrefetchWorkspace = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: getBoxesQueryKey(locationId),
      staleTime: 30 * 1000,
    });
    queryClient.prefetchQuery({
      queryKey: getItemsQueryKey(locationId),
      staleTime: 30 * 1000,
    });
  }, [queryClient, locationId]);

  const hasNonEmptyCells = useMemo(() => {
    return Array.from(selectedCells).some(cellId => cellData[cellId]);
  }, [selectedCells, cellData]);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (selectedCells.size > 0) {
      setSelectedCells(new Set());
    }
  }, [selectedCells.size]);

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleOpenSlideDetails = useCallback((cellId: string) => {
    setDetailCellId(cellId);
  }, []);

  const handleSlideDetailSave = useCallback(async (
    cellId: string,
    headerValues: Array<{ headerId: string; value: string }>,
    color: string | null
  ) => {
    const existing = cellData[cellId];
    const data: CellData = {
      name: existing?.name ?? '',
      information: existing?.information ?? '',
      date: existing?.date ?? null,
      color,
      date_type: existing?.date_type ?? 'none',
      slide_image_url: existing?.slide_image_url ?? null,
    };

    await upsertSlideMutation.mutateAsync({
      cells: [{ cellId, data, headerValues }],
      teamMemberId: teamMember?.id,
    });
  }, [cellData, upsertSlideMutation, teamMember]);

  const handleImageUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getCellsQueryKey(boxId) });
  }, [queryClient, boxId]);

  const handleFormDataChange = useCallback((
    headerValues: Record<number, string>,
    color: string | null,
    activeFields: SlideFieldMatchStatus
  ) => {
    formDataRef.current = { headerValues, color, activeFields };
  }, []);

  const handleGridContextMenu = useCallback((cellId: string, x: number, y: number) => {
    setContextMenu({ x, y, anchorCellId: cellId });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleHoveredCellChange = useCallback((cellId: string | null) => {
    hoveredCellRef.current = cellId;
  }, []);

  const slideHeaderSnapshotToUpsertValues = useCallback((snapshot?: SlideHeaderSnapshot): Array<{ headerId: string; value: string }> => {
    if (!snapshot || headers.length === 0) return headers.map(h => ({ headerId: h.id, value: '' }));
    return headers.map(h => ({
      headerId: h.id,
      value: snapshot[h.display_order] || '',
    }));
  }, [headers]);

  const handleCopy = useCallback(() => {
    if (selectedCells.size === 0) return;
    copyToClipboard(selectedCells, cellData, boxSource, slideValues, true);
  }, [selectedCells, cellData, slideValues, copyToClipboard, boxSource]);

  const handleCut = useCallback(() => {
    if (selectedCells.size === 0) return;
    cutToClipboard(selectedCells, cellData, boxSource, slideValues, true);
  }, [selectedCells, cellData, slideValues, cutToClipboard, boxSource]);

  const executePaste = useCallback(async (result: PasteResult, sourceClipboard?: { operation: 'copy' | 'cut'; sourceCellIds: string[]; sourceBoxId?: string; sourceBoxName?: string }) => {
    try {
      const cellsToUpsert = result.mappings.map(m => ({
        cellId: m.targetCellId,
        data: { ...m.data },
        headerValues: slideHeaderSnapshotToUpsertValues(m.slideHeaderValues),
      }));

      const sourceCells = sourceClipboard?.sourceCellIds ?? [];
      const targetCells = result.mappings.map(m => m.targetCellId);
      const crossBox = sourceClipboard?.sourceBoxId && sourceClipboard.sourceBoxId !== boxId;

      const actionContext: HistoryActionContext | undefined = sourceClipboard ? {
        actionType: sourceClipboard.operation === 'cut' ? 'cut' : 'copy',
        sourceCells,
        targetCells,
        relatedBoxId: crossBox ? sourceClipboard.sourceBoxId : undefined,
        relatedBoxName: crossBox ? sourceClipboard.sourceBoxName : undefined,
      } : undefined;

      clearClipboard();
      setSelectedCells(new Set());

      if (cellsToUpsert.length > 0) {
        await upsertSlideMutation.mutateAsync({
          cells: cellsToUpsert,
          teamMemberId: teamMember?.id,
          actionContext,
        });
      }

      if (sourceClipboard?.operation === 'cut') {
        if (crossBox && sourceClipboard.sourceBoxId) {
          const cellsToDelete = [...sourceClipboard.sourceCellIds];
          if (cellsToDelete.length > 0) {
            try {
              await locationCellService.deleteMultipleCells(sourceClipboard.sourceBoxId, cellsToDelete, teamMember?.id, true);
              queryClient.invalidateQueries({ queryKey: ['cells', sourceClipboard.sourceBoxId] });
              queryClient.invalidateQueries({ queryKey: ['slideValues', sourceClipboard.sourceBoxId] });
              queryClient.invalidateQueries({ queryKey: ['history', sourceClipboard.sourceBoxId] });
              queryClient.invalidateQueries({ queryKey: ['boxes'] });
            } catch (err) {
              console.error('Failed to delete source cells in cross-box cut:', err);
              setToast({ message: 'Cells pasted but could not remove from source box. Please check manually.', type: 'warning' });
            }
          }
          if (teamMember?.id) {
            try {
              await historyService.logHistoryEntry(
                sourceClipboard.sourceBoxId, teamMember.id, 'cut', sourceCells,
                undefined, sourceCells, targetCells, boxId, boxName
              );
            } catch (err) {
              console.error('Failed to log source box history:', err);
            }
          }
        } else {
          const targetIds = new Set(result.mappings.map(m => m.targetCellId));
          const cellsToDelete = sourceClipboard.sourceCellIds.filter(id => !targetIds.has(id));
          if (cellsToDelete.length > 0) {
            await deleteCellsMutation.mutateAsync({
              cellIds: cellsToDelete,
              teamMemberId: teamMember?.id,
              skipHistory: true,
            });
          }
        }
      } else if (sourceClipboard?.operation === 'copy' && crossBox && sourceClipboard.sourceBoxId && teamMember?.id) {
        try {
          await historyService.logHistoryEntry(
            sourceClipboard.sourceBoxId, teamMember.id, 'copy', sourceCells,
            undefined, sourceCells, targetCells, boxId, boxName
          );
        } catch (err) {
          console.error('Failed to log source box history:', err);
        }
      }
    } catch (error) {
      console.error('Failed to paste cells:', error);
    }
  }, [upsertSlideMutation, deleteCellsMutation, teamMember, clearClipboard, slideHeaderSnapshotToUpsertValues, boxId, boxName]);

  const executeMove = useCallback(async (result: SwapResult) => {
    try {
      const crossBox = moveStagedBoxId && moveStagedBoxId !== boxId;
      const sourceCells = result.sourceCellIds;
      const targetCells = result.pasteToTarget.map(m => m.targetCellId);
      const isSwap = result.moveToSource.length > 0;
      const actionType = isSwap ? 'swap' as const : 'move' as const;

      const targetUpserts = result.pasteToTarget.map(m => ({
        cellId: m.targetCellId,
        data: { ...m.data },
        headerValues: slideHeaderSnapshotToUpsertValues(m.slideHeaderValues),
      }));
      const sourceSwapUpserts = result.moveToSource.map(m => ({
        cellId: m.targetCellId,
        data: { ...m.data },
      }));

      clearMoveStaged();
      setSelectedCells(new Set());

      if (crossBox && moveStagedBoxId) {
        const targetActionCtx: HistoryActionContext = {
          actionType, sourceCells, targetCells,
          relatedBoxId: moveStagedBoxId, relatedBoxName: moveStagedBoxName || undefined,
        };
        if (targetUpserts.length > 0) {
          await upsertSlideMutation.mutateAsync({
            cells: targetUpserts,
            teamMemberId: teamMember?.id,
            actionContext: targetActionCtx,
          });
        }

        if (sourceSwapUpserts.length > 0) {
          try {
            await locationCellService.upsertMultipleCells(moveStagedBoxId, sourceSwapUpserts, teamMember?.id, {
              actionType, sourceCells, targetCells,
              relatedBoxId: boxId, relatedBoxName: boxName,
            });
          } catch (err) {
            console.error('Failed to upsert swap cells to source box:', err);
            setToast({ message: 'Move completed but swap data could not be written to source box.', type: 'warning' });
          }
        }

        const sourceWriteBackIds = new Set(sourceSwapUpserts.map(m => m.cellId));
        const cellsToDelete = sourceCells.filter(id => !sourceWriteBackIds.has(id));
        if (cellsToDelete.length > 0) {
          try {
            await locationCellService.deleteMultipleCells(moveStagedBoxId, cellsToDelete, teamMember?.id, true);
          } catch (err) {
            console.error('Failed to delete source cells in cross-box move:', err);
            setToast({ message: 'Cells moved but could not remove from source box. Please check manually.', type: 'warning' });
          }
        }

        queryClient.invalidateQueries({ queryKey: ['cells', moveStagedBoxId] });
        queryClient.invalidateQueries({ queryKey: ['slideValues', moveStagedBoxId] });
        queryClient.invalidateQueries({ queryKey: ['history', moveStagedBoxId] });
        queryClient.invalidateQueries({ queryKey: ['boxes'] });

        if (teamMember?.id && !isSwap) {
          try {
            await historyService.logHistoryEntry(
              moveStagedBoxId, teamMember.id, 'move', sourceCells,
              undefined, sourceCells, targetCells, boxId, boxName
            );
          } catch (err) {
            console.error('Failed to log source box move history:', err);
          }
        }
      } else {
        const allUpserts = [
          ...targetUpserts,
          ...result.moveToSource.map(m => ({
            cellId: m.targetCellId,
            data: { ...m.data },
            headerValues: slideHeaderSnapshotToUpsertValues(m.slideHeaderValues),
          })),
        ];
        const actionContext: HistoryActionContext = { actionType, sourceCells, targetCells };

        if (allUpserts.length > 0) {
          await upsertSlideMutation.mutateAsync({
            cells: allUpserts,
            teamMemberId: teamMember?.id,
            actionContext,
          });
        }

        const targetIds = new Set([...targetCells, ...result.moveToSource.map(m => m.targetCellId)]);
        const cellsToDelete = sourceCells.filter(id => !targetIds.has(id));
        if (cellsToDelete.length > 0) {
          await deleteCellsMutation.mutateAsync({
            cellIds: cellsToDelete,
            teamMemberId: teamMember?.id,
            skipHistory: true,
          });
        }
      }
    } catch (error) {
      console.error('Failed to move cells:', error);
    }
  }, [upsertSlideMutation, deleteCellsMutation, teamMember, clearMoveStaged, slideHeaderSnapshotToUpsertValues, boxId, boxName, moveStagedBoxId, moveStagedBoxName]);

  const handlePaste = useCallback(() => {
    if (!contextMenu || !rows || !columns || !clipboard) return;
    if (!canPasteIntoBox('slide')) {
      setToast({ message: 'Cannot paste between different box types.', type: 'warning' });
      return;
    }
    const result = getPastePreview(contextMenu.anchorCellId, cellData, rows, columns);
    if (!result || result.mappings.length === 0) return;

    const clipboardRef = { operation: clipboard.operation, sourceCellIds: [...clipboard.sourceCellIds], sourceBoxId: clipboard.sourceBoxId, sourceBoxName: clipboard.sourceBoxName };
    if (result.conflicts.length > 0) {
      setPendingConfirm({ operation: 'paste', pasteResult: result, clipboardRef });
    } else {
      executePaste(result, clipboardRef);
    }
  }, [contextMenu, rows, columns, clipboard, getPastePreview, cellData, executePaste, canPasteIntoBox]);

  const handleMoveStage = useCallback(() => {
    if (selectedCells.size === 0) return;
    stageForMove(selectedCells, cellData, boxSource, slideValues, true);
    setSelectedCells(new Set());
  }, [selectedCells, cellData, slideValues, stageForMove, boxSource]);

  const handleMoveExecute = useCallback(() => {
    if (!contextMenu || !rows || !columns) return;
    if (!canMoveIntoBox('slide')) {
      setToast({ message: 'Cannot move between different box types.', type: 'warning' });
      return;
    }
    const result = getMovePreview(contextMenu.anchorCellId, cellData, rows, columns, slideValues);
    if (!result || result.pasteToTarget.length === 0) return;
    executeMove(result);
  }, [contextMenu, rows, columns, getMovePreview, cellData, slideValues, executeMove, canMoveIntoBox]);

  const handleCancelMove = useCallback(() => {
    clearMoveStaged();
  }, [clearMoveStaged]);

  const handleKeyboardPaste = useCallback(() => {
    const anchorCellId = hoveredCellRef.current;
    if (!anchorCellId || !rows || !columns || !clipboard) return;
    if (!canPasteIntoBox('slide')) {
      setToast({ message: 'Cannot paste between different box types.', type: 'warning' });
      return;
    }
    const result = getPastePreview(anchorCellId, cellData, rows, columns);
    if (!result || result.mappings.length === 0) return;

    const clipboardRef = { operation: clipboard.operation, sourceCellIds: [...clipboard.sourceCellIds], sourceBoxId: clipboard.sourceBoxId, sourceBoxName: clipboard.sourceBoxName };
    if (result.conflicts.length > 0) {
      setPendingConfirm({ operation: 'paste', pasteResult: result, clipboardRef });
    } else {
      executePaste(result, clipboardRef);
    }
  }, [rows, columns, clipboard, getPastePreview, cellData, executePaste, canPasteIntoBox]);

  const handleKeyboardMoveExecute = useCallback(() => {
    const anchorCellId = hoveredCellRef.current;
    if (!anchorCellId || !rows || !columns) return;
    if (!canMoveIntoBox('slide')) {
      setToast({ message: 'Cannot move between different box types.', type: 'warning' });
      return;
    }
    const result = getMovePreview(anchorCellId, cellData, rows, columns, slideValues);
    if (!result || result.pasteToTarget.length === 0) return;
    executeMove(result);
  }, [rows, columns, getMovePreview, cellData, slideValues, executeMove, canMoveIntoBox]);

  const handleKeyboardApply = useCallback(() => {
    if (selectedCells.size === 0) return;
    const { headerValues, color, activeFields } = formDataRef.current;
    handleApply(headerValues, color, activeFields);
  }, [selectedCells.size, handleApply]);

  const handleConfirmAction = useCallback(() => {
    if (!pendingConfirm) return;

    if (pendingConfirm.operation === 'paste' && pendingConfirm.pasteResult) {
      executePaste(pendingConfirm.pasteResult, pendingConfirm.clipboardRef);
    } else if (pendingConfirm.operation === 'swap' && pendingConfirm.swapResult) {
      executeMove(pendingConfirm.swapResult);
    }

    setPendingConfirm(null);
  }, [pendingConfirm, executePaste, executeMove]);

  const handleCancelConfirm = useCallback(() => {
    setPendingConfirm(null);
  }, []);

  const handleColorSelect = useCallback(async (color: string | null) => {
    if (selectedCells.size === 0) return;
    try {
      const cellsToUpdate = Array.from(selectedCells).map((cellId) => {
        const existing = cellData[cellId];
        const existingValues = slideValues[cellId] || {};
        const hv: Array<{ headerId: string; value: string }> = headers.map(h => ({
          headerId: h.id,
          value: existingValues[h.display_order] || '',
        }));
        return {
          cellId,
          data: {
            name: existing?.name ?? '',
            information: existing?.information ?? '',
            date: existing?.date ?? null,
            date_type: existing?.date_type ?? 'none' as const,
            color,
            slide_image_url: existing?.slide_image_url ?? null,
          },
          headerValues: hv,
        };
      });
      setSelectedCells(new Set());
      await upsertSlideMutation.mutateAsync({
        cells: cellsToUpdate,
        teamMemberId: teamMember?.id,
      });
    } catch (error) {
      console.error('Failed to apply color:', error);
    }
  }, [selectedCells, cellData, slideValues, headers, upsertSlideMutation, teamMember]);

  useKeyboardShortcuts({
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: handleKeyboardPaste,
    onDelete: handleClear,
    onApply: handleKeyboardApply,
    onCross: handleCross,
    onMoveStage: handleMoveStage,
    onMoveExecute: handleKeyboardMoveExecute,
    hasSelection: selectedCells.size > 0 && Array.from(selectedCells).some(id => cellData[id]),
    hasClipboard: hasClipboard,
    hasNonEmptyCells: hasNonEmptyCells,
    hasMoveStaged: hasMoveStaged,
    hasSelectedCells: selectedCells.size > 0,
    disabled: !!pendingConfirm || !!contextMenu || !!detailCellId || showHistoryModal,
  });

  if (isLoading) {
    return (
      <div className="flex-1 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading slide box...</p>
        </div>
      </div>
    );
  }

  const showMultiColumn = showAllColumns && columns > 1;

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 flex-shrink-0 relative z-20" onClick={stopPropagation}>
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                onMouseEnter={handlePrefetchWorkspace}
                onFocus={handlePrefetchWorkspace}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors group"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600 group-hover:text-gray-900 transition-colors" />
              </button>
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}40 100%)` }}
                >
                  <Layers className="h-6 w-6" style={{ color: accentColor }} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{boxName}</h1>
                  {box?.description && <p className="text-sm text-gray-600">{box.description}</p>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLabelView(true)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                title="View box label"
              >
                <QrCode className="h-4 w-4" />
              </button>
              {columns > 1 && (
                <button
                  onClick={() => handleToggleAllColumns(!showAllColumns)}
                  className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    showAllColumns
                      ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-500'
                  }`}
                  title={showAllColumns ? 'Showing all columns side by side' : 'Showing one column at a time'}
                >
                  <Columns3
                    size={13}
                    className="transition-all duration-300"
                  />
                  <span className="hidden sm:inline">{showAllColumns ? 'All' : 'Single'}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                      showAllColumns ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  />
                </button>
              )}
              <button
                onClick={() => setShowHistoryModal(true)}
                className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-500"
                title="View change history"
              >
                <History size={14} />
                <span className="hidden sm:inline">History</span>
              </button>
              <div className="relative">
                <button
                  ref={fontSizeButtonRef}
                  onClick={() => setShowFontSizePopover(prev => !prev)}
                  className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    showFontSizePopover
                      ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-500'
                  }`}
                  title="Adjust grid font size"
                >
                  <ALargeSmall size={14} />
                  <span className="hidden sm:inline">Font</span>
                </button>
                {showFontSizePopover && (
                  <div
                    id="slide-font-popover"
                    className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl border border-gray-200 shadow-lg p-4 w-56"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Grid Font Size</span>
                      <button
                        onClick={handleResetSlideFontDivisor}
                        disabled={localSlideFontDivisor === 10}
                        className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                          localSlideFontDivisor === 10
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <RotateCcw size={12} />
                        Reset
                      </button>
                    </div>
                    <input
                      type="range"
                      min={3}
                      max={20}
                      value={23 - localSlideFontDivisor}
                      onChange={(e) => handleSlideFontDivisorChange(23 - Number(e.target.value))}
                      onMouseUp={() => handleSlideFontDivisorSave(localSlideFontDivisor)}
                      onTouchEnd={() => handleSlideFontDivisorSave(localSlideFontDivisor)}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                      <span>Small</span>
                      <span>Large</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-white" onClick={handleBackgroundClick}>
        <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3" onClick={stopPropagation}>
              {hasMoveStaged && isCrossBoxMove(boxId) && canMoveIntoBox('slide') && (
                <div className="mb-3 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                  <span className="text-sm text-amber-700">
                    Moving {moveStagedCellIds.size} cell{moveStagedCellIds.size !== 1 ? 's' : ''} from <span className="font-semibold">{moveStagedBoxName}</span>
                  </span>
                  <button onClick={clearMoveStaged} className="text-xs text-amber-600 hover:text-amber-800 font-medium">Cancel</button>
                </div>
              )}
              {showMultiColumn ? (
                <div className="pt-3">
                  <MultiColumnSlideGrid
                    selectedCells={selectedCells}
                    onCellSelection={handleCellSelection}
                    cellData={cellData}
                    slideValues={slideValues}
                    headers={headers}
                    sortedHeaders={sortedHeaders}
                    rows={rows}
                    columns={columns}
                    accentColor={accentColor}
                    onOpenSlideDetails={handleOpenSlideDetails}
                    onGridContextMenu={handleGridContextMenu}
                    onHoveredCellChange={handleHoveredCellChange}
                    moveStagedCells={isCrossBoxMove(boxId) ? new Set<string>() : moveStagedCellIds}
                    clipboardCells={clipboard?.sourceBoxId !== boxId ? new Set<string>() : clipboardCellIds}
                    clipboardOperation={clipboard?.sourceBoxId !== boxId ? null : clipboardOperation}
                    slideFontDivisor={localSlideFontDivisor}
                  />
                </div>
              ) : (
                <div ref={singleColumnRef} className="overflow-x-hidden">
                  {columns > 1 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleColumnChange('prev')}
                          disabled={activeColumnIndex === 0}
                          className={`p-2 rounded-xl transition-colors ${
                            activeColumnIndex === 0
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          <ChevronLeft size={20} />
                        </button>

                        <div className="flex items-center gap-3 flex-1">
                          <div className="h-px flex-1 bg-gray-200" />
                          <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            Column {activeColumn} (1-{rows})
                          </span>
                          <div className="h-px flex-1 bg-gray-200" />
                        </div>

                        <button
                          onClick={() => handleColumnChange('next')}
                          disabled={activeColumnIndex === columns - 1}
                          className={`p-2 rounded-xl transition-colors ${
                            activeColumnIndex === columns - 1
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </div>
                  )}

                  {(() => {
                    const ss = singleScaleFactor;
                    const isScaled = ss < 1;
                    const headerPl = scaled(10, ss) + scaled(48, ss) + scaled(12, ss);
                    const headerGap = scaled(12, ss);
                    const headerTrailer = scaled(30, ss);
                    const headerPr = scaled(10, ss);
                    const headerFontSize = scaled(11, ss);
                    const headerPy = scaled(8, ss);

                    return (
                      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
                        <div
                          className="flex items-center"
                          style={isScaled
                            ? { paddingLeft: headerPl, paddingRight: headerPr, gap: headerGap }
                            : { paddingLeft: 70, paddingRight: 10, gap: 12 }
                          }
                        >
                          {sortedHeaders.map((header) => (
                            <div
                              key={header.id}
                              className="flex-1 min-w-0 font-semibold text-gray-400 uppercase tracking-wider text-center truncate"
                              style={isScaled
                                ? { paddingTop: headerPy, paddingBottom: headerPy, fontSize: headerFontSize }
                                : { padding: '8px 0', fontSize: 11 }
                              }
                            >
                              {header.header_text || `Header ${header.display_order + 1}`}
                            </div>
                          ))}
                          <div
                            className="flex-shrink-0"
                            style={{ width: isScaled ? headerTrailer : 30 }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-3">
                    <SlideGrid
                      selectedCells={selectedCells}
                      onCellSelection={handleCellSelection}
                      cellData={cellData}
                      slideValues={slideValues}
                      headers={headers}
                      sortedHeaders={sortedHeaders}
                      rows={rows}
                      activeColumn={activeColumn}
                      accentColor={accentColor}
                      onOpenSlideDetails={handleOpenSlideDetails}
                      scaleFactor={singleScaleFactor}
                      onGridContextMenu={handleGridContextMenu}
                      onHoveredCellChange={handleHoveredCellChange}
                      moveStagedCells={isCrossBoxMove(boxId) ? new Set<string>() : moveStagedCellIds}
                      clipboardCells={clipboard?.sourceBoxId !== boxId ? new Set<string>() : clipboardCellIds}
                      clipboardOperation={clipboard?.sourceBoxId !== boxId ? null : clipboardOperation}
                      slideFontDivisor={localSlideFontDivisor}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-1 self-start lg:sticky lg:top-4" onMouseDown={stopPropagation} onMouseUp={stopPropagation} onClick={stopPropagation}>
              <SlideInputSection
                selectedCells={selectedCells}
                onApply={handleApply}
                onClear={handleClear}
                onCross={handleCross}
                partialMatch={partialMatch}
                hasNonEmptyCells={hasNonEmptyCells}
                headers={headers}
                onFormDataChange={handleFormDataChange}
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>

        {contextMenu && !readOnly && (
          <GridContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            hasSelection={selectedCells.size > 0 && Array.from(selectedCells).some(id => cellData[id])}
            hasSelectionAny={selectedCells.size > 0}
            hasClipboard={hasClipboard}
            hasMoveStaged={hasMoveStaged}
            canPaste={canPasteIntoBox('slide')}
            canMove={canMoveIntoBox('slide')}
            onCopy={handleCopy}
            onCut={handleCut}
            onPaste={handlePaste}
            onMoveStage={handleMoveStage}
            onMoveExecute={handleMoveExecute}
            onCancelMove={handleCancelMove}
            onDelete={handleClear}
            onCross={handleCross}
            hasNonEmptyCells={hasNonEmptyCells}
            onColorSelect={handleColorSelect}
            onClose={handleCloseContextMenu}
          />
        )}

        {pendingConfirm && (
          <PasteConfirmModal
            operation={pendingConfirm.operation}
            conflictCells={
              pendingConfirm.operation === 'paste'
                ? pendingConfirm.pasteResult?.conflicts ?? []
                : pendingConfirm.swapResult?.conflicts ?? []
            }
            onConfirm={handleConfirmAction}
            onCancel={handleCancelConfirm}
          />
        )}
      </main>

      {showHistoryModal && (
        <SlideHistoryModal
          boxId={boxId}
          boxName={boxName}
          accentColor={accentColor}
          locationId={locationId}
          onClose={() => setShowHistoryModal(false)}
          readOnly={readOnly}
        />
      )}

      {detailCellId && (
        <SlideDetailModal
          cellId={detailCellId}
          boxId={boxId}
          boxName={boxName}
          accentColor={accentColor}
          cellData={cellData[detailCellId] || { name: '', information: '', date: null, color: null, date_type: 'none' }}
          slideValues={slideValues}
          sortedHeaders={sortedHeaders}
          onClose={() => setDetailCellId(null)}
          onSave={handleSlideDetailSave}
          onImageUpdated={handleImageUpdated}
        />
      )}

      {showLabelView && box && (
        <BoxLabelViewModal
          boxId={box.id}
          boxName={box.name}
          boxDescription={box.description || ''}
          boxRows={box.rows}
          boxColumns={box.columns}
          onClose={() => setShowLabelView(false)}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default SlideBoxView;
