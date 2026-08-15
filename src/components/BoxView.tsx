import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Package, QrCode } from 'lucide-react';
import LocationGrid from './LocationGrid';
import InputSection from './InputSection';
import ContentSummary from './ContentSummary';
import GridSettings from './GridSettings';
import ChangeHistory from './ChangeHistory';
import GridContextMenu from './GridContextMenu';
import PasteConfirmModal from './PasteConfirmModal';
import Toast from './Toast';
import { CellData, locationCellService } from '../services/locationCellService';
import { historyService } from '../services/historyService';
import { useBoxData, useUpsertCells, useDeleteCells, useCrossCells } from '../hooks/useBoxData';
import { getBoxesQueryKey, getItemsQueryKey, useUpdateBox } from '../hooks/useWorkspaceData';
import { useAuth } from '../contexts/AuthContext';
import { detectCommonCellData, computeAutoColorMap, computeGroupedLayout, ColorByField, GroupingMethod, PartialCellMatch, FieldMatchStatus } from '../utils/cellDataUtils';
import { useGridClipboard } from '../hooks/useGridClipboard';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { PasteResult, SwapResult } from '../utils/clipboardUtils';
import type { HistoryActionContext, GridItemLinkType } from '../types/database';
import type { SequentialRef } from '../utils/sequentialNamingUtils';
import { useBoxItemLinks, useCreateBoxItemLink, useDeleteBoxItemLink, useSyncBoxLinks } from '../hooks/useBoxItemLinks';
import { itemService, InventoryItem } from '../services/itemService';
import SelectFolderForLinkModal from './SelectFolderForLinkModal';
import BoxLabelViewModal from './BoxLabelViewModal';
import SelectItemForGridModal from './SelectItemForGridModal';
import CreateItemModal from './CreateItemModal';
import { useItemFolderHeaders } from '../hooks/useItemFolderData';
import { computeSelectionLinkState } from '../utils/linkMatchUtils';
import { useBoxAccessLevel } from '../hooks/useBoxPrivacy';
import { useSyncContext } from '../contexts/SyncContext';

interface BoxViewProps {
  boxId: string;
  boxName: string;
  boxAccentColor?: string | null;
  locationId: string;
  onBack: () => void;
  highlightCellId?: string;
  onNavigateToItem?: (locationId: string, sublocationId: string | null, positionId: string | null, folderId: string, itemId: string) => void;
}

