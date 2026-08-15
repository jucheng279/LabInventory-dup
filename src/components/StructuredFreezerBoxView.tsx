import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Grid3x3, QrCode } from 'lucide-react';
import LocationGrid from './LocationGrid';
import StructuredFreezerInputSection from './StructuredFreezerInputSection';
import StructuredCellContent from './StructuredCellContent';
import GridSettings from './GridSettings';
import ChangeHistory from './ChangeHistory';
import GridContextMenu from './GridContextMenu';
import PasteConfirmModal from './PasteConfirmModal';
import StructuredContentSummary from './StructuredContentSummary';
import SelectFolderForLinkModal from './SelectFolderForLinkModal';
import CreateItemModal from './CreateItemModal';
import Toast from './Toast';
import BoxLabelViewModal from './BoxLabelViewModal';
import { CellData, locationCellService } from '../services/locationCellService';
import { historyService } from '../services/historyService';
import { itemService, InventoryItem } from '../services/itemService';
import { itemCustomValueService } from '../services/itemCustomValueService';
import { itemFolderHeaderService } from '../services/itemFolderHeaderService';
import SelectItemForGridModal from './SelectItemForGridModal';
import { computeStructuredSelectionLinkState } from '../utils/linkMatchUtils';
import { boxItemLinkService } from '../services/boxItemLinkService';
import { useSlideBoxData, useUpsertSlideCells, useDeleteSlideCells, useCrossSlideCells } from '../hooks/useSlideBoxData';
import { getBoxesQueryKey, getItemsQueryKey, useUpdateBox } from '../hooks/useWorkspaceData';
import { useBoxItemLinks, useCreateBoxItemLink, useDeleteBoxItemLink } from '../hooks/useBoxItemLinks';
import { useItemFolderHeaders } from '../hooks/useItemFolderData';
import { useAuth } from '../contexts/AuthContext';
import { computeAutoColorMap, computeGroupedLayout, ColorByField, GroupingMethod, StructuredContext } from '../utils/cellDataUtils';
import { detectCommonStructuredData, StructuredPartialMatch, StructuredFieldMatchStatus } from '../utils/structuredDataUtils';
import { useGridClipboard } from '../hooks/useGridClipboard';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { PasteResult, SwapResult, SlideHeaderSnapshot } from '../utils/clipboardUtils';
import type { HistoryActionContext, GridItemLinkType } from '../types/database';
import type { FolderHeaderInput } from '../services/itemFolderHeaderService';
import type { SequentialRef } from '../utils/sequentialNamingUtils';
import { useBoxAccessLevel } from '../hooks/useBoxPrivacy';
import { useSyncContext } from '../contexts/SyncContext';

interface StructuredFreezerBoxViewProps {
  boxId: string;
  boxName: string;
  boxAccentColor?: string | null;
  locationId: string;
  onBack: () => void;
  highlightCellId?: string;
  onNavigateToItem?: (locationId: string, sublocationId: string | null, positionId: string | null, folderId: string, itemId: string) => void;
}

