import { useState, useCallback, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TreeNode } from '../utils/treeLayoutUtils';
import type { SublocationWithStats, PositionWithStats, LocationBoxWithStats, ItemFolderWithStats } from '../types/database';
import { transferService } from '../services/transferService';
import { boxService } from '../services/boxService';
import { itemFolderService } from '../services/itemFolderService';
import { LOCATIONS_QUERY_KEY } from './useLocations';
import { ALL_SUBLOCATIONS_QUERY_KEY } from './useSublocationData';
import { ALL_POSITIONS_QUERY_KEY } from './usePositionData';
import { OVERVIEW_ALL_BOXES_QUERY_KEY, OVERVIEW_ALL_FOLDERS_QUERY_KEY } from './useOverviewData';

export interface DragState {
  sourceNode: TreeNode;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
}

export interface DropConfirmState {
  sourceNode: TreeNode;
  targetNode: TreeNode;
}

function getSourceDepth(
  node: TreeNode,
  allSublocations: SublocationWithStats[],
  allPositions: PositionWithStats[],
): number {
  if (node.type === 'location') {
    const subs = allSublocations.filter(s => s.location_id === node.id);
    const subIds = new Set(subs.map(s => s.id));
    const hasPositions = allPositions.some(p => subIds.has(p.sublocation_id));
    if (hasPositions) return 3;
    if (subs.length > 0) return 2;
    return 1;
  }
  if (node.type === 'sublocation') {
    const hasPositions = allPositions.some(p => p.sublocation_id === node.id);
    if (hasPositions) return 2;
    return 1;
  }
  return 1;
}

export function computeValidDropTargets(
  sourceNode: TreeNode,
  allNodes: TreeNode[],
  allSublocations: SublocationWithStats[],
  allPositions: PositionWithStats[],
  allBoxes: LocationBoxWithStats[],
  allFolders: ItemFolderWithStats[],
): Set<string> {
  const valid = new Set<string>();

  if (sourceNode.type === 'box' || sourceNode.type === 'folder') {
    const sourceBox = sourceNode.type === 'box'
      ? allBoxes.find(b => b.id === sourceNode.id)
      : null;
    const sourceFolder = sourceNode.type === 'folder'
      ? allFolders.find(f => f.id === sourceNode.id)
      : null;
    const currentLocationId = sourceBox?.location_id ?? sourceFolder?.location_id;
    const currentSublocationId = sourceBox?.sublocation_id ?? sourceFolder?.sublocation_id;
    const currentPositionId = sourceBox?.position_id ?? sourceFolder?.position_id;

    for (const node of allNodes) {
      if (node.isGhost) continue;
      if (node.id === sourceNode.id) continue;
      if (node.type === 'location' || node.type === 'sublocation' || node.type === 'position') {
        if (node.type === 'location' && node.id === currentLocationId && !currentSublocationId && !currentPositionId) continue;
        if (node.type === 'sublocation' && node.id === currentSublocationId && !currentPositionId) continue;
        if (node.type === 'position' && node.id === currentPositionId) continue;
        valid.add(node.id);
      }
    }
    return valid;
  }

  const sourceDepth = getSourceDepth(sourceNode, allSublocations, allPositions);
  const canTargetLocation = sourceDepth <= 2;
  const canTargetSublocation = sourceDepth <= 1;

  const descendantIds = new Set<string>();
  function collectDescendants(n: TreeNode) {
    for (const child of n.children) {
      if (!child.isGhost) descendantIds.add(child.id);
      collectDescendants(child);
    }
  }
  collectDescendants(sourceNode);

  for (const node of allNodes) {
    if (node.isGhost) continue;
    if (node.id === sourceNode.id) continue;
    if (descendantIds.has(node.id)) continue;

    if (sourceNode.type === 'location' && node.type === 'location' && node.id === sourceNode.id) continue;

    if (sourceNode.type === 'sublocation') {
      if (node.type === 'location' && node.id === sourceNode.locationId) continue;
    }
    if (sourceNode.type === 'position') {
      if (node.type === 'sublocation' && node.id === sourceNode.sublocationId) continue;
    }

    if (node.type === 'location' && canTargetLocation) {
      valid.add(node.id);
    }
    if (node.type === 'sublocation' && canTargetSublocation) {
      if (sourceNode.type === 'location') {
        const sourceSubIds = new Set(
          allSublocations.filter(s => s.location_id === sourceNode.id).map(s => s.id)
        );
        if (sourceSubIds.has(node.id)) continue;
      }
      valid.add(node.id);
    }
  }

  return valid;
}

function collectAllNonGhostNodes(roots: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(node: TreeNode) {
    if (!node.isGhost) result.push(node);
    for (const child of node.children) walk(child);
  }
  for (const root of roots) walk(root);
  return result;
}