const BoxView: React.FC<BoxViewProps> = ({ boxId, boxName, boxAccentColor, locationId, onBack, highlightCellId, onNavigateToItem }) => {
  const accentColor = boxAccentColor || '#3b82f6';
  const queryClient = useQueryClient();
  const { teamMember } = useAuth();
  const accessLevel = useBoxAccessLevel(boxId);
  const readOnly = accessLevel === 'view' || accessLevel === 'none';

  const { box, cellData, isLoading } = useBoxData(boxId);
  const upsertCellsMutation = useUpsertCells(boxId, locationId);
  const deleteCellsMutation = useDeleteCells(boxId, locationId);
  const crossCellsMutation = useCrossCells(boxId, locationId);
  const updateBoxMutation = useUpdateBox(locationId);

  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [partialMatch, setPartialMatch] = useState<PartialCellMatch | null>(null);
  const [gridSize, setGridSize] = useState<{ width: number; height: number } | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [localNameFontDivisor, setLocalNameFontDivisor] = useState(10);
  const [localInfoFontDivisor, setLocalInfoFontDivisor] = useState(12);
  const [isApplyingColors, setIsApplyingColors] = useState(false);
  const [isApplyingGroups, setIsApplyingGroups] = useState(false);
  const [constrainGridHeight, setConstrainGridHeight] = useState(true);
  const hoveredCellRef = useRef<string | null>(null);
  const formDataRef = useRef<{ data: CellData; activeFields: FieldMatchStatus }>({
    data: { name: '', information: '', date: null, color: null, date_type: 'none' },
    activeFields: { name: true, information: true, date: true, color: true, dateType: true },
  });
  const sequentialRef = useRef<SequentialRef>({ active: false, getNamesMap: () => undefined, infoActive: false, getInfoMap: () => undefined });

  const {
    clipboard, hasClipboard, clipboardCellIds, clipboardOperation,
    copyToClipboard, cutToClipboard, getPastePreview, clearClipboard,
    hasMoveStaged, moveStagedCellIds, stageForMove, getMovePreview, clearMoveStaged,
    canPasteIntoBox, canMoveIntoBox, isCrossBoxMove,
    sourceBoxId, sourceBoxName, moveStagedBoxId, moveStagedBoxName,
  } = useGridClipboard();

  const boxSource = useMemo(() => ({ boxId, boxType: 'freezer' as const, boxName }), [boxId, boxName]);

  const { data: boxLinks = [] } = useBoxItemLinks(boxId);
  const createLinkMutation = useCreateBoxItemLink(boxId);
  const deleteLinkMutation = useDeleteBoxItemLink(boxId);
  const syncLinksMutation = useSyncBoxLinks(boxId);

  const [addAsItemState, setAddAsItemState] = useState<{
    step: 'folder' | 'item';
    name: string;
    info: string | null;
    linkType: GridItemLinkType;
    count: number;
    folderId?: string;
    date?: string | null;
    dateType?: string;
  } | null>(null);

  const { data: linkFolderHeaders = [] } = useItemFolderHeaders(addAsItemState?.folderId || null);

  const [applyItemModalOpen, setApplyItemModalOpen] = useState(false);
  const [showLabelView, setShowLabelView] = useState(false);

  const { allSelectedEmpty, singleLinkedItemId } = useMemo(
    () => computeSelectionLinkState(selectedCells, cellData, boxLinks),
    [selectedCells, cellData, boxLinks]
  );

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; anchorCellId: string } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    operation: 'paste' | 'swap';
    pasteResult?: PasteResult;
    swapResult?: SwapResult;
    clipboardRef?: { operation: 'copy' | 'cut'; sourceCellIds: string[]; sourceBoxId?: string; sourceBoxName?: string };
  } | null>(null);

  const rows = box?.rows;
  const columns = box?.columns;
  const { rotateWideGridMobile } = useSyncContext();
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth < 1024);
  const [rotateGrid, setRotateGrid] = useState(false);
  const rotateAutoTriggeredRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (rotateAutoTriggeredRef.current) return;
    if (rotateWideGridMobile && isMobileView && !!rows && !!columns && columns > rows) {
      setRotateGrid(true);
      rotateAutoTriggeredRef.current = true;
    }
  }, [rotateWideGridMobile, isMobileView, rows, columns]);

  const gridAspectRatio = rows && columns
    ? rotateGrid
      ? (rows + 0.5) / (columns + 0.5)
      : (columns + 0.5) / (rows + 0.5)
    : 1;

  useEffect(() => {
    const match = detectCommonCellData(selectedCells, cellData);
    setPartialMatch(match.hasAnyData ? match : null);
  }, [selectedCells, cellData]);

  useEffect(() => {
    if (box) {
      setLocalNameFontDivisor(box.name_font_divisor ?? 10);
      setLocalInfoFontDivisor(box.info_font_divisor ?? 12);
      setConstrainGridHeight(box.constrain_grid_height ?? true);
    }
  }, [box]);

  const highlightAppliedRef = useRef(false);
  useEffect(() => {
    if (highlightCellId && box && !highlightAppliedRef.current) {
      highlightAppliedRef.current = true;
      setSelectedCells(new Set([highlightCellId]));
    }
  }, [highlightCellId, box]);

  const calculateGridSize = useCallback(() => {
    if (!gridContainerRef.current) return false;

    const container = gridContainerRef.current;
    const availableWidth = container.offsetWidth;

    if (availableWidth <= 0) return false;

    let width = availableWidth;
    let height = width / gridAspectRatio;

    if (constrainGridHeight) {
      const maxHeight = window.innerHeight * 0.8;
      if (height > maxHeight) {
        height = maxHeight;
        width = height * gridAspectRatio;
      }
    }

    setGridSize({ width, height });
    return true;
  }, [gridAspectRatio, constrainGridHeight]);

  useLayoutEffect(() => {
    if (!box) return;
    calculateGridSize();
  }, [box, calculateGridSize]);

  useEffect(() => {
    if (!box) return;

    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

    if (!gridSize) {
      const attemptCalculation = (retryCount = 0) => {
        const success = calculateGridSize();
        if (!success && retryCount < 10) {
          retryTimeoutId = setTimeout(() => {
            requestAnimationFrame(() => attemptCalculation(retryCount + 1));
          }, 50);
        }
      };
      requestAnimationFrame(() => attemptCalculation());
    }

    const resizeObserver = new ResizeObserver(() => {
      calculateGridSize();
    });
    if (gridContainerRef.current) {
      resizeObserver.observe(gridContainerRef.current);
    }

    window.addEventListener('resize', calculateGridSize);

    return () => {
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculateGridSize);
    };
  }, [box, calculateGridSize, gridSize]);

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
    async (data: CellData, activeFields?: FieldMatchStatus, sequentialNames?: Record<string, string>, sequentialInfo?: Record<string, string>) => {
      try {
        const fields = activeFields || { name: true, information: true, date: true, color: true, dateType: true };
        const cellsToUpdate = Array.from(selectedCells).map((cellId) => {
          const existing = cellData[cellId];
          const seqName = sequentialNames?.[cellId];
          const seqInfo = sequentialInfo?.[cellId];
          const merged: CellData = {
            name: seqName !== undefined ? seqName : (fields.name ? data.name : (existing?.name ?? '')),
            information: seqInfo !== undefined ? seqInfo : (fields.information ? data.information : (existing?.information ?? '')),
            date: fields.date ? data.date : (existing?.date ?? null),
            color: fields.color ? data.color : (existing?.color ?? null),
            date_type: fields.dateType ? data.date_type : (existing?.date_type ?? 'date'),
          };
          return { cellId, data: merged };
        });

        setSelectedCells(new Set());
        await upsertCellsMutation.mutateAsync({
          cells: cellsToUpdate,
          teamMemberId: teamMember?.id,
        });
      } catch (error) {
        console.error('Failed to apply cell data:', error);
      }
    },
    [selectedCells, cellData, upsertCellsMutation, teamMember]
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
      console.error('Failed to clear cell data:', error);
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
      console.error('Failed to cross cell data:', error);
    }
  }, [selectedCells, cellData, crossCellsMutation, teamMember]);

  const handleFontSettingsChange = useCallback((nameDivisor: number, infoDivisor: number) => {
    setLocalNameFontDivisor(nameDivisor);
    setLocalInfoFontDivisor(infoDivisor);
  }, []);

  const handleConstrainGridHeightChange = useCallback(async (value: boolean) => {
    setConstrainGridHeight(value);
    try {
      await updateBoxMutation.mutateAsync({
        boxId,
        data: { constrain_grid_height: value },
      });
    } catch (error) {
      console.error('Failed to save grid height setting:', error);
    }
  }, [boxId, updateBoxMutation]);

  const handleFontSettingsSave = useCallback(async (nameDivisor: number, infoDivisor: number) => {
    try {
      await updateBoxMutation.mutateAsync({
        boxId,
        data: {
          name_font_divisor: nameDivisor,
          info_font_divisor: infoDivisor
        }
      });
    } catch (error) {
      console.error('Failed to save font settings:', error);
    }
  }, [boxId, updateBoxMutation]);

  const hasNonEmptyCells = useMemo(() => {
    return Array.from(selectedCells).some(cellId => cellData[cellId]);
  }, [selectedCells, cellData]);

  const handleGridContextMenu = useCallback((cellId: string, x: number, y: number) => {
    setContextMenu({ x, y, anchorCellId: cellId });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopy = useCallback(() => {
    if (selectedCells.size === 0) return;
    copyToClipboard(selectedCells, cellData, boxSource);
  }, [selectedCells, cellData, copyToClipboard, boxSource]);

  const handleCut = useCallback(() => {
    if (selectedCells.size === 0) return;
    cutToClipboard(selectedCells, cellData, boxSource);
  }, [selectedCells, cellData, cutToClipboard, boxSource]);

  const handleHoveredCellChange = useCallback((cellId: string | null) => {
    hoveredCellRef.current = cellId;
  }, []);

  const handleFormDataChange = useCallback((data: CellData, activeFields: FieldMatchStatus) => {
    formDataRef.current = { data, activeFields };
  }, []);

  const executePaste = useCallback(async (result: PasteResult, sourceClipboard?: { operation: 'copy' | 'cut'; sourceCellIds: string[]; sourceBoxId?: string; sourceBoxName?: string }) => {
    try {
      const cellsToUpsert = result.mappings.map(m => ({
        cellId: m.targetCellId,
        data: { ...m.data },
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
        await upsertCellsMutation.mutateAsync({
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
  }, [upsertCellsMutation, deleteCellsMutation, teamMember, clearClipboard, boxId, boxName]);

  const executeMove = useCallback(async (result: SwapResult) => {
    try {
      const crossBox = moveStagedBoxId && moveStagedBoxId !== boxId;
      const sourceCells = result.sourceCellIds;
      const targetCells = result.pasteToTarget.map(m => m.targetCellId);
      const isSwap = result.moveToSource.length > 0;
      const actionType = isSwap ? 'swap' as const : 'move' as const;

      const targetUpserts = result.pasteToTarget.map(m => ({ cellId: m.targetCellId, data: { ...m.data } }));
      const sourceSwapUpserts = result.moveToSource.map(m => ({ cellId: m.targetCellId, data: { ...m.data } }));

      clearMoveStaged();
      setSelectedCells(new Set());

      if (crossBox && moveStagedBoxId) {
        const targetActionCtx: HistoryActionContext = {
          actionType, sourceCells, targetCells,
          relatedBoxId: moveStagedBoxId, relatedBoxName: moveStagedBoxName || undefined,
        };
        if (targetUpserts.length > 0) {
          await upsertCellsMutation.mutateAsync({
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
        const allUpserts = [...targetUpserts, ...sourceSwapUpserts];
        const actionContext: HistoryActionContext = { actionType, sourceCells, targetCells };

        if (allUpserts.length > 0) {
          await upsertCellsMutation.mutateAsync({
            cells: allUpserts,
            teamMemberId: teamMember?.id,
            actionContext,
          });
        }

        const targetIds = new Set([...targetCells, ...sourceSwapUpserts.map(m => m.cellId)]);
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
  }, [upsertCellsMutation, deleteCellsMutation, teamMember, clearMoveStaged, boxId, boxName, moveStagedBoxId, moveStagedBoxName]);

  const handlePaste = useCallback(() => {
    if (!contextMenu || !rows || !columns || !clipboard) return;
    if (!canPasteIntoBox('freezer')) {
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
    stageForMove(selectedCells, cellData, boxSource);
    setSelectedCells(new Set());
  }, [selectedCells, cellData, stageForMove, boxSource]);

  const handleMoveExecute = useCallback(() => {
    if (!contextMenu || !rows || !columns) return;
    if (!canMoveIntoBox('freezer')) {
      setToast({ message: 'Cannot move between different box types.', type: 'warning' });
      return;
    }
    const result = getMovePreview(contextMenu.anchorCellId, cellData, rows, columns);
    if (!result || result.pasteToTarget.length === 0) return;

    executeMove(result);
  }, [contextMenu, rows, columns, getMovePreview, cellData, executeMove, canMoveIntoBox]);

  const handleCancelMove = useCallback(() => {
    clearMoveStaged();
  }, [clearMoveStaged]);

  const handleKeyboardPaste = useCallback(() => {
    const anchorCellId = hoveredCellRef.current;
    if (!anchorCellId || !rows || !columns || !clipboard) return;
    if (!canPasteIntoBox('freezer')) {
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
    if (!canMoveIntoBox('freezer')) {
      setToast({ message: 'Cannot move between different box types.', type: 'warning' });
      return;
    }
    const result = getMovePreview(anchorCellId, cellData, rows, columns);
    if (!result || result.pasteToTarget.length === 0) return;
    executeMove(result);
  }, [rows, columns, getMovePreview, cellData, executeMove, canMoveIntoBox]);

  const handleKeyboardApply = useCallback(() => {
    if (selectedCells.size === 0) return;
    const seq = sequentialRef.current;
    handleApply(
      formDataRef.current.data,
      formDataRef.current.activeFields,
      seq.active ? seq.getNamesMap() : undefined,
      seq.infoActive ? seq.getInfoMap() : undefined
    );
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
        return {
          cellId,
          data: {
            name: existing?.name ?? '',
            information: existing?.information ?? '',
            date: existing?.date ?? null,
            date_type: existing?.date_type,
            color,
          },
        };
      });
      setSelectedCells(new Set());
      await upsertCellsMutation.mutateAsync({
        cells: cellsToUpdate,
        teamMemberId: teamMember?.id,
      });
    } catch (error) {
      console.error('Failed to apply color:', error);
    }
  }, [selectedCells, cellData, upsertCellsMutation, teamMember]);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (selectedCells.size > 0) {
      setSelectedCells(new Set());
    }
  }, [selectedCells.size]);

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

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
    disabled: !!pendingConfirm || !!contextMenu,
  });

  const handleAddAsItem = useCallback((name: string, info: string | null, linkType: GridItemLinkType, count: number, date?: string | null, dateType?: string) => {
    setAddAsItemState({ step: 'item', name, info, linkType, count, date, dateType });
  }, []);

  const handleFolderSelected = useCallback((_folderId: string) => {
    // Normal box skips folder selection - items are standalone
  }, []);

  const handleCreateLinkedItem = useCallback(async (
    itemData: Parameters<typeof itemService.createItem>[0] extends infer T ? Omit<T, 'location_id' | 'sublocation_id' | 'position_id' | 'folder_id'> : never,
  ) => {
    if (!box) return;
    try {
      const item = await itemService.createItem({
        ...itemData,
        location_id: box.location_id,
        sublocation_id: box.sublocation_id,
        position_id: box.position_id,
        folder_id: null,
      });
      await createLinkMutation.mutateAsync({
        itemId: item.id,
        linkType: addAsItemState!.linkType,
        linkedName: addAsItemState!.linkType === 'info' ? '' : addAsItemState!.name,
        linkedInfo: (addAsItemState!.linkType === 'name_info' || addAsItemState!.linkType === 'info')
          ? (addAsItemState!.info || '') : null,
        linkedDate: addAsItemState!.date ?? null,
        linkedDateType: addAsItemState!.dateType ?? 'none',
      });
      setAddAsItemState(null);
      setToast({ message: 'Item created and linked to grid', type: 'success' });
    } catch (error) {
      console.error('Failed to create linked item:', error);
      setToast({ message: 'Failed to create linked item', type: 'error' });
    }
  }, [addAsItemState, box, createLinkMutation]);

  const handleUnlink = useCallback(async (linkId: string) => {
    try {
      await deleteLinkMutation.mutateAsync(linkId);
    } catch (error) {
      console.error('Failed to unlink:', error);
    }
  }, [deleteLinkMutation]);

  const handleApplyItemToGrid = useCallback(() => {
    setApplyItemModalOpen(true);
  }, []);

  const handleItemSelectedForGrid = useCallback(async (item: InventoryItem) => {
    setApplyItemModalOpen(false);
    try {
      const hasNote = !!(item.note?.trim());
      const hasDate = !!(item.date && item.date_type && item.date_type !== 'none');
      const linkType: GridItemLinkType = (hasNote || hasDate) ? 'name_info' : 'name';

      const cellsToUpdate = Array.from(selectedCells).map((cellId) => ({
        cellId,
        data: {
          name: item.name,
          information: hasNote ? item.note : '',
          date: hasDate ? item.date : null as string | null,
          color: null as string | null,
          date_type: (hasDate ? item.date_type : 'date') as 'date' | 'expiration' | 'none',
        },
      }));

      setSelectedCells(new Set());
      await upsertCellsMutation.mutateAsync({
        cells: cellsToUpdate,
        teamMemberId: teamMember?.id,
      });

      await createLinkMutation.mutateAsync({
        itemId: item.id,
        linkType,
        linkedName: item.name,
        linkedInfo: hasNote ? item.note : null,
        linkedDate: hasDate ? item.date : null,
        linkedDateType: hasDate ? item.date_type : 'none',
      });

      setToast({ message: 'Item applied and linked to grid', type: 'success' });
    } catch (error) {
      console.error('Failed to apply item to grid:', error);
      setToast({ message: 'Failed to apply item to grid', type: 'error' });
    }
  }, [selectedCells, upsertCellsMutation, createLinkMutation, teamMember]);

  const handleNavigateToLinkedItem = useCallback(async (itemId: string) => {
    if (!onNavigateToItem) return;
    try {
      const item = await itemService.getItemById(itemId);
      if (!item) {
        setToast({ message: 'Linked item not found', type: 'error' });
        return;
      }
      onNavigateToItem(item.location_id, item.sublocation_id, item.position_id, item.folder_id, item.id);
    } catch (error) {
      console.error('Failed to navigate to linked item:', error);
      setToast({ message: 'Failed to navigate to linked item', type: 'error' });
    }
  }, [onNavigateToItem]);

  const handleApplyColorBy = useCallback(async (filters: ColorByField[]) => {
    if (filters.length === 0) return;
    setIsApplyingColors(true);
    try {
      const autoColorMap = computeAutoColorMap(cellData, filters);
      const cellsToUpdate = Object.entries(autoColorMap).map(([cellId, color]) => ({
        cellId,
        data: { ...cellData[cellId], color },
      }));
      if (cellsToUpdate.length === 0) return;
      await upsertCellsMutation.mutateAsync({
        cells: cellsToUpdate,
        teamMemberId: teamMember?.id,
      });
    } catch (error) {
      console.error('Failed to apply color by:', error);
    } finally {
      setIsApplyingColors(false);
    }
  }, [cellData, upsertCellsMutation, teamMember]);

  const handleApplyGroups = useCallback(async (filters: ColorByField[], method: GroupingMethod) => {
    if (filters.length === 0 || !rows || !columns) return;
    setIsApplyingGroups(true);
    try {
      const newLayout = computeGroupedLayout(cellData, filters, rows, columns, method);
      if (newLayout.length === 0) return;

      const newPositions = new Set(newLayout.map(c => c.cellId));
      const oldPositions = new Set(Object.keys(cellData));

      const cellsToUpsert = newLayout.map(({ cellId, data }) => ({
        cellId,
        data: { ...data },
      }));

      if (cellsToUpsert.length > 0) {
        await upsertCellsMutation.mutateAsync({
          cells: cellsToUpsert,
          teamMemberId: teamMember?.id,
        });
      }

      const cellsToDelete = Array.from(oldPositions).filter(id => !newPositions.has(id));
      if (cellsToDelete.length > 0) {
        await deleteCellsMutation.mutateAsync({
          cellIds: cellsToDelete,
          teamMemberId: teamMember?.id,
        });
      }
    } catch (error) {
      console.error('Failed to apply groups:', error);
    } finally {
      setIsApplyingGroups(false);
    }
  }, [cellData, rows, columns, upsertCellsMutation, deleteCellsMutation, teamMember]);

  if (isLoading) {
    return (
      <div className="flex-1 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading box data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 flex-shrink-0" onClick={stopPropagation}>
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
                  <Package className="h-6 w-6" style={{ color: accentColor }} />
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
              <button
                onClick={() => document.getElementById('reagent-inventory')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <ClipboardList className="h-4 w-4" />
                Inventory
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 bg-white" onClick={handleBackgroundClick}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 flex flex-col">
            {hasMoveStaged && isCrossBoxMove(boxId) && canMoveIntoBox('freezer') && (
              <div className="mb-3 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                <span className="text-sm text-amber-700">
                  Moving {moveStagedCellIds.size} cell{moveStagedCellIds.size !== 1 ? 's' : ''} from <span className="font-semibold">{moveStagedBoxName}</span>
                </span>
                <button onClick={clearMoveStaged} className="text-xs text-amber-600 hover:text-amber-800 font-medium">Cancel</button>
              </div>
            )}
            <div
              ref={gridContainerRef}
              className="flex-1 flex items-center justify-center w-full"
              style={!gridSize && rows && columns ? {
                aspectRatio: `${gridAspectRatio}`,
                maxHeight: constrainGridHeight ? '80vh' : undefined,
              } : undefined}
            >
              {gridSize && rows && columns && (
                <div style={{ width: gridSize.width, height: gridSize.height }} onClick={stopPropagation}>
                  <LocationGrid
                    selectedCells={selectedCells}
                    onCellSelection={handleCellSelection}
                    cellData={cellData}
                    rows={rows}
                    columns={columns}
                    nameFontDivisor={localNameFontDivisor}
                    infoFontDivisor={localInfoFontDivisor}
                    onGridContextMenu={handleGridContextMenu}
                    onHoveredCellChange={handleHoveredCellChange}
                    moveStagedCells={isCrossBoxMove(boxId) ? new Set<string>() : moveStagedCellIds}
                    clipboardCells={clipboard?.sourceBoxId !== boxId ? new Set<string>() : clipboardCellIds}
                    clipboardOperation={clipboard?.sourceBoxId !== boxId ? null : clipboardOperation}
                    rotateGrid={rotateGrid}
                    initialGridWidth={gridSize.width}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1" onMouseDown={stopPropagation} onMouseUp={stopPropagation} onClick={stopPropagation}>
            <InputSection
              selectedCells={selectedCells}
              cellData={cellData}
              sequentialRef={sequentialRef}
              onApply={handleApply}
              onClear={handleClear}
              onCross={handleCross}
              partialMatch={partialMatch}
              hasNonEmptyCells={hasNonEmptyCells}
              onFormDataChange={handleFormDataChange}
              canApplyItemToGrid={allSelectedEmpty && selectedCells.size > 0}
              onApplyItemToGrid={handleApplyItemToGrid}
              singleLinkedItemId={singleLinkedItemId}
              onNavigateToLinkedItem={handleNavigateToLinkedItem}
              readOnly={readOnly}
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <GridSettings
              nameFontDivisor={localNameFontDivisor}
              infoFontDivisor={localInfoFontDivisor}
              onChange={handleFontSettingsChange}
              onSave={handleFontSettingsSave}
              isSaving={updateBoxMutation.isPending}
              onApplyColorBy={handleApplyColorBy}
              isApplyingColors={isApplyingColors}
              onApplyGroups={handleApplyGroups}
              isApplyingGroups={isApplyingGroups}
              constrainGridHeight={constrainGridHeight}
              onConstrainGridHeightChange={handleConstrainGridHeightChange}
              rotateGrid={rotateGrid}
              onRotateGridChange={setRotateGrid}
              readOnly={readOnly}
            />
          </div>
          <div className="lg:col-span-1">
            <ChangeHistory boxId={boxId} locationId={locationId} cellData={cellData} rows={rows} columns={columns} readOnly={readOnly} />
          </div>
        </div>

        <ContentSummary
          cellData={cellData}
          links={boxLinks}
          onAddAsItem={readOnly ? undefined : handleAddAsItem}
          onUnlink={readOnly ? undefined : handleUnlink}
          onNavigateToLinkedItem={handleNavigateToLinkedItem}
        />

        {contextMenu && !readOnly && (
          <GridContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            hasSelection={selectedCells.size > 0 && Array.from(selectedCells).some(id => cellData[id])}
            hasSelectionAny={selectedCells.size > 0}
            hasClipboard={hasClipboard}
            hasMoveStaged={hasMoveStaged}
            canPaste={canPasteIntoBox('freezer')}
            canMove={canMoveIntoBox('freezer')}
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

      {addAsItemState?.step === 'item' && (
        <CreateItemModal
          prefillName={addAsItemState.name}
          prefillNote={addAsItemState.linkType === 'name_info' ? (addAsItemState.info || '') : undefined}
          prefillStockNumber={addAsItemState.count}
          prefillDisplayMode={addAsItemState.count === 1 ? 'freeze_thaw' : 'stock'}
          prefillDate={addAsItemState.date ?? null}
          prefillDateType={addAsItemState.dateType ?? 'none'}
          lockStock
          onClose={() => setAddAsItemState(null)}
          onCreate={handleCreateLinkedItem}
        />
      )}

      {applyItemModalOpen && box && (
        <SelectItemForGridModal
          locationId={box.location_id}
          sublocationId={box.sublocation_id}
          positionId={box.position_id}
          existingLinks={boxLinks}
          onSelect={handleItemSelectedForGrid}
          onClose={() => setApplyItemModalOpen(false)}
          mode="standalone"
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

export default BoxView;