const StructuredFreezerBoxView: React.FC<StructuredFreezerBoxViewProps> = ({
  boxId,
  boxName,
  boxAccentColor,
  locationId,
  onBack,
  highlightCellId,
  onNavigateToItem,
}) => {
  const accentColor = boxAccentColor || '#3b82f6';
  const queryClient = useQueryClient();
  const { teamMember } = useAuth();
  const accessLevel = useBoxAccessLevel(boxId);
  const readOnly = accessLevel === 'view' || accessLevel === 'none';

  const { box, cellData, headers, slideValues, isLoading } = useSlideBoxData(boxId);
  const upsertSlideMutation = useUpsertSlideCells(boxId, locationId);
  const deleteCellsMutation = useDeleteSlideCells(boxId, locationId);
  const crossCellsMutation = useCrossSlideCells(boxId, locationId);
  const updateBoxMutation = useUpdateBox(locationId);

  const { data: boxLinks = [] } = useBoxItemLinks(boxId);
  const createLinkMutation = useCreateBoxItemLink(boxId);
  const deleteLinkMutation = useDeleteBoxItemLink(boxId);

  const [addAsItemState, setAddAsItemState] = useState<{
    step: 'folder' | 'item';
    name: string;
    info: string | null;
    linkType: GridItemLinkType;
    count: number;
    headerValues?: Record<number, string>;
    folderId?: string;
  } | null>(null);

  const { data: linkFolderHeaders = [] } = useItemFolderHeaders(addAsItemState?.folderId || null);

  const [applyItemModalOpen, setApplyItemModalOpen] = useState(false);

  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [partialMatch, setPartialMatch] = useState<StructuredPartialMatch | null>(null);
  const [gridSize, setGridSize] = useState<{ width: number; height: number } | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [localNameFontDivisor, setLocalNameFontDivisor] = useState(10);
  const [localInfoFontDivisor, setLocalInfoFontDivisor] = useState(12);
  const [isApplyingColors, setIsApplyingColors] = useState(false);
  const [isApplyingGroups, setIsApplyingGroups] = useState(false);
  const [constrainGridHeight, setConstrainGridHeight] = useState(true);
  const hoveredCellRef = useRef<string | null>(null);

  const formDataRef = useRef<{
    name: string;
    headerValues: Record<number, string>;
    color: string | null;
    activeFields: StructuredFieldMatchStatus;
  }>({
    name: '',
    headerValues: {},
    color: null,
    activeFields: { name: true, headerFields: {}, color: true },
  });
  const sequentialRef = useRef<SequentialRef>({ active: false, getNamesMap: () => undefined, infoActive: false, getInfoMap: () => undefined });

  const {
    clipboard, hasClipboard, clipboardCellIds, clipboardOperation,
    copyToClipboard, cutToClipboard, getPastePreview, clearClipboard,
    hasMoveStaged, moveStagedCellIds, stageForMove, getMovePreview, clearMoveStaged,
    canPasteIntoBox, canMoveIntoBox, isCrossBoxMove,
    sourceBoxName, moveStagedBoxId, moveStagedBoxName,
  } = useGridClipboard();

  const boxSource = useMemo(() => ({ boxId, boxType: 'structured_freezer' as const, boxName }), [boxId, boxName]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [showLabelView, setShowLabelView] = useState(false);

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

  const shouldRotateGrid = rotateGrid;
  const gridAspectRatio = rows && columns
    ? shouldRotateGrid
      ? (rows + 0.5) / (columns + 0.5)
      : (columns + 0.5) / (rows + 0.5)
    : 1;

  const sortedHeaders = useMemo(
    () => [...headers].sort((a, b) => a.display_order - b.display_order),
    [headers]
  );

  const { allSelectedEmpty, singleLinkedItemId } = useMemo(
    () => computeStructuredSelectionLinkState(selectedCells, cellData, slideValues, boxLinks, headers),
    [selectedCells, cellData, slideValues, boxLinks, headers]
  );

  useEffect(() => {
    const match = detectCommonStructuredData(selectedCells, cellData, slideValues, headers);
    setPartialMatch(match.hasAnyData ? match : null);
  }, [selectedCells, cellData, slideValues, headers]);

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
    const availableWidth = gridContainerRef.current.offsetWidth;
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

    const resizeObserver = new ResizeObserver(() => calculateGridSize());
    if (gridContainerRef.current) resizeObserver.observe(gridContainerRef.current);
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
    queryClient.prefetchQuery({ queryKey: getBoxesQueryKey(locationId), staleTime: 30 * 1000 });
    queryClient.prefetchQuery({ queryKey: getItemsQueryKey(locationId), staleTime: 30 * 1000 });
  }, [queryClient, locationId]);

  const handleCellSelection = useCallback((cellId: string, isSelected: boolean) => {
    setSelectedCells((prev) => {
      const newSet = new Set(prev);
      if (isSelected) newSet.add(cellId);
      else newSet.delete(cellId);
      return newSet;
    });
  }, []);

  const slideHeaderSnapshotToUpsertValues = useCallback(
    (snapshot?: SlideHeaderSnapshot): Array<{ headerId: string; value: string }> => {
      if (!snapshot || headers.length === 0) return headers.map(h => ({ headerId: h.id, value: '' }));
      return headers.map(h => ({ headerId: h.id, value: snapshot[h.display_order] || '' }));
    },
    [headers]
  );

  const autoHeaders: FolderHeaderInput[] = useMemo(
    () => [...headers].sort((a, b) => a.display_order - b.display_order).map(h => ({ name: h.header_text, type: h.header_type, presetOptions: h.preset_options?.map(o => o.option_label) })),
    [headers]
  );

  const handleAddAsItem = useCallback((name: string, info: string | null, linkType: GridItemLinkType, count: number, hdrValues?: Record<number, string>) => {
    setAddAsItemState({ step: 'folder', name, info, linkType, count, headerValues: hdrValues });
  }, []);

  const handleFolderSelected = useCallback((folderId: string) => {
    setAddAsItemState(prev => prev ? { ...prev, step: 'item', folderId } : null);
  }, []);

  const handleCreateLinkedItem = useCallback(async (
    itemData: Parameters<typeof itemService.createItem>[0] extends infer T ? Omit<T, 'location_id' | 'sublocation_id' | 'position_id' | 'folder_id'> : never,
    customValues?: { header_id: string; value: string }[],
  ) => {
    if (!addAsItemState?.folderId || !box) return;
    try {
      const sortedHeaderOrders = [...headers].sort((a, b) => a.display_order - b.display_order).map(h => h.display_order);
      const isInfoLink = addAsItemState.linkType === 'info';
      const userTypedName = isInfoLink ? itemData.name.trim() : '';
      const userTypedCustomName = isInfoLink && userTypedName && userTypedName !== addAsItemState.name;

      if (!isInfoLink) {
        const updatedCellIds = await boxItemLinkService.populateCellNamesForStructuredLink(
          boxId,
          addAsItemState.name,
          cellData,
          slideValues,
          sortedHeaderOrders,
        );
        if (updatedCellIds.length > 0) {
          queryClient.invalidateQueries({ queryKey: ['cells', boxId] });
        }
      }

      if (isInfoLink && addAsItemState.info) {
        await boxItemLinkService.populateStructuredVariantInfoByHeaders(
          boxId,
          addAsItemState.info,
          cellData,
          slideValues,
          sortedHeaderOrders,
        );
        if (userTypedCustomName) {
          await boxItemLinkService.writeNameToInfoMatchingCells(
            boxId,
            addAsItemState.info,
            userTypedName,
          );
        }
        queryClient.invalidateQueries({ queryKey: ['cells', boxId] });
      } else if (addAsItemState.linkType === 'name_info' && addAsItemState.info) {
        await boxItemLinkService.populateStructuredVariantInfo(
          boxId,
          addAsItemState.name,
          addAsItemState.info,
          cellData,
          slideValues,
          sortedHeaderOrders,
        );
        queryClient.invalidateQueries({ queryKey: ['cells', boxId] });
      }

      const item = await itemService.createItem({
        ...itemData,
        location_id: box.location_id,
        sublocation_id: box.sublocation_id,
        position_id: box.position_id,
        folder_id: addAsItemState.folderId,
      });
      if (customValues && customValues.length > 0) {
        await itemCustomValueService.upsertValues(item.id, customValues);
      }

      let linkedName = addAsItemState.name;
      let linkedInfo: string | null = null;
      if (isInfoLink) {
        linkedName = userTypedCustomName ? userTypedName : '';
        linkedInfo = addAsItemState.info || '';
      } else if (addAsItemState.linkType === 'name_info') {
        linkedInfo = addAsItemState.info || '';
      }

      await createLinkMutation.mutateAsync({
        itemId: item.id,
        linkType: addAsItemState.linkType,
        linkedName,
        linkedInfo,
      });
      setAddAsItemState(null);
      setToast({ message: 'Item created and linked to grid', type: 'success' });
    } catch (error) {
      console.error('Failed to create linked item:', error);
      setToast({ message: 'Failed to create linked item', type: 'error' });
    }
  }, [addAsItemState, box, createLinkMutation, headers, cellData, slideValues, boxId, queryClient]);

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
      const folderHeaders = await itemFolderHeaderService.getHeaders(item.folder_id);
      const customValues = await itemCustomValueService.getValuesByItem(item.id);

      const sortedBoxHdrs = [...headers].sort((a, b) => a.display_order - b.display_order);
      const sortedHeaderOrders = sortedBoxHdrs.map(h => h.display_order);

      const headerValuesForCells: Array<{ headerId: string; value: string }> = headers.map(bh => {
        const matchingFolderHeader = folderHeaders.find(
          fh => fh.header_text === bh.header_text && fh.header_type === bh.header_type
        );
        const value = matchingFolderHeader ? (customValues[matchingFolderHeader.id] || '') : '';
        return { headerId: bh.id, value };
      });

      const variantInfo = sortedBoxHdrs.map(h => {
        const matchingFh = folderHeaders.find(fh => fh.header_text === h.header_text && fh.header_type === h.header_type);
        return matchingFh ? (customValues[matchingFh.id] || '').trim() : '';
      }).join('|||');

      const hasVariantInfo = variantInfo.replace(/\|/g, '').trim().length > 0;
      const linkType: GridItemLinkType = hasVariantInfo ? 'name_info' : 'name';

      const cellsToUpdate = Array.from(selectedCells).map((cellId) => ({
        cellId,
        data: {
          name: item.name,
          information: hasVariantInfo ? variantInfo : '',
          date: null as string | null,
          color: null as string | null,
          date_type: 'none' as const,
        },
        headerValues: headerValuesForCells,
      }));

      setSelectedCells(new Set());
      await upsertSlideMutation.mutateAsync({
        cells: cellsToUpdate,
        teamMemberId: teamMember?.id,
      });

      if (hasVariantInfo) {
        await boxItemLinkService.populateStructuredVariantInfo(
          boxId, item.name, variantInfo, cellData, slideValues, sortedHeaderOrders,
        );
      } else {
        await boxItemLinkService.populateCellNamesForStructuredLink(
          boxId, item.name, cellData, slideValues, sortedHeaderOrders,
        );
      }
      queryClient.invalidateQueries({ queryKey: ['cells', boxId] });

      await createLinkMutation.mutateAsync({
        itemId: item.id,
        linkType,
        linkedName: item.name,
        linkedInfo: hasVariantInfo ? variantInfo : null,
      });

      setToast({ message: 'Item applied and linked to grid', type: 'success' });
    } catch (error) {
      console.error('Failed to apply item to grid:', error);
      setToast({ message: 'Failed to apply item to grid', type: 'error' });
    }
  }, [selectedCells, headers, upsertSlideMutation, createLinkMutation, teamMember, boxId, cellData, slideValues, queryClient]);

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

  const linkPrefillCustomValues = useMemo(() => {
    if (!addAsItemState?.headerValues || linkFolderHeaders.length === 0) return undefined;
    const result: Record<string, string> = {};
    const sortedBoxHeaders = [...headers].sort((a, b) => a.display_order - b.display_order);
    for (const folderHeader of linkFolderHeaders) {
      const matchingBoxHeader = sortedBoxHeaders.find(
        bh => bh.header_text === folderHeader.header_text && bh.header_type === folderHeader.header_type
      );
      if (matchingBoxHeader) {
        const val = addAsItemState.headerValues[matchingBoxHeader.display_order];
        if (val?.trim()) {
          result[folderHeader.id] = val;
        }
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }, [addAsItemState, linkFolderHeaders, headers]);

  const handleApply = useCallback(
    async (
      name: string,
      headerValues: Record<number, string>,
      color: string | null,
      activeFields: StructuredFieldMatchStatus,
      sequentialNames?: Record<string, string>
    ) => {
      if (selectedCells.size === 0) return;
      try {
        const cellsToUpdate = Array.from(selectedCells).map((cellId) => {
          const existing = cellData[cellId];
          const existingValues = slideValues[cellId] || {};
          const seqName = sequentialNames?.[cellId];

          const mergedName = seqName !== undefined ? seqName : (activeFields.name ? name : (existing?.name ?? ''));
          const mergedColor = activeFields.color ? color : (existing?.color ?? null);

          const mergedHeaderValues: Array<{ headerId: string; value: string }> = [];
          for (const h of headers) {
            const isActive = activeFields.headerFields[h.display_order] ?? true;
            const value = isActive
              ? (headerValues[h.display_order] || '')
              : (existingValues[h.display_order] || '');
            mergedHeaderValues.push({ headerId: h.id, value });
          }

          const data: CellData = {
            name: mergedName,
            information: existing?.information ?? '',
            date: existing?.date ?? null,
            color: mergedColor,
            date_type: existing?.date_type ?? 'none',
          };

          return { cellId, data, headerValues: mergedHeaderValues };
        });

        setSelectedCells(new Set());
        await upsertSlideMutation.mutateAsync({
          cells: cellsToUpdate,
          teamMemberId: teamMember?.id,
        });

        if (boxLinks.length > 0) {
          const updatedNames = new Set(cellsToUpdate.map(c => c.data.name.trim()).filter(Boolean));
          const affectedLinks = boxLinks.filter(l => updatedNames.has(l.linked_name.trim()));
          for (const link of affectedLinks) {
            try {
              const folderItem = await itemService.getItemById(link.item_id);
              if (!folderItem) continue;
              const folderHeaders = await itemFolderHeaderService.getHeaders(folderItem.folder_id);
              if (folderHeaders.length === 0) continue;
              const sortedBoxHeaders = [...headers].sort((a, b) => a.display_order - b.display_order);
              const representativeCell = cellsToUpdate.find(c => c.data.name.trim() === link.linked_name.trim());
              if (!representativeCell) continue;
              const hvMap: Record<string, string> = {};
              for (const { headerId, value } of representativeCell.headerValues) {
                hvMap[headerId] = value;
              }
              const cvUpdates: Array<{ header_id: string; value: string }> = [];
              for (const fh of folderHeaders) {
                const bh = sortedBoxHeaders.find(
                  b => b.header_text === fh.header_text && b.header_type === fh.header_type
                );
                if (bh && hvMap[bh.id] !== undefined) {
                  cvUpdates.push({ header_id: fh.id, value: hvMap[bh.id] });
                }
              }
              if (cvUpdates.length > 0) {
                await itemCustomValueService.upsertValues(link.item_id, cvUpdates);
                queryClient.invalidateQueries({ queryKey: ['folderItems'] });
              }
            } catch (err) {
              console.error('Failed to sync item custom values:', err);
            }
          }
        }
      } catch (error) {
        console.error('Failed to apply structured data:', error);
      }
    },
    [selectedCells, cellData, slideValues, headers, upsertSlideMutation, teamMember, boxLinks, queryClient]
  );

  const handleClear = useCallback(async () => {
    try {
      const cellIds = Array.from(selectedCells).filter(cellId => cellData[cellId]);
      if (cellIds.length === 0) return;
      setSelectedCells(new Set());
      await deleteCellsMutation.mutateAsync({ cellIds, teamMemberId: teamMember?.id });
    } catch (error) {
      console.error('Failed to clear cells:', error);
    }
  }, [selectedCells, cellData, deleteCellsMutation, teamMember]);

  const handleCross = useCallback(async () => {
    try {
      const cellIds = Array.from(selectedCells).filter(cellId => cellData[cellId]);
      if (cellIds.length === 0) return;
      setSelectedCells(new Set());
      await crossCellsMutation.mutateAsync({ cellIds, teamMemberId: teamMember?.id });
    } catch (error) {
      console.error('Failed to cross cells:', error);
    }
  }, [selectedCells, cellData, crossCellsMutation, teamMember]);

  const handleFontSettingsChange = useCallback((nameDivisor: number, infoDivisor: number) => {
    setLocalNameFontDivisor(nameDivisor);
    setLocalInfoFontDivisor(infoDivisor);
  }, []);

  const handleConstrainGridHeightChange = useCallback(async (value: boolean) => {
    setConstrainGridHeight(value);
    try {
      await updateBoxMutation.mutateAsync({ boxId, data: { constrain_grid_height: value } });
    } catch (error) {
      console.error('Failed to save grid height setting:', error);
    }
  }, [boxId, updateBoxMutation]);

  const handleFontSettingsSave = useCallback(async (nameDivisor: number, infoDivisor: number) => {
    try {
      await updateBoxMutation.mutateAsync({
        boxId,
        data: { name_font_divisor: nameDivisor, info_font_divisor: infoDivisor },
      });
    } catch (error) {
      console.error('Failed to save font settings:', error);
    }
  }, [boxId, updateBoxMutation]);

  const hasNonEmptyCells = useMemo(
    () => Array.from(selectedCells).some(cellId => cellData[cellId]),
    [selectedCells, cellData]
  );

  const handleGridContextMenu = useCallback((cellId: string, x: number, y: number) => {
    setContextMenu({ x, y, anchorCellId: cellId });
  }, []);

  const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);

  const handleCopy = useCallback(() => {
    if (selectedCells.size === 0) return;
    copyToClipboard(selectedCells, cellData, boxSource, slideValues, false);
  }, [selectedCells, cellData, slideValues, copyToClipboard, boxSource]);

  const handleCut = useCallback(() => {
    if (selectedCells.size === 0) return;
    cutToClipboard(selectedCells, cellData, boxSource, slideValues, false);
  }, [selectedCells, cellData, slideValues, cutToClipboard, boxSource]);

  const handleHoveredCellChange = useCallback((cellId: string | null) => {
    hoveredCellRef.current = cellId;
  }, []);

  const handleFormDataChange = useCallback((
    name: string,
    headerValues: Record<number, string>,
    color: string | null,
    activeFields: StructuredFieldMatchStatus
  ) => {
    formDataRef.current = { name, headerValues, color, activeFields };
  }, []);

  const executePaste = useCallback(async (
    result: PasteResult,
    sourceClipboard?: { operation: 'copy' | 'cut'; sourceCellIds: string[]; sourceBoxId?: string; sourceBoxName?: string }
  ) => {
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
    if (!canPasteIntoBox('structured_freezer')) {
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
    stageForMove(selectedCells, cellData, boxSource, slideValues, false);
    setSelectedCells(new Set());
  }, [selectedCells, cellData, slideValues, stageForMove, boxSource]);

  const handleMoveExecute = useCallback(() => {
    if (!contextMenu || !rows || !columns) return;
    if (!canMoveIntoBox('structured_freezer')) {
      setToast({ message: 'Cannot move between different box types.', type: 'warning' });
      return;
    }
    const result = getMovePreview(contextMenu.anchorCellId, cellData, rows, columns, slideValues);
    if (!result || result.pasteToTarget.length === 0) return;
    executeMove(result);
  }, [contextMenu, rows, columns, getMovePreview, cellData, slideValues, executeMove, canMoveIntoBox]);

  const handleCancelMove = useCallback(() => clearMoveStaged(), [clearMoveStaged]);

  const handleKeyboardPaste = useCallback(() => {
    const anchorCellId = hoveredCellRef.current;
    if (!anchorCellId || !rows || !columns || !clipboard) return;
    if (!canPasteIntoBox('structured_freezer')) {
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
    if (!canMoveIntoBox('structured_freezer')) {
      setToast({ message: 'Cannot move between different box types.', type: 'warning' });
      return;
    }
    const result = getMovePreview(anchorCellId, cellData, rows, columns, slideValues);
    if (!result || result.pasteToTarget.length === 0) return;
    executeMove(result);
  }, [rows, columns, getMovePreview, cellData, slideValues, executeMove, canMoveIntoBox]);

  const handleKeyboardApply = useCallback(() => {
    if (selectedCells.size === 0) return;
    const { name, headerValues, color, activeFields } = formDataRef.current;
    const seq = sequentialRef.current;
    handleApply(name, headerValues, color, activeFields, seq.active ? seq.getNamesMap() : undefined);
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

  const handleCancelConfirm = useCallback(() => setPendingConfirm(null), []);

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

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (selectedCells.size > 0) setSelectedCells(new Set());
  }, [selectedCells.size]);

  const stopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

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

  const handleApplyColorBy = useCallback(async (filters: ColorByField[]) => {
    if (filters.length === 0) return;
    setIsApplyingColors(true);
    try {
      const ctx: StructuredContext = { slideValues, headers };
      const autoColorMap = computeAutoColorMap(cellData, filters, ctx);
      const cellsToUpdate = Object.entries(autoColorMap).map(([cellId, color]) => {
        const existingValues = slideValues[cellId] || {};
        const hv = headers.map(h => ({
          headerId: h.id,
          value: existingValues[h.display_order] || '',
        }));
        return {
          cellId,
          data: { ...cellData[cellId], color },
          headerValues: hv,
        };
      });
      if (cellsToUpdate.length === 0) return;
      await upsertSlideMutation.mutateAsync({
        cells: cellsToUpdate,
        teamMemberId: teamMember?.id,
      });
    } catch (error) {
      console.error('Failed to apply color by:', error);
    } finally {
      setIsApplyingColors(false);
    }
  }, [cellData, slideValues, headers, upsertSlideMutation, teamMember]);

  const handleApplyGroups = useCallback(async (filters: ColorByField[], method: GroupingMethod) => {
    if (filters.length === 0 || !rows || !columns) return;
    setIsApplyingGroups(true);
    try {
      const ctx: StructuredContext = { slideValues, headers };
      const newLayout = computeGroupedLayout(cellData, filters, rows, columns, method, ctx);
      if (newLayout.length === 0) return;

      const newPositions = new Set(newLayout.map(c => c.cellId));
      const oldPositions = new Set(Object.keys(cellData));

      const sourceIdByNewId: Record<string, string | undefined> = {};
      for (const { cellId, data } of newLayout) {
        const src = Object.entries(cellData).find(([, d]) =>
          d.name === data.name &&
          d.information === data.information &&
          d.date === data.date &&
          d.color === data.color
        );
        sourceIdByNewId[cellId] = src?.[0];
      }

      const cellsToUpsert = newLayout.map(({ cellId, data }) => {
        const src = sourceIdByNewId[cellId];
        const srcValues = src ? (slideValues[src] || {}) : {};
        const hv = headers.map(h => ({
          headerId: h.id,
          value: srcValues[h.display_order] || '',
        }));
        return { cellId, data: { ...data }, headerValues: hv };
      });

      if (cellsToUpsert.length > 0) {
        await upsertSlideMutation.mutateAsync({
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
  }, [cellData, slideValues, headers, rows, columns, upsertSlideMutation, deleteCellsMutation, teamMember]);

  const structuredInitialCellWidth = gridSize
    ? gridSize.width / ((shouldRotateGrid ? rows! : columns!) + 0.5)
    : undefined;

  const renderCellContent = useCallback(
    (cellId: string) => (
      <StructuredCellContent
        data={cellData[cellId]}
        values={slideValues[cellId] || {}}
        sortedHeaders={sortedHeaders}
        nameFontDivisor={localNameFontDivisor}
        infoFontDivisor={localInfoFontDivisor}
        initialCellWidth={structuredInitialCellWidth}
      />
    ),
    [cellData, slideValues, sortedHeaders, localNameFontDivisor, localInfoFontDivisor, structuredInitialCellWidth]
  );

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
                  <Grid3x3 className="h-6 w-6" style={{ color: accentColor }} />
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
            {hasMoveStaged && isCrossBoxMove(boxId) && canMoveIntoBox('structured_freezer') && (
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
                    renderCellContent={renderCellContent}
                    rotateGrid={shouldRotateGrid}
                    initialGridWidth={gridSize.width}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1" onMouseDown={stopPropagation} onMouseUp={stopPropagation} onClick={stopPropagation}>
              <StructuredFreezerInputSection
                selectedCells={selectedCells}
                cellData={cellData}
                columnValues={slideValues}
                sequentialRef={sequentialRef}
                onApply={handleApply}
                onClear={handleClear}
                onCross={handleCross}
                partialMatch={partialMatch}
                hasNonEmptyCells={hasNonEmptyCells}
                headers={headers}
                onFormDataChange={handleFormDataChange}
                canApplyItemToGrid={allSelectedEmpty && selectedCells.size > 0}
                onApplyItemToGrid={handleApplyItemToGrid}
                singleLinkedItemId={singleLinkedItemId}
                onNavigateToLinkedItem={handleNavigateToLinkedItem}
                readOnly={readOnly}
              />
            </div>
        </div>

        <StructuredContentSummary
          cellData={cellData}
          headers={headers}
          slideValues={slideValues}
          links={boxLinks}
          onAddAsItem={readOnly ? undefined : handleAddAsItem}
          onUnlink={readOnly ? undefined : handleUnlink}
          onNavigateToLinkedItem={handleNavigateToLinkedItem}
        />

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
            <ChangeHistory boxId={boxId} locationId={locationId} readOnly={readOnly} />
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
            canPaste={canPasteIntoBox('structured_freezer')}
            canMove={canMoveIntoBox('structured_freezer')}
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

      {addAsItemState?.step === 'folder' && box && (
        <SelectFolderForLinkModal
          locationId={box.location_id}
          sublocationId={box.sublocation_id}
          positionId={box.position_id}
          reagentName={addAsItemState.name}
          reagentInfo={addAsItemState.info}
          linkType={addAsItemState.linkType}
          autoHeaders={autoHeaders}
          onSelect={handleFolderSelected}
          onClose={() => setAddAsItemState(null)}
        />
      )}

      {addAsItemState?.step === 'item' && (
        <CreateItemModal
          folderHeaders={linkFolderHeaders}
          prefillName={addAsItemState.linkType === 'info' ? undefined : addAsItemState.name}
          placeholderName={addAsItemState.linkType === 'info' ? addAsItemState.name : undefined}
          prefillStockNumber={addAsItemState.count}
          prefillDisplayMode={addAsItemState.count === 1 ? 'freeze_thaw' : 'stock'}
          prefillCustomValues={linkPrefillCustomValues}
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
          boxHeaders={headers}
          onSelect={handleItemSelectedForGrid}
          onClose={() => setApplyItemModalOpen(false)}
          mode="sheet"
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

export default StructuredFreezerBoxView;
