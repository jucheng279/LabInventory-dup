import React, { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import {
  Menu,
  MapPin,
  Plus,
  Minus,
  Maximize2,
  Search,
  X,
  LayoutDashboard,
  Lock,
  User,
  GitBranch,
  List,
} from 'lucide-react';
import InventoryListView from './InventoryListView';
import { useLocations } from '../hooks/useLocations';
import { useAllSublocations } from '../hooks/useSublocationData';
import { useAllPositions } from '../hooks/usePositionData';
import { useAllBoxesForOverview, useAllFoldersForOverview, useStandaloneItemsForOverview } from '../hooks/useOverviewData';
import { useExpirations } from '../hooks/useExpirations';
import { useCentralizedInventory } from '../hooks/useCentralizedInventory';
import { getDaysUntil } from '../services/expirationService';
import { useLowStock } from '../hooks/useLowStock';
import type { LocationWithStats, SublocationWithStats, PositionWithStats, LocationBoxWithStats, ItemFolderWithStats } from '../types/database';
import type { BoxType } from '../services/boxService';
import type { DateFilter, SearchFilterState } from '../types/search';
import SvgIcon from './SvgIcon';
import Portal from './Portal';
import { getDefaultIconForContext } from '../config/iconRegistry';
import SearchBox from './SearchBox';
import QRScannerModal from './QRScannerModal';
import Toast from './Toast';
import DragDropConfirmModal from './DragDropConfirmModal';
import FloatingAIChatBubble from './FloatingAIChatBubble';
import type { NavLinkData } from './AIChatMarkdown';
import { useAuth } from '../contexts/AuthContext';
import { useBatchBoxAccess, useBatchPrivacySettings } from '../hooks/useBoxPrivacy';
import { useTeamMembers } from '../hooks/useTeam';
import { useOverviewDragDrop } from '../hooks/useOverviewDragDrop';
import {
  buildTreeData,
  computeTreeLayout,
  computeTreeHeight,
  computeActiveColumns,
  computeResolvedEdges,
  findMatchingNodeIds,
  TREE_VERTICAL_GAP,
  type TreeNode,
  type PositionedNode,
  type TreeNodeType,
  type ActiveColumns,
  type ResolvedEdge,
} from '../utils/treeLayoutUtils';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.15;

interface CanvasState {
  scale: number;
  translateX: number;
  translateY: number;
}

type OverviewViewMode = 'tree' | 'list';

interface InventoryOverviewPageProps {
  onSelectLocation: (locationId: string) => void;
  onSelectSublocation: (
    locationId: string,
    sublocationId: string,
    sublocationName: string,
    accentColor: string | null,
    locationType?: string,
    iconId?: string | null,
  ) => void;
  onSelectPosition: (
    locationId: string,
    sublocationId: string,
    sublocationName: string,
    sublocationAccentColor: string | null,
    sublocationLocationType: string,
    sublocationIconId: string | null,
    positionId: string,
    positionName: string,
    positionAccentColor: string | null,
    positionLocationType: string,
    positionIconId?: string | null,
  ) => void;
  onOpenBox: (locationId: string, boxId: string, boxName: string, boxAccentColor?: string | null, boxType?: BoxType) => void;
  onOpenFolder: (locationId: string, folderId: string, sublocationId?: string | null, positionId?: string | null, folderName?: string) => void;
  onOpenExpirationView: (initialLocationFilter?: string) => void;
  onOpenLowStockView: (initialLocationFilter?: string) => void;
  onMobileMenuToggle?: () => void;
  onNavigateToBox: (locationId: string, boxId: string, boxName: string, boxAccentColor: string | null, boxType?: BoxType, highlightCellId?: string, highlightColumn?: number) => void;
  onNavigateToItem: (locationId: string, sublocationId: string | null, positionId: string | null, folderId: string, itemId: string) => void;
  onNavigateToLocation: (locationId: string) => void;
  onOpenSearchPage?: (query: string, dateFilter: DateFilter | null, filterState: SearchFilterState | null) => void;
  onAIChatNavigate?: (nav: NavLinkData) => void;
}

const InventoryOverviewPage: React.FC<InventoryOverviewPageProps> = ({
  onSelectLocation,
  onSelectSublocation,
  onSelectPosition,
  onOpenBox,
  onOpenFolder,
  onOpenExpirationView,
  onOpenLowStockView,
  onMobileMenuToggle,
  onNavigateToBox,
  onNavigateToItem,
  onNavigateToLocation,
  onOpenSearchPage,
  onAIChatNavigate,
}) => {
  const { data: locations = [], isLoading: isLoadingLocations } = useLocations();
  const { data: allSublocations = [], isLoading: isLoadingSublocations } = useAllSublocations();
  const { data: allPositions = [], isLoading: isLoadingPositions } = useAllPositions();
  const { data: allBoxes = [], isLoading: isLoadingBoxes } = useAllBoxesForOverview();
  const { data: allFolders = [], isLoading: isLoadingFolders } = useAllFoldersForOverview();
  const { data: standaloneItems = [], isLoading: isLoadingStandalone } = useStandaloneItemsForOverview();
  const { data: expirations = [], isLoading: isLoadingExpirations } = useExpirations();
  const { data: lowStockItems = [], isLoading: isLoadingLowStock } = useLowStock();
  useCentralizedInventory();

  const isLoadingStats = isLoadingBoxes || isLoadingFolders || isLoadingStandalone || isLoadingExpirations || isLoadingLowStock;
  const stats = useMemo(() => ({
    box_count: allBoxes.length,
    folder_count: allFolders.length,
    item_count: allFolders.reduce((sum, f) => sum + (f.item_count || 0), 0) + standaloneItems.length,
    expiring_soon_count: expirations.filter(r => getDaysUntil(r.expirationDate) < 0).length,
    low_stock_count: lowStockItems.length,
  }), [allBoxes, allFolders, standaloneItems, expirations, lowStockItems]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasState, setCanvasState] = useState<CanvasState>({ scale: 1, translateX: 0, translateY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panStartTranslate, setPanStartTranslate] = useState({ x: 0, y: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredNode, setHoveredNode] = useState<{ node: TreeNode; x: number; y: number; nodeLeft: number } | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [viewMode, setViewMode] = useState<OverviewViewMode>('tree');
  const { workspace } = useAuth();

  const allBoxIds = useMemo(() => allBoxes.map(b => b.id), [allBoxes]);
  const { data: boxAccessMap = {} } = useBatchBoxAccess(allBoxIds);
  const { data: privacySettingsMap = {} } = useBatchPrivacySettings(allBoxIds);
  const { data: teamMembers = [] } = useTeamMembers();

  const boxOwnerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [boxId, settings] of Object.entries(privacySettingsMap)) {
      const member = teamMembers.find(m => m.id === settings.owner_id);
      if (member) {
        map[boxId] = member.display_name || member.email;
      }
    }
    return map;
  }, [privacySettingsMap, teamMembers]);

  const hoveredDropTarget = useRef<TreeNode | null>(null);
  const [hoveredDropTargetId, setHoveredDropTargetId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const needsAutoFit = useRef(true);

  const activeTouches = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartScale = useRef<number>(1);
  const pinchMidpoint = useRef<{ x: number; y: number } | null>(null);
  const touchPanStarted = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isTouchPanning = useRef(false);

  const isLoading = isLoadingLocations || isLoadingBoxes || isLoadingSublocations || isLoadingPositions || isLoadingFolders;

  const subsByLocation = useMemo(() => {
    const map: Record<string, SublocationWithStats[]> = {};
    allSublocations.forEach(s => {
      if (!map[s.location_id]) map[s.location_id] = [];
      map[s.location_id].push(s);
    });
    return map;
  }, [allSublocations]);

  const posBySub = useMemo(() => {
    const map: Record<string, PositionWithStats[]> = {};
    allPositions.forEach(p => {
      if (!map[p.sublocation_id]) map[p.sublocation_id] = [];
      map[p.sublocation_id].push(p);
    });
    return map;
  }, [allPositions]);

  const boxesByLocation = useMemo(() => {
    const map: Record<string, LocationBoxWithStats[]> = {};
    allBoxes.forEach(b => {
      const key = b.position_id || b.sublocation_id || `location:${b.location_id}`;
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  }, [allBoxes]);

  const foldersByLocation = useMemo(() => {
    const map: Record<string, ItemFolderWithStats[]> = {};
    allFolders.forEach(f => {
      const key = f.position_id || f.sublocation_id || `location:${f.location_id}`;
      if (!map[key]) map[key] = [];
      map[key].push(f);
    });
    return map;
  }, [allFolders]);

  const activeColumns = useMemo(() => {
    const hasSubs = allSublocations.length > 0;
    const hasPositions = allPositions.length > 0;
    const hasBoxFolders = allBoxes.length > 0 || allFolders.length > 0;
    return computeActiveColumns(hasSubs, hasPositions, hasBoxFolders);
  }, [allSublocations.length, allPositions.length, allBoxes.length, allFolders.length]);

  const treeRoots = useMemo(() => {
    return buildTreeData(locations, subsByLocation, posBySub, boxesByLocation, foldersByLocation, activeColumns);
  }, [locations, subsByLocation, posBySub, boxesByLocation, foldersByLocation, activeColumns]);

  const {
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
  } = useOverviewDragDrop(treeRoots, allSublocations, allPositions, allBoxes, allFolders);

  const highlightedIds = useMemo(() => {
    if (!searchTerm.trim()) return null;
    return findMatchingNodeIds(treeRoots, searchTerm, 'all');
  }, [treeRoots, searchTerm]);

  const layoutData = useMemo(() => {
    const trees: { nodes: PositionedNode[]; height: number; yOffset: number }[] = [];
    let cumulativeY = 0;

    for (const root of treeRoots) {
      const nodes = computeTreeLayout(root, activeColumns);
      const height = computeTreeHeight(root);
      trees.push({ nodes, height, yOffset: cumulativeY });
      cumulativeY += height + TREE_VERTICAL_GAP;
    }

    return { trees, totalHeight: cumulativeY - (treeRoots.length > 0 ? TREE_VERTICAL_GAP : 0) };
  }, [treeRoots, activeColumns]);

  const contentWidth = activeColumns.totalWidth + 60;
  const contentHeight = layoutData.totalHeight + 40;

  useEffect(() => {
    if (isLoading || !needsAutoFit.current) return;
    needsAutoFit.current = false;
    requestAnimationFrame(() => {
      if (!viewportRef.current) return;
      const viewport = viewportRef.current.getBoundingClientRect();
      if (contentWidth === 0 || contentHeight === 0) return;
      const scaleX = (viewport.width - 64) / contentWidth;
      const scaleY = (viewport.height - 64) / contentHeight;
      const newScale = Math.min(Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)), MAX_ZOOM);
      const newTranslateX = (viewport.width - contentWidth * newScale) / 2;
      const newTranslateY = (viewport.height - contentHeight * newScale) / 2;
      setCanvasState({ scale: newScale, translateX: newTranslateX, translateY: newTranslateY });
    });
  }, [isLoading, contentWidth, contentHeight]);

  const handleZoom = useCallback((delta: number, centerX?: number, centerY?: number) => {
    setCanvasState(prev => {
      const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.scale + delta));
      if (newScale === prev.scale) return prev;
      if (centerX !== undefined && centerY !== undefined) {
        const scaleRatio = newScale / prev.scale;
        const newTranslateX = centerX - (centerX - prev.translateX) * scaleRatio;
        const newTranslateY = centerY - (centerY - prev.translateY) * scaleRatio;
        return { scale: newScale, translateX: newTranslateX, translateY: newTranslateY };
      }
      return { ...prev, scale: newScale };
    });
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const centerX = e.clientX - rect.left;
        const centerY = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        handleZoom(delta, centerX, centerY);
      } else {
        setCanvasState(prev => ({
          ...prev,
          translateX: prev.translateX - e.deltaX,
          translateY: prev.translateY - e.deltaY,
        }));
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [handleZoom, isLoading]);

  const TOUCH_PAN_THRESHOLD = 8;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (dragState?.isDragging) return;

    if (e.pointerType === 'touch') {
      activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activeTouches.current.size === 2) {
        const pts = Array.from(activeTouches.current.values());
        const dx = pts[1].x - pts[0].x;
        const dy = pts[1].y - pts[0].y;
        pinchStartDist.current = Math.sqrt(dx * dx + dy * dy);
        pinchStartScale.current = canvasState.scale;
        const rect = canvasRef.current?.getBoundingClientRect();
        pinchMidpoint.current = {
          x: (pts[0].x + pts[1].x) / 2 - (rect?.left ?? 0),
          y: (pts[0].y + pts[1].y) / 2 - (rect?.top ?? 0),
        };
        isTouchPanning.current = false;
        touchPanStarted.current = false;
        setIsPanning(false);
        return;
      }

      if (activeTouches.current.size === 1) {
        touchStartPos.current = { x: e.clientX, y: e.clientY };
        touchPanStarted.current = false;
        isTouchPanning.current = false;
        setPanStart({ x: e.clientX, y: e.clientY });
        setPanStartTranslate({ x: canvasState.translateX, y: canvasState.translateY });
      }
      return;
    }

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanStartTranslate({ x: canvasState.translateX, y: canvasState.translateY });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [canvasState.translateX, canvasState.translateY, canvasState.scale, dragState]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      activeTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activeTouches.current.size === 2 && pinchStartDist.current !== null) {
        const pts = Array.from(activeTouches.current.values());
        const dx = pts[1].x - pts[0].x;
        const dy = pts[1].y - pts[0].y;
        const currentDist = Math.sqrt(dx * dx + dy * dy);
        const ratio = currentDist / pinchStartDist.current;
        const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartScale.current * ratio));

        if (pinchMidpoint.current) {
          setCanvasState(prev => {
            const scaleRatio = newScale / prev.scale;
            return {
              scale: newScale,
              translateX: pinchMidpoint.current!.x - (pinchMidpoint.current!.x - prev.translateX) * scaleRatio,
              translateY: pinchMidpoint.current!.y - (pinchMidpoint.current!.y - prev.translateY) * scaleRatio,
            };
          });
        }
        return;
      }

      if (activeTouches.current.size === 1 && touchStartPos.current) {
        const moveX = e.clientX - touchStartPos.current.x;
        const moveY = e.clientY - touchStartPos.current.y;
        const dist = Math.sqrt(moveX * moveX + moveY * moveY);

        if (!touchPanStarted.current && dist > TOUCH_PAN_THRESHOLD) {
          touchPanStarted.current = true;
          isTouchPanning.current = true;
          setIsPanning(true);
          handleDragCancel();
        }

        if (isTouchPanning.current) {
          setCanvasState(prev => ({
            ...prev,
            translateX: panStartTranslate.x + (e.clientX - panStart.x),
            translateY: panStartTranslate.y + (e.clientY - panStart.y),
          }));
        }
      }
      return;
    }

    if (dragState?.isDragging) {
      handleDragPointerMove(e.clientX, e.clientY);
      return;
    }
    if (!isPanning) {
      handleDragPointerMove(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    setCanvasState(prev => ({
      ...prev,
      translateX: panStartTranslate.x + dx,
      translateY: panStartTranslate.y + dy,
    }));
  }, [isPanning, panStart, panStartTranslate, dragState, handleDragPointerMove, handleDragCancel]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      activeTouches.current.delete(e.pointerId);

      if (pinchStartDist.current !== null) {
        if (activeTouches.current.size < 2) {
          pinchStartDist.current = null;
          pinchMidpoint.current = null;
          if (activeTouches.current.size === 1) {
            const remaining = Array.from(activeTouches.current.values())[0];
            touchStartPos.current = { x: remaining.x, y: remaining.y };
            touchPanStarted.current = false;
            isTouchPanning.current = false;
            setPanStart({ x: remaining.x, y: remaining.y });
            setPanStartTranslate({ x: canvasState.translateX, y: canvasState.translateY });
          }
        }
        return;
      }

      if (isTouchPanning.current) {
        isTouchPanning.current = false;
        touchPanStarted.current = false;
        touchStartPos.current = null;
        setIsPanning(false);
        return;
      }

      touchStartPos.current = null;
      touchPanStarted.current = false;
      isTouchPanning.current = false;
      setIsPanning(false);
      return;
    }

    if (dragState?.isDragging) {
      handleDragPointerUp(hoveredDropTarget.current);
      hoveredDropTarget.current = null;
      setHoveredDropTargetId(null);
      return;
    }
    handleDragCancel();
    setHoveredDropTargetId(null);
    setIsPanning(false);
  }, [dragState, handleDragPointerUp, handleDragCancel, canvasState.translateX, canvasState.translateY]);

  const handleFitToScreen = useCallback(() => {
    if (!viewportRef.current) return;
    const viewport = viewportRef.current.getBoundingClientRect();
    if (contentWidth === 0 || contentHeight === 0) {
      setCanvasState({ scale: 1, translateX: 0, translateY: 0 });
      return;
    }
    const scaleX = (viewport.width - 64) / contentWidth;
    const scaleY = (viewport.height - 64) / contentHeight;
    const newScale = Math.min(Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)), MAX_ZOOM);
    const newTranslateX = (viewport.width - contentWidth * newScale) / 2;
    const newTranslateY = (viewport.height - contentHeight * newScale) / 2;
    setCanvasState({ scale: newScale, translateX: newTranslateX, translateY: newTranslateY });
  }, [contentWidth, contentHeight]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || e.target === contentRef.current) {
      setSelectedId(null);
    }
  }, []);

  const handleNodeClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelectedId(nodeId);
  }, []);

  const handleNodeDoubleClick = useCallback((e: React.MouseEvent, node: TreeNode) => {
    e.stopPropagation();
    switch (node.type) {
      case 'location':
        onSelectLocation(node.id);
        break;
      case 'sublocation':
        if (node.locationId) {
          onSelectSublocation(
            node.locationId,
            node.id,
            node.name,
            node.accentColor,
            node.locationType,
            node.iconId,
          );
        }
        break;
      case 'position':
        if (node.locationId && node.sublocationId) {
          onSelectPosition(
            node.locationId,
            node.sublocationId,
            node.sublocationName || '',
            node.sublocationAccentColor || null,
            node.sublocationLocationType || 'general',
            node.sublocationIconId || null,
            node.id,
            node.name,
            node.accentColor,
            node.positionLocationType || 'general',
            node.iconId,
          );
        }
        break;
      case 'box':
        if (node.locationId) {
          const access = boxAccessMap[node.id] || 'open';
          if (access === 'none') {
            setToast({ message: 'You don\'t have access to this box.', type: 'error' });
            return;
          }
          onOpenBox(node.locationId, node.id, node.name, node.accentColor, node.boxType);
        }
        break;
      case 'folder':
        if (node.locationId) {
          onOpenFolder(node.locationId, node.id, node.sublocationId || null, null, node.name);
        }
        break;
      default:
        break;
    }
  }, [onSelectLocation, onSelectSublocation, onSelectPosition, onOpenBox, onOpenFolder, boxAccessMap]);

  const handleNodeHover = useCallback((node: TreeNode, rect: DOMRect) => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
      hoverTimeout.current = null;
    }
    setHoveredNode({ node, x: rect.right + 8, y: rect.top + rect.height / 2, nodeLeft: rect.left });
  }, []);

  const handleNodeHoverEnd = useCallback(() => {
    hoverTimeout.current = setTimeout(() => {
      setHoveredNode(null);
    }, 150);
  }, []);

  const isFiltering = highlightedIds !== null;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMobileMenuToggle={onMobileMenuToggle} viewMode={viewMode} onViewModeChange={setViewMode} />
        <div className="flex-1 flex items-center justify-center">
          <div className="space-y-3 w-full max-w-md px-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      <Header onMobileMenuToggle={onMobileMenuToggle} viewMode={viewMode} onViewModeChange={setViewMode} />

      <div className="bg-gray-50/50 px-4 md:px-6 pt-2 pb-1">
        <SearchBox
          variant="white"
          onSelectCell={(locationId, boxId, boxName, boxAccentColor, boxType, highlightCellId, highlightColumn) =>
            onNavigateToBox(locationId, boxId, boxName, boxAccentColor, boxType, highlightCellId, highlightColumn)
          }
          onSelectBox={(locationId, boxId, boxName, boxAccentColor, boxType) =>
            onNavigateToBox(locationId, boxId, boxName, boxAccentColor, boxType)
          }
          onSelectItem={(locationId) => {
            onNavigateToLocation(locationId);
          }}
          onOpenSearchPage={onOpenSearchPage}
          onOpenScanner={async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
              setToast({ message: 'Camera is not available in this browser or context.', type: 'error' });
              return;
            }
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
              stream.getTracks().forEach((t) => t.stop());
              setShowQRScanner(true);
            } catch (err: any) {
              const name = err?.name || '';
              if (name === 'NotAllowedError') {
                setToast({ message: 'Camera access denied. Please allow camera in your browser settings.', type: 'error' });
              } else if (name === 'NotFoundError') {
                setToast({ message: 'No camera found on this device.', type: 'error' });
              } else {
                setToast({ message: 'Could not access camera. Please try again.', type: 'error' });
              }
            }
          }}
        />
      </div>

      {viewMode === 'tree' && (
        <StatsStrip
          stats={stats}
          isLoading={isLoadingStats}
          onOpenExpirationView={onOpenExpirationView}
          onOpenLowStockView={onOpenLowStockView}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      )}

      {viewMode === 'list' ? (
        <InventoryListView
          onNavigateToBox={onNavigateToBox}
          onNavigateToItem={onNavigateToItem}
          onNavigateToLocation={onNavigateToLocation}
        />
      ) : (
      <div
        ref={viewportRef}
        className="flex-1 relative overflow-hidden"
        style={{ backgroundColor: '#f3f4f6', backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      >
        <div
          ref={canvasRef}
          className="absolute inset-0"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleCanvasClick}
          style={{ cursor: dragState?.isDragging ? 'grabbing' : isPanning ? 'grabbing' : 'default', touchAction: 'none', overscrollBehavior: 'none' }}
        >
          <div
            ref={contentRef}
            className="origin-top-left"
            style={{
              width: contentWidth,
              height: contentHeight,
              transform: `translate(${canvasState.translateX}px, ${canvasState.translateY}px) scale(${canvasState.scale})`,
              transition: isPanning ? 'none' : 'transform 0.1s ease-out',
              position: 'relative',
            }}
          >
            {treeRoots.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <ColumnHeaders activeColumns={activeColumns} totalHeight={contentHeight} />
                {layoutData.trees.map((tree, treeIdx) => (
                  <TreeRenderer
                    key={treeRoots[treeIdx].id}
                    nodes={tree.nodes}
                    yOffset={tree.yOffset}
                    selectedId={selectedId}
                    highlightedIds={highlightedIds}
                    isFiltering={isFiltering}
                    onNodeClick={handleNodeClick}
                    onNodeDoubleClick={handleNodeDoubleClick}
                    onNodeHover={handleNodeHover}
                    onNodeHoverEnd={handleNodeHoverEnd}
                    dragSourceId={dragState?.isDragging ? dragState.sourceNode.id : null}
                    validTargets={validTargets}
                    isDragging={!!dragState?.isDragging}
                    onDragStart={handleDragPointerDown}
                    onDragHoverEnter={(node) => { hoveredDropTarget.current = node; setHoveredDropTargetId(node.id); }}
                    onDragHoverLeave={() => { hoveredDropTarget.current = null; setHoveredDropTargetId(null); }}
                    hoveredTargetId={hoveredDropTargetId}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-1 z-10">
          <button
            onClick={() => handleZoom(-ZOOM_STEP)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
            title="Zoom out"
          >
            <Minus size={14} />
          </button>
          <span className="text-[11px] font-medium text-gray-500 w-10 text-center tabular-nums">
            {Math.round(canvasState.scale * 100)}%
          </span>
          <button
            onClick={() => handleZoom(ZOOM_STEP)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
            title="Zoom in"
          >
            <Plus size={14} />
          </button>
          <div className="w-px h-4 bg-gray-200 mx-0.5" />
          <button
            onClick={handleFitToScreen}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
            title="Fit to screen"
          >
            <Maximize2 size={14} />
          </button>
        </div>



      </div>
      )}

      <FloatingAIChatBubble onNavigate={onAIChatNavigate} />

      {hoveredNode && !dragState?.isDragging && (
        <NodeTooltip
          node={hoveredNode.node}
          x={hoveredNode.x}
          y={hoveredNode.y}
          nodeLeft={hoveredNode.nodeLeft}
          ownerName={hoveredNode.node.type === 'box' ? boxOwnerNameMap[hoveredNode.node.id] : undefined}
          accessLevel={hoveredNode.node.type === 'box' ? (boxAccessMap[hoveredNode.node.id] || 'open') : undefined}
        />
      )}

      {showQRScanner && workspace && (
        <QRScannerModal
          workspaceId={workspace.id}
          onNavigateToBox={(locationId, boxId, boxName, boxAccentColor, boxType) => {
            setShowQRScanner(false);
            onNavigateToBox(locationId, boxId, boxName, boxAccentColor, boxType);
          }}
          onClose={() => setShowQRScanner(false)}
        />
      )}

      {dragState?.isDragging && (
        <Portal>
          <div
            className="fixed pointer-events-none z-50 flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-xl border border-blue-200 opacity-90"
            style={{
              left: dragState.currentX,
              top: dragState.currentY,
              transform: 'translate(-50%, -50%)',
              maxWidth: 200,
            }}
          >
            <SvgIcon iconId={getIconForNode(dragState.sourceNode)} size={14} />
            <span className="text-sm font-medium text-gray-900 truncate">{dragState.sourceNode.name}</span>
          </div>
        </Portal>
      )}

      {dropConfirm && (
        <DragDropConfirmModal
          data={dropConfirm}
          onConfirm={async () => {
            const result = await executeTransfer();
            if (result?.success) {
              setToast({ message: `"${dropConfirm.sourceNode.name}" moved successfully`, type: 'success' });
            } else {
              setToast({ message: `Failed to move "${dropConfirm.sourceNode.name}"`, type: 'error' });
            }
          }}
          onCancel={cancelConfirm}
          isProcessing={isProcessing}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

// ─── Column Headers ─────────────────────────────────────────────────────────────

function ColumnHeaders({ activeColumns, totalHeight }: { activeColumns: ActiveColumns; totalHeight: number }) {
  return (
    <>
      {activeColumns.defs.map((def, i) => {
        const x = activeColumns.positions[i];
        const centerX = x + def.width / 2;
        return (
          <React.Fragment key={i}>
            <div
              className="absolute top-0 pointer-events-none"
              style={{
                left: x - 8,
                width: def.width + 16,
                height: totalHeight,
                backgroundColor: '#6b728008',
                borderRadius: '8px',
              }}
            />
            <div
              className="absolute flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md pointer-events-none"
              style={{
                left: centerX,
                top: 0,
                transform: 'translateX(-50%)',
                backgroundColor: '#6b728012',
                borderBottom: '2px solid #6b728030',
              }}
            >
              <span
                className="text-[10px] font-semibold uppercase tracking-wider text-gray-500"
              >
                {def.label}
              </span>
            </div>
            {i < activeColumns.defs.length - 1 && (
              <div
                className="absolute top-8 pointer-events-none"
                style={{
                  left: x + def.width + 40 - 0.5,
                  width: 1,
                  height: totalHeight - 8,
                  background: 'linear-gradient(to bottom, #6b728020, transparent)',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ─── Stats Strip ────────────────────────────────────────────────────────────────

interface StatsStripProps {
  stats: { box_count: number; folder_count: number; item_count: number; expiring_soon_count: number; low_stock_count: number };
  isLoading: boolean;
  onOpenExpirationView: (initialLocationFilter?: string) => void;
  onOpenLowStockView: (initialLocationFilter?: string) => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

function StatsStrip({ stats, isLoading, onOpenExpirationView, onOpenLowStockView, searchTerm, onSearchChange }: StatsStripProps) {
  if (isLoading) {
    return (
      <div className="border-b border-gray-100 px-4 md:px-6 py-2 flex items-center gap-3 overflow-x-auto">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-24 bg-gray-100 rounded-lg animate-pulse flex-shrink-0" />
        ))}
      </div>
    );
  }

  const statItems = [
    { label: 'Boxes', value: stats.box_count },
    { label: 'Sheets', value: stats.folder_count },
    { label: 'Items', value: stats.item_count },
    { label: 'Expired', value: stats.expiring_soon_count, onClick: () => onOpenExpirationView() },
    { label: 'Low Stock', value: stats.low_stock_count, onClick: () => onOpenLowStockView() },
  ];

  return (
    <div className="border-b border-gray-100 bg-gray-50/50 px-4 md:px-6 py-2 flex flex-wrap items-center gap-2">
      {statItems.map(item => {
        const isClickable = !!item.onClick;
        return (
          <button
            key={item.label}
            onClick={item.onClick}
            disabled={!isClickable}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-shrink-0 transition-all bg-gray-100 ${
              isClickable
                ? 'hover:shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                : 'cursor-default'
            }`}
          >
            <span className="text-[12px] font-semibold tabular-nums text-gray-700">{item.value}</span>
            <span className="text-[11px] text-gray-500">{item.label}</span>
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-1 bg-white rounded-lg border border-gray-200 px-2 py-1 flex-shrink-0">
        <Search size={13} className="text-gray-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-28 md:w-36 text-[12px] bg-transparent outline-none text-gray-700 placeholder-gray-400"
        />
        {searchTerm && (
          <button onClick={() => onSearchChange('')} className="p-0.5 hover:bg-gray-100 rounded">
            <X size={12} className="text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────────

function Header({ onMobileMenuToggle, viewMode, onViewModeChange }: { onMobileMenuToggle?: () => void; viewMode: OverviewViewMode; onViewModeChange: (mode: OverviewViewMode) => void }) {
  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-3 md:px-6 py-3 flex items-center gap-1.5 md:gap-3 w-full max-w-full overflow-hidden">
      {onMobileMenuToggle && (
        <button onClick={onMobileMenuToggle} className="md:hidden p-1.5 -ml-1.5 text-gray-500 hover:text-gray-700 flex-shrink-0">
          <Menu size={20} />
        </button>
      )}
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <LayoutDashboard size={20} className="text-blue-600 flex-shrink-0" />
        <h1 className="text-base md:text-lg font-semibold text-gray-900 truncate">Inventory Overview</h1>
      </div>
      <div className="flex-shrink-0 flex items-center bg-gray-100 rounded-lg p-0.5">
        <button
          onClick={() => onViewModeChange('tree')}
          className={`flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            viewMode === 'tree'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <GitBranch size={14} />
          <span className="hidden sm:inline">Tree</span>
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={`flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            viewMode === 'list'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <List size={14} />
          <span className="hidden sm:inline">Inventory</span>
        </button>
      </div>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
        <MapPin size={20} className="text-gray-400" />
      </div>
      <h3 className="text-sm font-medium text-gray-700 mb-1">No locations yet</h3>
      <p className="text-xs text-gray-500 max-w-xs">
        Create your first location from the sidebar.
      </p>
    </div>
  );
}

// ─── Edge Path Builder ─────────────────────────────────────────────────────────

function buildRoutedEdgePath(edge: ResolvedEdge): string {
  const { startX, startY, waypoints, endX, endY } = edge;

  if (waypoints.length === 0) {
    const midX = startX + (endX - startX) / 2;
    return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
  }

  let d = `M ${startX} ${startY}`;

  const firstWp = waypoints[0];
  const entryX = firstWp.x;
  const entryY = firstWp.y;
  const midX1 = startX + (entryX - startX) / 2;
  d += ` C ${midX1} ${startY}, ${midX1} ${entryY}, ${entryX} ${entryY}`;

  const exitX = firstWp.x + firstWp.width;
  d += ` L ${exitX} ${entryY}`;

  for (let i = 1; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const wpEntryX = wp.x;
    const wpEntryY = wp.y;
    const prevExitX = waypoints[i - 1].x + waypoints[i - 1].width;
    const prevExitY = waypoints[i - 1].y;
    const mid = prevExitX + (wpEntryX - prevExitX) / 2;
    d += ` C ${mid} ${prevExitY}, ${mid} ${wpEntryY}, ${wpEntryX} ${wpEntryY}`;

    const wpExitX = wp.x + wp.width;
    d += ` L ${wpExitX} ${wpEntryY}`;
  }

  const lastWp = waypoints[waypoints.length - 1];
  const lastExitX = lastWp.x + lastWp.width;
  const lastExitY = lastWp.y;
  const midX2 = lastExitX + (endX - lastExitX) / 2;
  d += ` C ${midX2} ${lastExitY}, ${midX2} ${endY}, ${endX} ${endY}`;

  return d;
}

// ─── Tree Renderer ──────────────────────────────────────────────────────────────

interface TreeRendererProps {
  nodes: PositionedNode[];
  yOffset: number;
  selectedId: string | null;
  highlightedIds: Set<string> | null;
  isFiltering: boolean;
  onNodeClick: (e: React.MouseEvent, nodeId: string) => void;
  onNodeDoubleClick: (e: React.MouseEvent, node: TreeNode) => void;
  onNodeHover: (node: TreeNode, rect: DOMRect) => void;
  onNodeHoverEnd: () => void;
  dragSourceId: string | null;
  validTargets: Set<string> | null;
  isDragging: boolean;
  onDragStart: (node: TreeNode, clientX: number, clientY: number) => void;
  onDragHoverEnter: (node: TreeNode) => void;
  onDragHoverLeave: () => void;
  hoveredTargetId: string | null;
}

function TreeRenderer({
  nodes, yOffset, selectedId, highlightedIds, isFiltering,
  onNodeClick, onNodeDoubleClick, onNodeHover, onNodeHoverEnd,
  dragSourceId, validTargets, isDragging, onDragStart, onDragHoverEnter, onDragHoverLeave, hoveredTargetId,
}: TreeRendererProps) {
  const resolvedEdges = useMemo(() => computeResolvedEdges(nodes), [nodes]);

  const bounds = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    for (const n of nodes) {
      const right = n.x + n.width;
      const bottom = n.y + n.height;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    }
    return { width: maxX + 20, height: maxY + 20 };
  }, [nodes]);

  return (
    <div
      className="absolute left-0 top-0"
      style={{ transform: `translateY(${yOffset}px)`, width: bounds.width, height: bounds.height }}
    >
      <svg
        className="absolute left-0 top-0 pointer-events-none"
        width={bounds.width}
        height={bounds.height}
        style={{ overflow: 'visible' }}
      >
        {resolvedEdges.map(edge => {
          const edgeColor = edge.accentColor || '#94a3b8';
          const isDimmed = isFiltering && highlightedIds && !highlightedIds.has(edge.targetNodeId);
          const pathD = buildRoutedEdgePath(edge);

          return (
            <g key={edge.id} style={{ opacity: isDimmed ? 0.15 : 1, transition: 'opacity 0.3s ease' }}>
              <path
                d={pathD}
                fill="none"
                stroke={edgeColor}
                strokeWidth="1.5"
                strokeDasharray="6 4"
                strokeOpacity={0.5}
                className="animate-flow-dash"
              />
            </g>
          );
        })}
      </svg>

      {nodes.map(n => n.node.isGhost ? null : (
        <NodePill
          key={n.node.id}
          positioned={n}
          isSelected={selectedId === n.node.id}
          isHighlighted={highlightedIds ? highlightedIds.has(n.node.id) : false}
          isFiltering={isFiltering}
          isDragSource={dragSourceId === n.node.id}
          isValidTarget={validTargets !== null && validTargets.has(n.node.id)}
          isInvalidDuringDrag={isDragging && validTargets !== null && !validTargets.has(n.node.id) && dragSourceId !== n.node.id}
          isHoveredTarget={hoveredTargetId === n.node.id}
          onClick={onNodeClick}
          onDoubleClick={onNodeDoubleClick}
          onHover={onNodeHover}
          onHoverEnd={onNodeHoverEnd}
          onDragStart={onDragStart}
          onDragHoverEnter={onDragHoverEnter}
          onDragHoverLeave={onDragHoverLeave}
          isDragging={isDragging}
        />
      ))}
    </div>
  );
}

// ─── Node Styles ────────────────────────────────────────────────────────────────

const depthShadows: Record<number, string> = {
  0: 'shadow-md',
  1: 'shadow-sm',
  2: 'shadow-sm',
};

function getNodeBackground(node: TreeNode): string {
  if (node.type === 'location') {
    const lt = node.locationType || 'general';
    if (lt.includes('freezer') || lt.includes('cold')) return 'bg-gradient-to-r from-blue-50 to-white';
    if (lt.includes('room') || lt.includes('cabinet') || lt.includes('shelf')) return 'bg-gradient-to-r from-amber-50/60 to-white';
    return 'bg-gradient-to-r from-gray-50 to-white';
  }
  if (node.type === 'sublocation') return 'bg-gray-50';
  if (node.type === 'box') return 'bg-blue-50/60';
  if (node.type === 'folder') return 'bg-teal-50/60';
  return 'bg-white';
}

const nodeTextStyles: Record<TreeNodeType, { text: string; font: string }> = {
  location: { text: 'text-gray-900', font: 'text-[15px] font-semibold' },
  sublocation: { text: 'text-gray-800', font: 'text-[13px] font-medium' },
  position: { text: 'text-gray-700', font: 'text-[11px] font-medium' },
  box: { text: 'text-gray-700', font: 'text-[11px] font-medium' },
  folder: { text: 'text-gray-700', font: 'text-[11px] font-medium' },
};

const nodeBorders: Record<TreeNodeType, string> = {
  location: 'border-gray-200',
  sublocation: 'border-gray-200',
  position: 'border-gray-200',
  box: 'border-blue-200/70',
  folder: 'border-teal-200/70',
};

function getIconForNode(node: TreeNode): string | null {
  if (node.iconId) return node.iconId;
  switch (node.type) {
    case 'location':
    case 'sublocation':
    case 'position':
      return getDefaultIconForContext('location');
    case 'box':
      return getDefaultIconForContext('box');
    case 'folder':
      return getDefaultIconForContext('folder');
    default:
      return getDefaultIconForContext('location');
  }
}

// ─── Node Pill ──────────────────────────────────────────────────────────────────

interface NodePillProps {
  positioned: PositionedNode;
  isSelected: boolean;
  isHighlighted: boolean;
  isFiltering: boolean;
  isDragSource: boolean;
  isValidTarget: boolean;
  isInvalidDuringDrag: boolean;
  isHoveredTarget: boolean;
  onClick: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, node: TreeNode) => void;
  onHover: (node: TreeNode, rect: DOMRect) => void;
  onHoverEnd: () => void;
  onDragStart: (node: TreeNode, clientX: number, clientY: number) => void;
  onDragHoverEnter: (node: TreeNode) => void;
  onDragHoverLeave: () => void;
  isDragging: boolean;
}

function NodePill({
  positioned, isSelected, isHighlighted, isFiltering,
  isDragSource, isValidTarget, isInvalidDuringDrag, isHoveredTarget,
  onClick, onDoubleClick, onHover, onHoverEnd,
  onDragStart, onDragHoverEnter, onDragHoverLeave, isDragging,
}: NodePillProps) {
  const { node, x, y, width, height } = positioned;
  const pillRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textStyle = nodeTextStyles[node.type];
  const border = nodeBorders[node.type];
  const bg = getNodeBackground(node);
  const accentColor = node.accentColor || undefined;
  const iconSize = node.type === 'location' ? 22 : node.type === 'sublocation' ? 18 : 14;
  const iconContainerSize = node.type === 'location' ? 'w-8 h-8' : node.type === 'sublocation' ? 'w-7 h-7' : 'w-6 h-6';
  const shadow = depthShadows[node.depth] || '';

  const isDimmed = (isFiltering && !isHighlighted) || isInvalidDuringDrag;
  const showPulse = isFiltering && isHighlighted && !isDragging;

  const handleMouseEnter = () => {
    if (isDragging) {
      if (isValidTarget) onDragHoverEnter(node);
      return;
    }
    if (pillRef.current) {
      onHover(node, pillRef.current.getBoundingClientRect());
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      onDragHoverLeave();
      return;
    }
    onHoverEnd();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.altKey) return;
    if (e.pointerType === 'touch') {
      const startX = e.clientX;
      const startY = e.clientY;
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        onDragStart(node, startX, startY);
      }, 500);
      return;
    }
    onDragStart(node, e.clientX, e.clientY);
  };

  const handlePointerUpOrCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleNodePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const extraBorder = isHoveredTarget
    ? 'ring-2 ring-green-400 border-green-400 shadow-lg scale-[1.02]'
    : isValidTarget
      ? 'ring-1 ring-blue-300 border-blue-300'
      : '';

  return (
    <div
      ref={pillRef}
      className={`absolute flex items-center gap-2 px-2.5 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md select-none ${bg} ${border} ${shadow} ${
        isDragSource ? 'opacity-40 ring-2 ring-blue-300 border-blue-300' :
        isSelected && !isDragging ? 'ring-2 ring-blue-400 border-blue-400 shadow-md' : 'hover:border-gray-300'
      } ${extraBorder} ${showPulse ? 'animate-pulse-ring' : ''}`}
      style={{
        left: x,
        top: y,
        width,
        height,
        borderLeftWidth: accentColor && (node.type === 'location' || node.type === 'sublocation' || node.type === 'position') ? '3px' : undefined,
        borderLeftColor: accentColor && (node.type === 'location' || node.type === 'sublocation' || node.type === 'position') ? accentColor : undefined,
        opacity: isDragSource ? 0.4 : isDimmed ? 0.25 : 1,
        transition: 'opacity 0.3s ease, box-shadow 0.2s ease, transform 0.15s ease',
        pointerEvents: isDragSource ? 'none' : undefined,
      }}
      onClick={(e) => { if (!isDragging) onClick(e, node.id); }}
      onDoubleClick={(e) => { if (!isDragging) onDoubleClick(e, node); }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={handleNodePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
    >
      <div
        className={`flex-shrink-0 ${iconContainerSize} rounded-full flex items-center justify-center`}
        style={{
          backgroundColor: accentColor ? `${accentColor}20` : '#f3f4f6',
        }}
      >
        <SvgIcon iconId={getIconForNode(node)} size={iconSize} />
      </div>
      <span className={`truncate ${textStyle.font} ${textStyle.text}`}>
        {node.name}
      </span>

    </div>
  );
}

// ─── Node Tooltip ───────────────────────────────────────────────────────────────

interface NodeTooltipProps {
  node: TreeNode;
  x: number;
  y: number;
  nodeLeft: number;
  ownerName?: string;
  accessLevel?: string;
}

function NodeTooltip({ node, x, y, nodeLeft, ownerName, accessLevel }: NodeTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ ready: boolean; top: number; left?: number; right?: number }>({ ready: false, top: y });

  const GAP = 8;

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const actualW = rect.width;
    const actualH = rect.height;

    const fitsRight = x + actualW <= window.innerWidth - 16;

    let top = y - actualH / 2;
    if (top < 8) top = 8;
    if (top + actualH > window.innerHeight - 8) {
      top = window.innerHeight - actualH - 8;
    }

    if (fitsRight) {
      setPos({ ready: true, top, left: x });
    } else {
      setPos({ ready: true, top, right: window.innerWidth - nodeLeft + GAP });
    }
  }, [x, y, nodeLeft]);

  const typeLabels: Record<TreeNodeType, string> = {
    location: 'Location',
    sublocation: 'Sub-location',
    position: 'Position',
    box: 'Storage Box',
    folder: 'Item Sheet',
  };

  const typeColors: Record<TreeNodeType, string> = {
    location: '#3b82f6',
    sublocation: '#06b6d4',
    position: '#6b7280',
    box: '#f59e0b',
    folder: '#14b8a6',
  };

  return (
    <Portal>
      <div
        ref={tooltipRef}
        className={`fixed z-[9999] pointer-events-none ${pos.ready ? 'animate-tooltip-in' : ''}`}
        style={{ visibility: pos.ready ? 'visible' : 'hidden', top: pos.top, ...(pos.left != null ? { left: pos.left } : { right: pos.right }) }}
      >
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-3 min-w-[180px] max-w-[260px]">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: typeColors[node.type] }}
            />
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              {typeLabels[node.type]}
            </span>
          </div>

          <h4 className="text-[13px] font-semibold text-gray-900 mb-1.5 break-words">
            {node.name}
          </h4>



          {node.type === 'box' && ownerName && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <User size={10} className="text-gray-400 flex-shrink-0" />
              <span className="text-[11px] text-gray-500 truncate">Owner: {ownerName}</span>
            </div>
          )}

          {node.type === 'box' && accessLevel === 'none' && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lock size={10} className="text-red-400 flex-shrink-0" />
              <span className="text-[11px] text-red-500 font-medium">No access</span>
            </div>
          )}

          {node.childCount > 0 && (
            <div className="text-[11px] text-gray-500 mb-1">
              {node.childCount} {node.childCount === 1 ? 'child' : 'children'}
            </div>
          )}

          {node.type === 'box' && node.utilizationPercent !== undefined && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">Utilization</span>
                <span className="text-[11px] font-medium text-gray-700">
                  {node.occupiedCells}/{node.totalCells} ({Math.round(node.utilizationPercent)}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${node.utilizationPercent}%`,
                    backgroundColor: node.utilizationPercent > 80 ? '#ef4444' : node.utilizationPercent > 50 ? '#f59e0b' : '#22c55e',
                  }}
                />
              </div>
            </div>
          )}

          {node.type === 'folder' && node.itemCount !== undefined && (
            <div className="mt-1.5 text-[11px] text-gray-500">
              {node.itemCount} {node.itemCount === 1 ? 'item' : 'items'}
            </div>
          )}

          <div className="mt-2 pt-1.5 border-t border-gray-100 text-[10px] text-gray-400">
            {node.type === 'box' && accessLevel === 'none' ? 'Access restricted' : 'Double-click to open'}
          </div>
        </div>
      </div>
    </Portal>
  );
}

export default InventoryOverviewPage;