export function useOverviewDragDrop(
  treeRoots: TreeNode[],
  allSublocations: SublocationWithStats[],
  allPositions: PositionWithStats[],
  allBoxes: LocationBoxWithStats[],
  allFolders: ItemFolderWithStats[],
) {
  const queryClient = useQueryClient();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropConfirm, setDropConfirm] = useState<DropConfirmState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const dragThresholdMet = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number; node: TreeNode } | null>(null);

  const allNonGhostNodes = useMemo(
    () => collectAllNonGhostNodes(treeRoots),
    [treeRoots]
  );

  const validTargets = useMemo(() => {
    if (!dragState?.isDragging) return null;
    return computeValidDropTargets(dragState.sourceNode, allNonGhostNodes, allSublocations, allPositions, allBoxes, allFolders);
  }, [dragState?.isDragging, dragState?.sourceNode, allNonGhostNodes, allSublocations, allPositions, allBoxes, allFolders]);

  const handleDragPointerDown = useCallback((node: TreeNode, clientX: number, clientY: number) => {
    pointerStartRef.current = { x: clientX, y: clientY, node };
    dragThresholdMet.current = false;
  }, []);

  const handleDragPointerMove = useCallback((clientX: number, clientY: number) => {
    if (!pointerStartRef.current) return;

    const dx = clientX - pointerStartRef.current.x;
    const dy = clientY - pointerStartRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!dragThresholdMet.current && dist > 6) {
      dragThresholdMet.current = true;
      setDragState({
        sourceNode: pointerStartRef.current.node,
        startX: pointerStartRef.current.x,
        startY: pointerStartRef.current.y,
        currentX: clientX,
        currentY: clientY,
        isDragging: true,
      });
    } else if (dragThresholdMet.current) {
      setDragState(prev => prev ? { ...prev, currentX: clientX, currentY: clientY } : null);
    }
  }, []);

  const handleDragPointerUp = useCallback((targetNode: TreeNode | null) => {
    if (dragState?.isDragging && targetNode && validTargets?.has(targetNode.id)) {
      setDropConfirm({ sourceNode: dragState.sourceNode, targetNode });
    }
    setDragState(null);
    pointerStartRef.current = null;
    dragThresholdMet.current = false;
  }, [dragState, validTargets]);

  const handleDragCancel = useCallback(() => {
    setDragState(null);
    pointerStartRef.current = null;
    dragThresholdMet.current = false;
  }, []);

  const invalidateOverviewQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ALL_SUBLOCATIONS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ALL_POSITIONS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: OVERVIEW_ALL_BOXES_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: OVERVIEW_ALL_FOLDERS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ['sublocations'] });
    queryClient.invalidateQueries({ queryKey: ['positions'] });
  }, [queryClient]);

  const executeTransfer = useCallback(async () => {
    if (!dropConfirm) return;
    const { sourceNode, targetNode } = dropConfirm;

    setIsProcessing(true);
    try {
      if (sourceNode.type === 'box') {
        const box = allBoxes.find(b => b.id === sourceNode.id);
        if (!box) throw new Error('Box not found');
        const targetLocationId = targetNode.locationId || targetNode.id;
        const targetSublocationId = targetNode.type === 'sublocation' ? targetNode.id : targetNode.type === 'position' ? (allPositions.find(p => p.id === targetNode.id)?.sublocation_id || null) : null;
        const targetPositionId = targetNode.type === 'position' ? targetNode.id : null;
        await boxService.moveBoxToLocation(box.id, targetLocationId, targetSublocationId, targetPositionId);
      } else if (sourceNode.type === 'folder') {
        const folder = allFolders.find(f => f.id === sourceNode.id);
        if (!folder) throw new Error('Folder not found');
        const targetLocationId = targetNode.locationId || targetNode.id;
        const targetSublocationId = targetNode.type === 'sublocation' ? targetNode.id : targetNode.type === 'position' ? (allPositions.find(p => p.id === targetNode.id)?.sublocation_id || null) : null;
        const targetPositionId = targetNode.type === 'position' ? targetNode.id : null;
        await itemFolderService.moveFolder(folder.id, targetLocationId, targetSublocationId, targetPositionId);
      } else if (sourceNode.type === 'location') {
        if (targetNode.type === 'location') {
          await transferService.transferLocationToLocation(sourceNode.id, targetNode.id);
        } else if (targetNode.type === 'sublocation') {
          await transferService.transferLocationToSublocation(sourceNode.id, targetNode.id);
        }
      } else if (sourceNode.type === 'sublocation') {
        if (targetNode.type === 'location') {
          await transferService.transferSublocationToLocation(sourceNode.id, targetNode.id);
        } else if (targetNode.type === 'sublocation') {
          await transferService.transferSublocationToSublocation(sourceNode.id, targetNode.id);
        }
      } else if (sourceNode.type === 'position') {
        if (targetNode.type === 'location') {
          await transferService.transferPositionToLocation(sourceNode.id, targetNode.id);
        } else if (targetNode.type === 'sublocation') {
          await transferService.transferPositionToSublocation(sourceNode.id, targetNode.id);
        }
      }

      invalidateOverviewQueries();
      setDropConfirm(null);
      return { success: true };
    } catch (error) {
      console.error('Transfer failed:', error);
      setDropConfirm(null);
      return { success: false, error };
    } finally {
      setIsProcessing(false);
    }
  }, [dropConfirm, allBoxes, allFolders, allPositions, invalidateOverviewQueries]);

  const cancelConfirm = useCallback(() => {
    setDropConfirm(null);
  }, []);

  return {
    dragState,
    dropConfirm,
    isProcessing,
    validTargets,
    handleDragPointerDown,
    handleDragPointerMove,
    handleDragPointerUp,
    handleDragCancel,
    executeTransfer,
    cancelConfirm,
  };
}
