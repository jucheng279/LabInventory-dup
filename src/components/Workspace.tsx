import React, { useState, useRef, useEffect } from 'react';
import { Plus, Package, Table2, Menu, ChevronRight, ArrowLeft, LayoutGrid, List, Tag } from 'lucide-react';
import DnaLoader from './DnaLoader';
import { getLocationIconId } from '../config/locationTypes';
import SvgIcon from './SvgIcon';
import { LocationBoxWithStats, CreateBoxData, UpdateBoxData, BoxType, boxService } from '../services/boxService';
import { slideBoxHeaderService, SlideBoxHeader } from '../services/slideBoxHeaderService';
import type { HeaderInput } from '../services/slideBoxHeaderService';
import { itemFolderHeaderService } from '../services/itemFolderHeaderService';
import type { FolderHeaderInput } from '../services/itemFolderHeaderService';
import { InventoryItem } from '../services/itemService';
import type { ItemFolderWithStats, ItemFolderHeader, UpdateItemData } from '../types/database';
import { LocationWithStats } from '../services/locationManagerService';
import {
  useWorkspaceData,
  useCreateBox,
  useUpdateBox,
  useDeleteBox,
  useDuplicateBox,
  useMoveBox,
  useAdjustStock,
  useAdjustFreezeThaw,
  useDeleteItem,
  useMoveItem,
  useReorderBoxes,
} from '../hooks/useWorkspaceData';
import {
  useCreateItemFolder,
  useUpdateItemFolder,
  useDeleteItemFolder,
  useMoveItemFolder,
  useReorderItemFolders,
  useItemFolderHeaders,
  useFolderItems,
  useFolderCustomValues,
  useCreateItemInFolder,
  useUpdateItemInFolder,
  useReorderFolderItems,
  useStandaloneItems,
  useCreateStandaloneItem,
  useUpdateStandaloneItem,
} from '../hooks/useItemFolderData';
import { useSublocations } from '../hooks/useSublocationData';
import { usePositions } from '../hooks/usePositionData';
import { useSyncContext } from '../contexts/SyncContext';
import LocationCard from './LocationCard';
import BoxCard from './BoxCard';
import BoxTypeSelectionModal from './BoxTypeSelectionModal';
import CreateBoxModal from './CreateBoxModal';
import CreateSlideBoxModal from './CreateSlideBoxModal';
import CreateStructuredFreezerBoxModal from './CreateStructuredFreezerBoxModal';
import EditBoxModal from './EditBoxModal';
import EditSlideBoxModal from './EditSlideBoxModal';
import EditStructuredFreezerBoxModal from './EditStructuredFreezerBoxModal';
import DeleteBoxModal from './DeleteBoxModal';
import ItemFolderCard from './ItemFolderCard';
import ItemCard from './ItemCard';
import CreateItemFolderModal from './CreateItemFolderModal';
import EditItemFolderModal from './EditItemFolderModal';
import DeleteItemFolderModal from './DeleteItemFolderModal';
import CreateItemModal from './CreateItemModal';
import CreateStandaloneItemModal from './CreateStandaloneItemModal';
import EditItemModal from './EditItemModal';
import ItemDetailModal from './ItemDetailModal';
import DeleteItemModal from './DeleteItemModal';
import MoveToLocationModal from './MoveToLocationModal';
import AddToProjectModal from './AddToProjectModal';
import ItemListView from './ItemListView';
import QRScannerModal from './QRScannerModal';
import Toast from './Toast';
import SearchBox from './SearchBox';
import { useItemLinks } from '../hooks/useBoxItemLinks';
import { boxItemLinkService } from '../services/boxItemLinkService';
import { getClient } from '../lib/supabase';
import type { BoxGridItemLink } from '../types/database';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useTeamMembers } from '../hooks/useTeam';
import { useAddBoxToProject, useAddItemToProject } from '../hooks/useProjectLinks';
import { useBatchBoxAccess } from '../hooks/useBoxPrivacy';
import { upsertBoxPrivacy } from '../services/boxPrivacyService';
import { privacyFormToAccessEntries } from './BoxPrivacySettingsModal';
import type { PrivacyFormState } from './BoxPrivacySettingsModal';

interface WorkspaceProps {
  locationId: string;
  locationName: string;
  locationAccentColor?: string | null;
  locationLocationType?: string;
  showStorageBoxes: boolean;
  showInventoryItems: boolean;
  sublocationId: string | null;
  sublocationName: string | null;
  sublocationAccentColor: string | null;
  sublocationLocationType?: string | null;
  sublocationIconId?: string | null;
  positionId: string | null;
  positionName: string | null;
  positionAccentColor: string | null;
  positionLocationType?: string | null;
  positionIconId?: string | null;
  locations: LocationWithStats[];
  onOpenBox: (boxId: string, boxName: string, boxAccentColor?: string | null, boxType?: BoxType) => void;
  onMobileMenuToggle: () => void;
  onNavigateToBox: (locationId: string, boxId: string, boxName: string, boxAccentColor: string | null, boxType?: BoxType, highlightCellId?: string, highlightColumn?: number) => void;
  onNavigateToLocation: (locationId: string) => void;
  onClearSublocation: () => void;
  onClearPosition: () => void;
  onOpenSearchPage?: (query: string, dateFilter: import('../types/search').DateFilter | null, filterState: import('../types/search').SearchFilterState | null) => void;
  hasPersistedSearch?: boolean;
  initialSearchQuery?: string;
  initialSearchDateFilter?: import('../types/search').DateFilter | null;
  initialSearchFilterState?: import('../types/search').SearchFilterState | null;
  onSearchBoxStateChange?: (query: string, dateFilter: import('../types/search').DateFilter | null, filterState: import('../types/search').SearchFilterState | null) => void;
  autoOpenFirstItemFolder?: boolean;
  initialFolderId?: string | null;
  highlightItemId?: string | null;
  isSheetView?: boolean;
  onBackFromSheet?: () => void;
  onOpenSheet?: (sheetId: string, sheetName: string, sheetAccentColor?: string | null) => void;
  onSelectSublocation?: (locationId: string, sublocationId: string, name: string, accentColor: string | null, locationType: string, iconId: string | null) => void;
  onSelectPosition?: (locationId: string, sublocationId: string, sublocationName: string, sublocationAccentColor: string | null, sublocationLocationType: string, sublocationIconId: string | null, positionId: string, positionName: string, positionAccentColor: string | null, positionLocationType: string, positionIconId: string | null) => void;
  skipEntranceAnimation?: boolean;
  tutorialModalRef?: React.MutableRefObject<{
    showBoxTypeSelection?: () => void;
    showCreateBox?: (boxType: 'freezer' | 'slide' | 'structured_freezer') => void;
    showCreateSlideBox?: () => void;
    showCreateItemFolder?: () => void;
    showCreateItem?: (folderId: string) => void;
    setInitialFolder?: (folderId: string) => void;
    closeAll?: () => void;
  }>;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

const Workspace: React.FC<WorkspaceProps> = ({
  locationId,
  locationName,
  locationAccentColor,
  locationLocationType,
  showStorageBoxes,
  showInventoryItems,
  sublocationId,
  sublocationName,
  sublocationAccentColor,
  sublocationLocationType,
  sublocationIconId,
  positionId,
  positionName,
  positionAccentColor,
  positionLocationType,
  positionIconId,
  locations,
  onOpenBox,
  onMobileMenuToggle,
  onNavigateToBox,
  onNavigateToLocation,
  onClearSublocation,
  onClearPosition,
  onOpenSearchPage,
  hasPersistedSearch,
  initialSearchQuery,
  initialSearchDateFilter,
  initialSearchFilterState,
  onSearchBoxStateChange,
  autoOpenFirstItemFolder,
  initialFolderId,
  highlightItemId,
  isSheetView,
  onBackFromSheet,
  onOpenSheet,
  onSelectSublocation,
  onSelectPosition,
  skipEntranceAnimation,
  tutorialModalRef,
}) => {
  const locationColor = locationAccentColor || '#3b82f6';
  const accentColor = positionId
    ? (positionAccentColor || '#6b7280')
    : sublocationId
      ? (sublocationAccentColor || '#6b7280')
      : locationColor;
  const selectedLocation = locations.find(f => f.id === locationId);
  const locationIconId = selectedLocation?.icon_id || getLocationIconId(locationLocationType);
  const resolvedSublocationIconId = sublocationIconId || getLocationIconId(sublocationLocationType);
  const resolvedPositionIconId = positionIconId || getLocationIconId(positionLocationType);

  const { hierarchicalNavigation } = useSyncContext();
  const { teamMember, workspace } = useAuth();
  const { data: teamMembers = [] } = useTeamMembers();
  const { boxes, folders, isLoading } = useWorkspaceData(locationId, sublocationId, positionId, hierarchicalNavigation);
  const boxIds = boxes.map(b => b.id);
  const { data: boxAccessMap = {} } = useBatchBoxAccess(boxIds);
  const { data: sublocations = [], isLoading: isSublocationsLoading } = useSublocations(locationId);
  const positionsQuery = usePositions(sublocationId || '');
  const positions = positionsQuery.data ?? [];
  const isPositionsLoading = positionsQuery.isLoading;

  const createBoxMutation = useCreateBox(locationId, sublocationId, positionId);
  const updateBoxMutation = useUpdateBox(locationId);
  const deleteBoxMutation = useDeleteBox(locationId);
  const duplicateBoxMutation = useDuplicateBox(locationId);
  const moveBoxMutation = useMoveBox(locationId);
  const adjustStockMutation = useAdjustStock(locationId);
  const adjustFreezeThawMutation = useAdjustFreezeThaw(locationId);
  const deleteItemMutation = useDeleteItem(locationId);
  const moveItemMutation = useMoveItem(locationId);
  const reorderBoxesMutation = useReorderBoxes(locationId);

  const [activeFolder, setActiveFolder] = useState<ItemFolderWithStats | null>(null);
  const highlightCardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlightItemId && highlightCardRef.current) {
      highlightCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightItemId, activeFolder]);
  const prevLocationKeyRef = useRef<string>('');
  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    const locationKey = `${locationId}|${sublocationId}|${positionId}`;
    if (locationKey !== prevLocationKeyRef.current) {
      prevLocationKeyRef.current = locationKey;
      hasAutoOpenedRef.current = false;
      setActiveFolder(null);
    }
  }, [locationId, sublocationId, positionId]);

  useEffect(() => {
    if (autoOpenFirstItemFolder && showInventoryItems && !isLoading && folders.length > 0 && !activeFolder && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      setActiveFolder(folders[0]);
    }
  }, [autoOpenFirstItemFolder, showInventoryItems, isLoading, folders, activeFolder]);

  const initialFolderAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialFolderId && !isLoading && folders.length > 0 && initialFolderAppliedRef.current !== initialFolderId) {
      const target = folders.find(f => f.id === initialFolderId);
      if (target) {
        initialFolderAppliedRef.current = initialFolderId;
        hasAutoOpenedRef.current = true;
        setActiveFolder(target);
      }
    }
  }, [initialFolderId, isLoading, folders]);

  useEffect(() => {
    if (!isSheetView) {
      initialFolderAppliedRef.current = null;
    }
  }, [isSheetView]);

  const createFolderMutation = useCreateItemFolder(locationId, sublocationId, positionId);
  const updateFolderMutation = useUpdateItemFolder(locationId);
  const deleteFolderMutation = useDeleteItemFolder(locationId);
  const moveFolderMutation = useMoveItemFolder(locationId);
  const reorderFoldersMutation = useReorderItemFolders(locationId);

  const { data: activeFolderHeaders = [] } = useItemFolderHeaders(activeFolder?.id || null);
  const { data: folderItems = [], isLoading: isFolderItemsLoading } = useFolderItems(activeFolder?.id || null);
  const { data: folderCustomValues = {} } = useFolderCustomValues(activeFolder?.id || null);

  const createItemInFolderMutation = useCreateItemInFolder(
    locationId,
    activeFolder?.id || '',
    sublocationId,
    positionId,
  );
  const updateItemInFolderMutation = useUpdateItemInFolder(locationId, activeFolder?.id || '');
  const reorderFolderItemsMutation = useReorderFolderItems(locationId, activeFolder?.id || '');
  const { data: standaloneItems = [], isLoading: isStandaloneItemsLoading } = useStandaloneItems(locationId, sublocationId || null, positionId || null);
  const createStandaloneItemMutation = useCreateStandaloneItem(locationId, sublocationId || null, positionId || null);

  const allItemIds = React.useMemo(
    () => [...folderItems.map(i => i.id), ...standaloneItems.map(i => i.id)],
    [folderItems, standaloneItems],
  );
  const { data: itemLinksArray = [] } = useItemLinks(allItemIds);
  const itemLinksMap = React.useMemo(() => {
    const map: Record<string, BoxGridItemLink> = {};
    for (const link of itemLinksArray) {
      map[link.item_id] = link;
    }
    return map;
  }, [itemLinksArray]);

  const queryClient = useQueryClient();

  const handleLinkedDecrement = async (link: BoxGridItemLink) => {
    try {
      const crossedCellId = await boxItemLinkService.crossLastLinkedCell(
        link.box_id,
        link.linked_name,
        link.linked_info,
        link.link_type,
        link.linked_date || null,
        link.linked_date_type || 'none',
      );
      if (crossedCellId) {
        await boxItemLinkService.syncAllForBox(link.box_id);
      }
      queryClient.invalidateQueries({ queryKey: ['cells', link.box_id] });
      queryClient.invalidateQueries({ queryKey: ['boxItemLinks', link.box_id] });
      queryClient.invalidateQueries({ queryKey: ['folderItems'] });
      queryClient.invalidateQueries({ queryKey: ['standaloneItems'] });
      queryClient.invalidateQueries({ queryKey: ['lowStock'] });
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      queryClient.invalidateQueries({ queryKey: ['itemLinks'] });
    } catch (error) {
      console.error('Failed to cross linked cell:', error);
      setToast({ message: 'Failed to update linked stock', type: 'error' });
    }
  };

  const handleUnlinkItem = async (linkId: string) => {
    try {
      await boxItemLinkService.deleteLink(linkId);
      queryClient.invalidateQueries({ queryKey: ['folderItems'] });
      queryClient.invalidateQueries({ queryKey: ['standaloneItems'] });
      queryClient.invalidateQueries({ queryKey: ['itemLinks'] });
      queryClient.invalidateQueries({ queryKey: ['boxItemLinks'] });
    } catch (error) {
      console.error('Failed to unlink item:', error);
      setToast({ message: 'Failed to unlink item', type: 'error' });
    }
  };

  const handleNavigateToLinkedBox = async (link: BoxGridItemLink) => {
    try {
      const box = await boxService.getBoxById(link.box_id);
      if (!box) {
        setToast({ message: 'Linked box not found', type: 'error' });
        return;
      }
      const firstCellId = await boxItemLinkService.getFirstLinkedCellId(
        link.box_id,
        link.linked_name,
        link.linked_info,
        link.link_type,
      );
      onNavigateToBox(box.location_id, box.id, box.name, box.accent_color, box.box_type, firstCellId || undefined);
    } catch (error) {
      console.error('Failed to navigate to linked box:', error);
      setToast({ message: 'Failed to navigate to linked box', type: 'error' });
    }
  };

  const [draggedBoxId, setDraggedBoxId] = useState<string | null>(null);
  const [boxDropIndicator, setBoxDropIndicator] = useState<{ index: number; position: 'before' | 'after' } | null>(null);
  const dragBoxNodeRef = useRef<HTMLDivElement | null>(null);

  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [folderDropIndicator, setFolderDropIndicator] = useState<{ index: number; position: 'before' | 'after' } | null>(null);
  const dragFolderNodeRef = useRef<HTMLDivElement | null>(null);

  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [itemDropIndicator, setItemDropIndicator] = useState<{ index: number; position: 'before' | 'after' } | null>(null);
  const dragItemNodeRef = useRef<HTMLDivElement | null>(null);

  const handleBoxDragStart = (e: React.DragEvent, boxId: string) => {
    setDraggedBoxId(boxId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/box', boxId);
    if (e.currentTarget instanceof HTMLElement) {
      dragBoxNodeRef.current = e.currentTarget as HTMLDivElement;
      setTimeout(() => {
        if (dragBoxNodeRef.current) dragBoxNodeRef.current.style.opacity = '0.4';
      }, 0);
    }
  };

  const handleBoxDragEnd = () => {
    if (dragBoxNodeRef.current) dragBoxNodeRef.current.style.opacity = '1';
    setDraggedBoxId(null);
    setBoxDropIndicator(null);
    dragBoxNodeRef.current = null;
  };

  const handleBoxDragOver = (e: React.DragEvent, boxIndex: number, boxId: string) => {
    e.preventDefault();
    if (!draggedBoxId || draggedBoxId === boxId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position = e.clientX < midX ? 'before' : 'after';
    setBoxDropIndicator({ index: boxIndex, position });
  };

  const handleBoxDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setBoxDropIndicator(null);
    }
  };

  const handleBoxDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedBoxId || !boxDropIndicator) {
      setBoxDropIndicator(null);
      return;
    }
    const currentOrder = boxes.map((b) => b.id);
    const draggedIndex = currentOrder.indexOf(draggedBoxId);
    if (draggedIndex === -1) return;
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    let insertIndex = boxDropIndicator.index;
    if (draggedIndex < boxDropIndicator.index) insertIndex--;
    if (boxDropIndicator.position === 'after') insertIndex++;
    newOrder.splice(insertIndex, 0, draggedBoxId);
    reorderBoxesMutation.mutate(newOrder);
    setBoxDropIndicator(null);
  };

  const handleFolderDragStart = (e: React.DragEvent, folderId: string) => {
    setDraggedFolderId(folderId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/folder', folderId);
    if (e.currentTarget instanceof HTMLElement) {
      dragFolderNodeRef.current = e.currentTarget as HTMLDivElement;
      setTimeout(() => {
        if (dragFolderNodeRef.current) dragFolderNodeRef.current.style.opacity = '0.4';
      }, 0);
    }
  };

  const handleFolderDragEnd = () => {
    if (dragFolderNodeRef.current) dragFolderNodeRef.current.style.opacity = '1';
    setDraggedFolderId(null);
    setFolderDropIndicator(null);
    dragFolderNodeRef.current = null;
  };

  const handleFolderDragOver = (e: React.DragEvent, folderIndex: number, folderId: string) => {
    e.preventDefault();
    if (!draggedFolderId || draggedFolderId === folderId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position = e.clientX < midX ? 'before' : 'after';
    setFolderDropIndicator({ index: folderIndex, position });
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setFolderDropIndicator(null);
    }
  };

  const handleFolderDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedFolderId || !folderDropIndicator) {
      setFolderDropIndicator(null);
      return;
    }
    const currentOrder = folders.map((f) => f.id);
    const draggedIndex = currentOrder.indexOf(draggedFolderId);
    if (draggedIndex === -1) return;
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    let insertIndex = folderDropIndicator.index;
    if (draggedIndex < folderDropIndicator.index) insertIndex--;
    if (folderDropIndicator.position === 'after') insertIndex++;
    newOrder.splice(insertIndex, 0, draggedFolderId);
    reorderFoldersMutation.mutate(newOrder);
    setFolderDropIndicator(null);
  };

  const handleItemDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/item', itemId);
    if (e.currentTarget instanceof HTMLElement) {
      dragItemNodeRef.current = e.currentTarget as HTMLDivElement;
      setTimeout(() => {
        if (dragItemNodeRef.current) dragItemNodeRef.current.style.opacity = '0.4';
      }, 0);
    }
  };

  const handleItemDragEnd = () => {
    if (dragItemNodeRef.current) dragItemNodeRef.current.style.opacity = '1';
    setDraggedItemId(null);
    setItemDropIndicator(null);
    dragItemNodeRef.current = null;
  };

  const handleItemDragOver = (e: React.DragEvent, itemIndex: number, itemId: string) => {
    e.preventDefault();
    if (!draggedItemId || draggedItemId === itemId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position = e.clientX < midX ? 'before' : 'after';
    setItemDropIndicator({ index: itemIndex, position });
  };

  const handleItemDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setItemDropIndicator(null);
    }
  };

  const handleItemDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedItemId || !itemDropIndicator) {
      setItemDropIndicator(null);
      return;
    }
    const currentOrder = folderItems.map((i) => i.id);
    const draggedIndex = currentOrder.indexOf(draggedItemId);
    if (draggedIndex === -1) return;
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    let insertIndex = itemDropIndicator.index;
    if (draggedIndex < itemDropIndicator.index) insertIndex--;
    if (itemDropIndicator.position === 'after') insertIndex++;
    newOrder.splice(insertIndex, 0, draggedItemId);
    reorderFolderItemsMutation.mutate(newOrder);
    setItemDropIndicator(null);
  };

  const [showBoxTypeSelection, setShowBoxTypeSelection] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateSlideModal, setShowCreateSlideModal] = useState(false);
  const [showCreateStructuredModal, setShowCreateStructuredModal] = useState(false);
  const [editingBox, setEditingBox] = useState<LocationBoxWithStats | null>(null);
  const [deletingBox, setDeletingBox] = useState<LocationBoxWithStats | null>(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ItemFolderWithStats | null>(null);
  const [editingFolderHeaders, setEditingFolderHeaders] = useState<ItemFolderHeader[]>([]);
  const [deletingFolder, setDeletingFolder] = useState<ItemFolderWithStats | null>(null);
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [showCreateStandaloneItemModal, setShowCreateStandaloneItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [movingBox, setMovingBox] = useState<LocationBoxWithStats | null>(null);
  const [movingItem, setMovingItem] = useState<InventoryItem | null>(null);
  const [movingFolder, setMovingFolder] = useState<ItemFolderWithStats | null>(null);
  const [addingBoxToProject, setAddingBoxToProject] = useState<LocationBoxWithStats | null>(null);
  const [addingItemToProject, setAddingItemToProject] = useState<InventoryItem | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const addBoxToProjectMutation = useAddBoxToProject();
  const addItemToProjectMutation = useAddItemToProject();
  const [exitingBoxId, setExitingBoxId] = useState<string | null>(null);
  const [exitingItemId, setExitingItemId] = useState<string | null>(null);
  const [exitingFolderId, setExitingFolderId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [itemViewMode, setItemViewMode] = useState<'card' | 'list'>('card');

  useEffect(() => {
    if (!tutorialModalRef) return;
    tutorialModalRef.current = {
      showBoxTypeSelection: () => setShowBoxTypeSelection(true),
      showCreateBox: (boxType) => {
        if (boxType === 'slide') setShowCreateSlideModal(true);
        else if (boxType === 'structured_freezer') setShowCreateStructuredModal(true);
        else setShowCreateModal(true);
      },
      showCreateSlideBox: () => setShowCreateSlideModal(true),
      showCreateItemFolder: () => setShowCreateFolderModal(true),
      showCreateItem: () => setShowCreateItemModal(true),
      setInitialFolder: (folderId) => {
        const folder = folders.find(f => f.id === folderId);
        if (folder) setActiveFolder(folder);
      },
      closeAll: () => {
        setShowBoxTypeSelection(false);
        setShowCreateModal(false);
        setShowCreateSlideModal(false);
        setShowCreateStructuredModal(false);
        setShowCreateFolderModal(false);
        setShowCreateItemModal(false);
        setEditingBox(null);
        setDeletingBox(null);
        setEditingFolder(null);
        setDeletingFolder(null);
        setEditingItem(null);
        setDeletingItem(null);
      },
    };
  });

  const handleBoxTypeSelect = (type: BoxType) => {
    setShowBoxTypeSelection(false);
    if (type === 'slide') {
      setShowCreateSlideModal(true);
    } else if (type === 'structured_freezer') {
      setShowCreateStructuredModal(true);
    } else {
      setShowCreateModal(true);
    }
  };

  const applyPrivacySettings = async (boxId: string, privacy: PrivacyFormState | undefined) => {
    if (!teamMember) return;
    const settings = privacy || {
      privacyMode: 'open' as const,
      ownerId: teamMember.id,
      ownerOnlyDelete: false,
      editMembers: [],
      viewMembers: [],
    };
    const entries = privacyFormToAccessEntries(settings);
    await upsertBoxPrivacy(boxId, settings.ownerId, settings.privacyMode, settings.ownerOnlyDelete, entries);
    queryClient.invalidateQueries({ queryKey: ['boxPrivacy', boxId] });
    queryClient.invalidateQueries({ queryKey: ['boxAccess'] });
    queryClient.invalidateQueries({ queryKey: ['boxPrivacySettings'] });
  };

  const handleCreateBox = async (data: Omit<CreateBoxData, 'location_id' | 'sublocation_id'>, privacySettings?: PrivacyFormState) => {
    let newBox;
    try {
      newBox = await createBoxMutation.mutateAsync(data);
    } catch (error) {
      console.error('Failed to create box:', error);
      return;
    }
    try {
      await applyPrivacySettings(newBox.id, privacySettings);
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
    }
    setShowCreateModal(false);
  };

  const handleCreateSlideBox = async (data: Omit<CreateBoxData, 'location_id' | 'sublocation_id'>, headers: HeaderInput[], privacySettings?: PrivacyFormState) => {
    let newBox;
    try {
      newBox = await createBoxMutation.mutateAsync(data);
      if (headers.length > 0) {
        await slideBoxHeaderService.createHeaders(newBox.id, headers);
      }
    } catch (error) {
      console.error('Failed to create slide box:', error);
      return;
    }
    try {
      await applyPrivacySettings(newBox.id, privacySettings);
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
    }
    setShowCreateSlideModal(false);
  };

  const handleCreateStructuredBox = async (data: Omit<CreateBoxData, 'location_id' | 'sublocation_id'>, headers: HeaderInput[], privacySettings?: PrivacyFormState) => {
    let newBox;
    try {
      newBox = await createBoxMutation.mutateAsync(data);
      if (headers.length > 0) {
        await slideBoxHeaderService.createHeaders(newBox.id, headers);
      }
    } catch (error) {
      console.error('Failed to create structured freezer box:', error);
      return;
    }
    try {
      await applyPrivacySettings(newBox.id, privacySettings);
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
    }
    setShowCreateStructuredModal(false);
  };

  const handleUpdateStructuredBox = async (boxId: string, data: UpdateBoxData, headers: HeaderInput[], headersChanged: boolean, privacySettings?: PrivacyFormState) => {
    try {
      await updateBoxMutation.mutateAsync({ boxId, data });
      if (headersChanged) {
        await slideBoxHeaderService.replaceHeaders(boxId, headers);
      }
    } catch (error) {
      console.error('Failed to update structured freezer box:', error);
      return;
    }
    try {
      await applyPrivacySettings(boxId, privacySettings);
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
    }
    setEditingBox(null);
  };

  const handleUpdateBox = async (boxId: string, data: UpdateBoxData, privacySettings?: PrivacyFormState) => {
    try {
      await updateBoxMutation.mutateAsync({ boxId, data });
    } catch (error) {
      console.error('Failed to update box:', error);
      return;
    }
    try {
      await applyPrivacySettings(boxId, privacySettings);
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
    }
    setEditingBox(null);
  };

  const handleUpdateSlideBox = async (boxId: string, data: UpdateBoxData, headers: HeaderInput[], headersChanged: boolean, privacySettings?: PrivacyFormState) => {
    try {
      await updateBoxMutation.mutateAsync({ boxId, data });
      if (headersChanged) {
        await slideBoxHeaderService.replaceHeaders(boxId, headers);
      }
    } catch (error) {
      console.error('Failed to update slide box:', error);
      return;
    }
    try {
      await applyPrivacySettings(boxId, privacySettings);
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
    }
    setEditingBox(null);
  };

  const handleDeleteBox = async (boxId: string) => {
    try {
      await deleteBoxMutation.mutateAsync(boxId);
      setDeletingBox(null);
    } catch (error) {
      console.error('Failed to delete box:', error);
    }
  };

  const handleDuplicateBox = async (box: LocationBoxWithStats, withData: boolean) => {
    try {
      await duplicateBoxMutation.mutateAsync({ boxId: box.id, withData });
      setToast({
        message: withData ? `"${box.name}" duplicated with data` : `"${box.name}" duplicated`,
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to duplicate box:', error);
      setToast({ message: 'Failed to duplicate box', type: 'error' });
    }
  };

  const handleCreateFolder = async (
    data: { name: string; description: string; accent_color: string | null; icon_id?: string | null },
    headers: FolderHeaderInput[],
  ) => {
    try {
      await createFolderMutation.mutateAsync({ data, headers });
      setShowCreateFolderModal(false);
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleUpdateFolder = async (
    folderId: string,
    data: { name: string; description: string; accent_color: string | null; icon_id?: string | null },
    headers: FolderHeaderInput[],
    headersChanged: boolean,
  ) => {
    try {
      await updateFolderMutation.mutateAsync({ folderId, data, headers, headersChanged });
      setEditingFolder(null);
      if (activeFolder?.id === folderId) {
        setActiveFolder((prev) => prev ? { ...prev, ...data } : null);
      }
    } catch (error) {
      console.error('Failed to update folder:', error);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteFolderMutation.mutateAsync(folderId);
      setDeletingFolder(null);
      if (activeFolder?.id === folderId) {
        setActiveFolder(null);
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  };

  const handleEditFolderClick = async (folder: ItemFolderWithStats) => {
    try {
      const headers = await itemFolderHeaderService.getHeaders(folder.id);
      setEditingFolderHeaders(headers);
    } catch (error) {
      console.error('Failed to load folder headers:', error);
      setEditingFolderHeaders([]);
    }
    setEditingFolder(folder);
  };

  const handleCreateItem = async (
    data: Omit<import('../types/database').CreateItemData, 'location_id' | 'sublocation_id' | 'position_id' | 'folder_id'>,
    customValues?: { header_id: string; value: string }[],
  ) => {
    try {
      await createItemInFolderMutation.mutateAsync({ itemData: data, customValues });
      setShowCreateItemModal(false);
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  };

  /** All item edits MUST route through this handler to preserve link integrity.
   *  It syncs changes back to linked freezer box cells before persisting the item update. */
  const handleUpdateItem = async (itemId: string, data: UpdateItemData, customValues?: { header_id: string; value: string }[]) => {
    try {
      const link = itemLinksMap[itemId];
      if (link) {
        const box = await boxService.getBoxById(link.box_id);
        const isStructured = box?.box_type === 'structured_freezer';
        const newName = data.name || '';

        if (link.link_type === 'info') {
          if (isStructured) {
            if (link.linked_name && data.name !== undefined && newName !== link.linked_name) {
              await boxItemLinkService.updateLinkedCellNames(
                link.box_id,
                link.linked_name,
                newName,
                link.linked_info,
                link.linked_info,
                link.link_type,
              );
              await boxItemLinkService.updateLinkTracking(link.id, newName, link.linked_info);
              queryClient.invalidateQueries({ queryKey: ['cells', link.box_id] });
              queryClient.invalidateQueries({ queryKey: ['boxItemLinks', link.box_id] });
              queryClient.invalidateQueries({ queryKey: ['itemLinks'] });
            } else if (!link.linked_name && data.name !== undefined) {
              const currentPlaceholder = (link.linked_info || '').split('|||').map(s => s.trim()).filter(Boolean).join(' / ') || 'Unnamed';
              const userTypedCustomName = newName && newName !== currentPlaceholder;
              if (userTypedCustomName) {
                await boxItemLinkService.writeNameToInfoMatchingCells(
                  link.box_id,
                  link.linked_info || '',
                  newName,
                );
                await boxItemLinkService.updateLinkTracking(link.id, newName, link.linked_info);
                queryClient.invalidateQueries({ queryKey: ['cells', link.box_id] });
                queryClient.invalidateQueries({ queryKey: ['boxItemLinks', link.box_id] });
                queryClient.invalidateQueries({ queryKey: ['itemLinks'] });
              }
            }
            if (customValues && customValues.length > 0) {
              const boxHeaders = await slideBoxHeaderService.getHeaders(link.box_id);
              const folderHdrs = activeFolderHeaders;
              const sortedFolderHdrs = [...folderHdrs].sort((a, b) => a.display_order - b.display_order);
              const headerMapping: Array<{ slideHeaderId: string; value: string }> = [];
              for (const cv of customValues) {
                const folderH = folderHdrs.find(fh => fh.id === cv.header_id);
                if (!folderH) continue;
                const boxH = boxHeaders.find(
                  (bh: SlideBoxHeader) => bh.header_text === folderH.header_text && bh.header_type === folderH.header_type
                );
                if (boxH) {
                  headerMapping.push({ slideHeaderId: boxH.id, value: cv.value });
                }
              }
              if (headerMapping.length > 0) {
                await boxItemLinkService.updateLinkedCellHeaderValues(
                  link.box_id,
                  link.linked_name,
                  link.linked_info,
                  link.link_type,
                  headerMapping,
                );
                queryClient.invalidateQueries({ queryKey: ['slideValues', link.box_id] });
                queryClient.invalidateQueries({ queryKey: ['cells', link.box_id] });
              }

              if (!link.linked_name) {
                const cvMap = new Map(customValues.map(cv => [cv.header_id, cv.value]));
                const newLinkedInfo = sortedFolderHdrs.map(h => {
                  const boxH = boxHeaders.find(
                    (bh: SlideBoxHeader) => bh.header_text === h.header_text && bh.header_type === h.header_type
                  );
                  return boxH ? (cvMap.get(h.id) ?? '').trim() : '';
                }).join('|||');

                if (newLinkedInfo !== (link.linked_info || '')) {
                  await boxItemLinkService.updateInfoOnMatchingCells(
                    link.box_id,
                    link.linked_info || '',
                    newLinkedInfo,
                  );
                  await boxItemLinkService.updateLinkTracking(link.id, '', newLinkedInfo);
                  queryClient.invalidateQueries({ queryKey: ['cells', link.box_id] });
                  queryClient.invalidateQueries({ queryKey: ['boxItemLinks', link.box_id] });
                  queryClient.invalidateQueries({ queryKey: ['itemLinks'] });
                }

                const newPlaceholderName = sortedFolderHdrs
                  .map(h => (cvMap.get(h.id) ?? '').trim())
                  .filter(Boolean)
                  .join(' / ') || 'Unnamed';
                data.name = newPlaceholderName;
              }
            }
          } else {
            if (data.name !== undefined && newName !== (link.linked_info || '')) {
              await boxItemLinkService.updateInfoOnMatchingCells(
                link.box_id,
                link.linked_info || '',
                newName,
              );
              await boxItemLinkService.updateLinkTracking(link.id, link.linked_name, newName);
              queryClient.invalidateQueries({ queryKey: ['cells', link.box_id] });
              queryClient.invalidateQueries({ queryKey: ['boxItemLinks', link.box_id] });
              queryClient.invalidateQueries({ queryKey: ['itemLinks'] });
            }
          }
        } else if (isStructured) {
          const nameChanged = data.name !== undefined && newName !== link.linked_name;
          if (nameChanged) {
            await boxItemLinkService.updateLinkedCellNames(
              link.box_id,
              link.linked_name,
              newName,
              link.linked_info,
              link.linked_info,
              link.link_type,
            );
            await boxItemLinkService.updateLinkTracking(link.id, newName, link.linked_info);
            queryClient.invalidateQueries({ queryKey: ['cells', link.box_id] });
            queryClient.invalidateQueries({ queryKey: ['boxItemLinks', link.box_id] });
            queryClient.invalidateQueries({ queryKey: ['itemLinks'] });
          }
          if (customValues && customValues.length > 0) {
            const boxHeaders = await slideBoxHeaderService.getHeaders(link.box_id);
            const folderHdrs = activeFolderHeaders;
            const headerMapping: Array<{ slideHeaderId: string; value: string }> = [];
            for (const cv of customValues) {
              const folderH = folderHdrs.find(fh => fh.id === cv.header_id);
              if (!folderH) continue;
              const boxH = boxHeaders.find(
                (bh: SlideBoxHeader) => bh.header_text === folderH.header_text && bh.header_type === folderH.header_type
              );
              if (boxH) {
                headerMapping.push({ slideHeaderId: boxH.id, value: cv.value });
              }
            }
            if (headerMapping.length > 0) {
              await boxItemLinkService.updateLinkedCellHeaderValues(
                link.box_id,
                newName || link.linked_name,
                link.linked_info,
                link.link_type,
                headerMapping,
              );
              queryClient.invalidateQueries({ queryKey: ['slideValues', link.box_id] });
              queryClient.invalidateQueries({ queryKey: ['cells', link.box_id] });
            }
          }
        } else {
          const nameChanged = data.name !== undefined && newName !== link.linked_name;
          const descChanged = link.link_type === 'name_info' && data.note !== undefined && (data.note || '') !== (link.linked_info || '');
          const newDate = data.date !== undefined ? (data.date || null) : (link.linked_date || null);
          const newDateType = data.date_type !== undefined ? data.date_type : (link.linked_date_type || 'none');
          const dateChanged = link.link_type === 'name_info' && (
            (newDate || '') !== (link.linked_date || '') ||
            newDateType !== (link.linked_date_type || 'none')
          );
          if (nameChanged || descChanged || dateChanged) {
            await boxItemLinkService.updateLinkedCellNames(
              link.box_id,
              link.linked_name,
              newName || link.linked_name,
              link.linked_info,
              link.link_type === 'name_info' ? (data.note || '') : link.linked_info,
              link.link_type,
              link.linked_date || null,
              link.linked_date_type || 'none',
              link.link_type === 'name_info' ? newDate : (link.linked_date || null),
              link.link_type === 'name_info' ? newDateType : (link.linked_date_type || 'none'),
            );
            await boxItemLinkService.updateLinkTracking(
              link.id,
              newName || link.linked_name,
              link.link_type === 'name_info' ? (data.note || null) : link.linked_info,
              link.link_type === 'name_info' ? newDate : (link.linked_date || null),
              link.link_type === 'name_info' ? newDateType : (link.linked_date_type || 'none'),
            );
            queryClient.invalidateQueries({ queryKey: ['cells', link.box_id] });
            queryClient.invalidateQueries({ queryKey: ['boxItemLinks', link.box_id] });
            queryClient.invalidateQueries({ queryKey: ['itemLinks'] });
          }
        }
      }
      await updateItemInFolderMutation.mutateAsync({ itemId, itemData: data, customValues });
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const handleAdjustStock = async (itemId: string, delta: number) => {
    const item = folderItems.find((i) => i.id === itemId) || standaloneItems.find((i) => i.id === itemId);
    if (item?.non_counted) return;
    try {
      await adjustStockMutation.mutateAsync({ itemId, delta });
    } catch (error) {
      console.error('Failed to adjust stock:', error);
    }
  };

  const handleAdjustFreezeThaw = async (itemId: string, delta: number) => {
    const item = folderItems.find((i) => i.id === itemId) || standaloneItems.find((i) => i.id === itemId);
    if (item?.non_counted) return;
    try {
      await adjustFreezeThawMutation.mutateAsync({ itemId, delta });
    } catch (error) {
      console.error('Failed to adjust freeze-thaw cycles:', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteItemMutation.mutateAsync(itemId);
      setDeletingItem(null);
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handleMoveBox = async (targetLocationId: string, targetSublocationId?: string | null, targetPositionId?: string | null) => {
    if (!movingBox) return;

    const targetLocation = locations.find((f) => f.id === targetLocationId);
    const boxName = movingBox.name;
    const boxId = movingBox.id;

    try {
      setIsMoving(true);
      setExitingBoxId(boxId);
      setMovingBox(null);

      await new Promise((resolve) => setTimeout(resolve, 350));

      await moveBoxMutation.mutateAsync({ boxId, targetLocationId, targetSublocationId, targetPositionId });

      const destinationName = targetLocation?.name || 'another location';

      setToast({
        message: `"${boxName}" moved to ${destinationName}`,
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to move box:', error);
      setToast({
        message: 'Failed to move box',
        type: 'error',
      });
    } finally {
      setIsMoving(false);
      setExitingBoxId(null);
    }
  };

  const handleMoveItem = async (targetLocationId: string, targetSublocationId?: string | null, targetPositionId?: string | null) => {
    if (!movingItem) return;

    const targetLocation = locations.find((f) => f.id === targetLocationId);
    const itemName = movingItem.name;
    const itemId = movingItem.id;

    try {
      setIsMoving(true);
      setExitingItemId(itemId);
      setMovingItem(null);

      await new Promise((resolve) => setTimeout(resolve, 350));

      await moveItemMutation.mutateAsync({ itemId, targetLocationId, targetSublocationId, targetPositionId, isStandalone: !movingItem.folder_id });

      const destinationName = targetLocation?.name || 'another location';

      setToast({
        message: `"${itemName}" moved to ${destinationName}`,
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to move item:', error);
      setToast({
        message: 'Failed to move item',
        type: 'error',
      });
    } finally {
      setIsMoving(false);
      setExitingItemId(null);
    }
  };

  const handleMoveFolderClick = async (folder: ItemFolderWithStats) => {
    const { data: items } = await getClient()
      .from('inventory_items')
      .select('id')
      .eq('folder_id', folder.id);

    const itemIds = (items || []).map((i: { id: string }) => i.id);

    if (itemIds.length > 0) {
      const links = await boxItemLinkService.getLinksForItems(itemIds);
      if (links.length > 0) {
        const confirmed = window.confirm(
          'This sheet contains items linked to storage boxes. Moving it will keep the links, but items will be in a different location than their linked boxes. Continue?'
        );
        if (!confirmed) return;
      }
    }

    setMovingFolder(folder);
  };

  const handleMoveFolder = async (targetLocationId: string, targetSublocationId?: string | null, targetPositionId?: string | null) => {
    if (!movingFolder) return;

    const targetLocation = locations.find((f) => f.id === targetLocationId);
    const folderName = movingFolder.name;
    const folderId = movingFolder.id;

    try {
      setIsMoving(true);
      setExitingFolderId(folderId);
      setMovingFolder(null);

      await new Promise((resolve) => setTimeout(resolve, 350));

      await moveFolderMutation.mutateAsync({ folderId, targetLocationId, targetSublocationId, targetPositionId });

      const destinationName = targetLocation?.name || 'another location';

      setToast({
        message: `"${folderName}" moved to ${destinationName}`,
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to move folder:', error);
      setToast({
        message: 'Failed to move folder',
        type: 'error',
      });
    } finally {
      setIsMoving(false);
      setExitingFolderId(null);
    }
  };

  const childLocationsLoading = hierarchicalNavigation && (
    (!sublocationId && !positionId && isSublocationsLoading) ||
    (!!sublocationId && !positionId && isPositionsLoading)
  );

  if (isLoading || childLocationsLoading) {
    return <DnaLoader message="Loading samples..." fullScreen={false} />;
  }

  const childLocations = hierarchicalNavigation
    ? (positionId
        ? []
        : sublocationId
          ? positions
          : sublocations.filter(s => s.location_id === locationId))
    : [];
  const hasChildLocations = childLocations.length > 0;

  const visibleBoxCount = showStorageBoxes ? boxes.length : 0;
  const visibleFolderCount = showInventoryItems ? folders.length : 0;
  const hasNoData = visibleBoxCount === 0 && visibleFolderCount === 0 && !hasChildLocations;
  const locationLabel = positionId && positionName
    ? positionName
    : sublocationId && sublocationName
      ? sublocationName
      : locationName;

  const isFiltered = !!(sublocationId || positionId);
  const emptyMessage = isFiltered
    ? showStorageBoxes && showInventoryItems
      ? 'No storage boxes or item sheets in this location'
      : showStorageBoxes
        ? 'No storage boxes in this location'
        : 'No item sheets in this location'
    : showStorageBoxes && showInventoryItems
      ? 'No storage boxes or item sheets yet'
      : showStorageBoxes
        ? 'No storage boxes yet'
        : 'No item sheets yet';

  const countParts: string[] = [];
  if (hasChildLocations) countParts.push(`${childLocations.length} ${childLocations.length === 1 ? 'location' : 'locations'}`);
  if (showStorageBoxes && boxes.length > 0) countParts.push(`${boxes.length} ${boxes.length === 1 ? 'box' : 'boxes'}`);
  if (showInventoryItems && folders.length > 0) countParts.push(`${folders.length} ${folders.length === 1 ? 'sheet' : 'sheets'}`);
  const countLabel = countParts.length > 0 ? countParts.join(', ') : 'Empty';

  const storageSectionTitle = hasChildLocations && boxes.length > 0
    ? 'Locations and Storage Boxes'
    : hasChildLocations
      ? 'Locations'
      : 'Storage Boxes';

  const emptyDescription = showStorageBoxes && showInventoryItems
    ? `Create your first storage box or item sheet to start organizing your reagents and samples in ${locationLabel}.`
    : showStorageBoxes
      ? `Create your first storage box to start organizing your samples in ${locationLabel}.`
      : `Create your first item sheet to start tracking your reagents in ${locationLabel}.`;

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50 overflow-hidden">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/30 sticky top-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={onMobileMenuToggle}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <Menu size={20} className="text-gray-600" />
              </button>

              {positionId && sublocationId ? (
                <>
                  <button
                    onClick={onClearSublocation}
                    className="flex items-center p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
                    title={locationName}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex-shrink-0 self-center flex items-center justify-center"
                      style={{ backgroundColor: `${locationColor}15` }}
                    >
                      <SvgIcon iconId={locationIconId} size={24} color={locationColor} />
                    </div>
                  </button>
                  <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                  <button
                    onClick={onClearPosition}
                    className="flex items-center p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
                    title={sublocationName || 'Go back to sublocation view'}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex-shrink-0 self-center flex items-center justify-center"
                      style={{ backgroundColor: `${sublocationAccentColor || '#6b7280'}15` }}
                    >
                      <SvgIcon iconId={resolvedSublocationIconId} size={24} color={sublocationAccentColor || '#6b7280'} />
                    </div>
                  </button>
                  <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                  <div className="flex items-center gap-2 flex-shrink min-w-0">
                    <div
                      className="w-12 h-12 rounded-xl flex-shrink-0 self-center flex items-center justify-center"
                      style={{ backgroundColor: `${accentColor}15` }}
                    >
                      <SvgIcon iconId={resolvedPositionIconId} size={28} color={accentColor} />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-lg font-bold text-gray-900 truncate">{positionName}</h1>
                      <p className="text-sm text-gray-500">
                        {countLabel}
                      </p>
                    </div>
                  </div>
                </>
              ) : sublocationId ? (
                <>
                  <button
                    onClick={onClearSublocation}
                    className="flex items-center p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
                    title={locationName}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex-shrink-0 self-center flex items-center justify-center"
                      style={{ backgroundColor: `${locationColor}15` }}
                    >
                      <SvgIcon iconId={locationIconId} size={24} color={locationColor} />
                    </div>
                  </button>
                  <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                  <div className="flex items-center gap-2 flex-shrink min-w-0">
                    <div
                      className="w-12 h-12 rounded-xl flex-shrink-0 self-center flex items-center justify-center"
                      style={{ backgroundColor: `${accentColor}15` }}
                    >
                      <SvgIcon iconId={resolvedSublocationIconId} size={28} color={accentColor} />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-lg font-bold text-gray-900 truncate">{sublocationName}</h1>
                      <p className="text-sm text-gray-500">
                        {countLabel}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="w-14 h-14 rounded-xl flex-shrink-0 self-center flex items-center justify-center"
                    style={{ backgroundColor: `${accentColor}15` }}
                  >
                    <SvgIcon iconId={locationIconId} size={32} color={accentColor} />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold text-gray-900 truncate">{locationName}</h1>
                    <p className="text-sm text-gray-500">
                      {countLabel}
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!hasNoData && (
                <>
                  {showStorageBoxes && (
                    <button
                      onClick={() => setShowBoxTypeSelection(true)}
                      aria-label="Add Box"
                      title="Add Box"
                      data-tutorial-id="workspace-add-box-btn"
                      className="inline-flex items-center justify-center gap-1 p-2 sm:px-2.5 sm:py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5 text-sm"
                    >
                      <Package size={18} />
                      <Plus className="hidden sm:inline-block" size={14} />
                    </button>
                  )}
                  {showInventoryItems && (
                    activeFolder ? (
                      <button
                        onClick={() => setShowCreateItemModal(true)}
                        aria-label="Add Item"
                        title="Add Item"
                        className="inline-flex items-center justify-center gap-1 p-2 sm:px-2.5 sm:py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5 text-sm"
                      >
                        <Tag size={18} />
                        <Plus className="hidden sm:inline-block" size={14} />
                      </button>
                    ) : (
                      <div className="inline-flex rounded-xl overflow-hidden shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5 transition-all duration-200">
                        <button
                          onClick={() => setShowCreateStandaloneItemModal(true)}
                          aria-label="Add Item"
                          title="Add Item"
                          className="inline-flex items-center justify-center gap-1 p-2 sm:px-2.5 sm:py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 transition-colors duration-200 text-sm"
                        >
                          <Tag size={18} />
                          <Plus className="hidden sm:inline-block" size={14} />
                        </button>
                        <div className="w-px bg-emerald-400/50" />
                        <button
                          onClick={() => setShowCreateFolderModal(true)}
                          aria-label="Add Sheet"
                          title="Add Sheet"
                          data-tutorial-id="workspace-add-folder-btn"
                          className="inline-flex items-center justify-center p-2 sm:px-2.5 sm:py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700 transition-colors duration-200 text-sm"
                        >
                          <Table2 size={18} />
                        </button>
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-gray-200/55">
        <div className="sticky top-0 z-20 px-4 sm:px-6 lg:px-8 pt-3 pb-1">
          <SearchBox
              variant="white"
              onSelectCell={(locationId, boxId, boxName, boxAccentColor, boxType, highlightCellId, highlightColumn) =>
                onNavigateToBox(locationId, boxId, boxName, boxAccentColor, boxType, highlightCellId, highlightColumn)
              }
              onSelectBox={(locationId, boxId, boxName, boxAccentColor, boxType) =>
                onNavigateToBox(locationId, boxId, boxName, boxAccentColor, boxType)
              }
              onSelectItem={(searchLocationId, folderId, folderName) => {
                onNavigateToLocation(searchLocationId);
                if (folderId && folderName && searchLocationId === locationId) {
                  setActiveFolder({ id: folderId, name: folderName, location_id: locationId, sublocation_id: sublocationId || null, position_id: positionId || null, description: '', accent_color: null, display_order: 0, created_at: '', updated_at: '', item_count: 0 });
                }
              }}
              onOpenSearchPage={onOpenSearchPage}
              hasPersistedSearch={hasPersistedSearch}
              initialQuery={initialSearchQuery}
              initialDateFilter={initialSearchDateFilter}
              initialFilterState={initialSearchFilterState}
              onSearchStateChange={onSearchBoxStateChange}
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
        <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        {hasNoData ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 mb-6">
              <Package className="h-10 w-10 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{emptyMessage}</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              {emptyDescription}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {showStorageBoxes && (
                <button
                  onClick={() => setShowBoxTypeSelection(true)}
                  data-tutorial-id="workspace-add-box-btn"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5"
                >
                  <Plus size={20} />
                  Create First Box
                </button>
              )}
              {showInventoryItems && (
                <button
                  onClick={() => setShowCreateFolderModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5"
                >
                  <Plus size={20} />
                  Create First Sheet
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {(showStorageBoxes || hasChildLocations) && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">{storageSectionTitle}</h2>
                </div>

                {boxes.length === 0 && !hasChildLocations ? (
                  <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                    <Package className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 mb-4">No storage boxes yet</p>
                    <button
                      onClick={() => setShowBoxTypeSelection(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-md shadow-blue-500/20 text-sm"
                    >
                      <Plus size={18} />
                      Add Box
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 gap-4">
                    {childLocations.map((loc, index) => (
                      <div
                        key={loc.id}
                        style={skipEntranceAnimation ? undefined : { animationDelay: `${index * 50}ms` }}
                        className={skipEntranceAnimation ? '' : 'animate-fade-in-up'}
                      >
                        <LocationCard
                          id={loc.id}
                          name={loc.name}
                          iconId={loc.icon_id}
                          accentColor={loc.accent_color}
                          locationType={loc.location_type}
                          boxCount={loc.box_count}
                          folderCount={loc.item_count}
                          onClick={() => {
                            if (sublocationId && onSelectPosition) {
                              onSelectPosition(
                                locationId,
                                sublocationId,
                                sublocationName || '',
                                sublocationAccentColor,
                                sublocationLocationType || 'general',
                                sublocationIconId || null,
                                loc.id,
                                loc.name,
                                loc.accent_color,
                                loc.location_type || 'general',
                                loc.icon_id || null,
                              );
                            } else if (onSelectSublocation) {
                              onSelectSublocation(
                                locationId,
                                loc.id,
                                loc.name,
                                loc.accent_color,
                                loc.location_type || 'general',
                                loc.icon_id || null,
                              );
                            }
                          }}
                        />
                      </div>
                    ))}
                    {boxes.map((box, index) => (
                      <div
                        key={box.id}
                        className="relative"
                      >
                        {boxDropIndicator?.index === index && boxDropIndicator.position === 'before' && (
                          <div className="absolute -left-2.5 top-1 bottom-1 w-0.5 bg-blue-500 rounded-full z-20 animate-drop-indicator" />
                        )}
                        <div
                          draggable
                          onDragStart={(e) => handleBoxDragStart(e, box.id)}
                          onDragEnd={handleBoxDragEnd}
                          onDragOver={(e) => handleBoxDragOver(e, index, box.id)}
                          onDragLeave={handleBoxDragLeave}
                          onDrop={handleBoxDrop}
                          style={skipEntranceAnimation ? undefined : { animationDelay: `${(index + childLocations.length) * 50}ms` }}
                          className={`cursor-grab active:cursor-grabbing ${
                            exitingBoxId === box.id || skipEntranceAnimation ? '' : 'animate-fade-in-up'
                          } ${draggedBoxId === box.id ? 'opacity-40' : ''}`}
                        >
                          <BoxCard
                            box={box}
                            onOpen={(boxId) => onOpenBox(boxId, box.name, box.accent_color, box.box_type)}
                            onEdit={setEditingBox}
                            onDelete={setDeletingBox}
                            onMove={setMovingBox}
                            onDuplicate={(b) => handleDuplicateBox(b, false)}
                            onDuplicateWithData={(b) => handleDuplicateBox(b, true)}
                            onAddToProject={setAddingBoxToProject}
                            isExiting={exitingBoxId === box.id}
                            accessLevel={boxAccessMap[box.id] || 'open'}
                          />
                        </div>
                        {boxDropIndicator?.index === index && boxDropIndicator.position === 'after' && (
                          <div className="absolute -right-2.5 top-1 bottom-1 w-0.5 bg-blue-500 rounded-full z-20 animate-drop-indicator" />
                        )}
                      </div>
                    ))}

                    {showStorageBoxes && (
                      <button
                        onClick={() => setShowBoxTypeSelection(true)}
                        className="group relative min-h-[120px] bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 hover:border-blue-400 hover:bg-blue-50/50"
                      >
                        <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:border-blue-300 group-hover:shadow-lg group-hover:shadow-blue-500/10">
                          <Plus className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />
                        </div>
                        <span className="text-xs font-medium text-gray-500 group-hover:text-blue-600 transition-colors duration-300">
                          Add Box
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}

            {showInventoryItems && (
              <section>
                {activeFolder ? (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { if (isSheetView && onBackFromSheet) { setActiveFolder(null); onBackFromSheet(); } else { setActiveFolder(null); } }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Back to sheets"
                        >
                          <ArrowLeft size={18} className="text-gray-500" />
                        </button>
                        <div
                          className="p-1.5 rounded-lg"
                          style={{ backgroundColor: `${activeFolder.accent_color || '#3b82f6'}15` }}
                        >
                          <Table2 size={18} style={{ color: activeFolder.accent_color || '#3b82f6' }} />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900">{activeFolder.name}</h2>
                        {!isFolderItemsLoading && (
                          <span className="text-sm text-gray-400">
                            {folderItems.length} {folderItems.length === 1 ? 'item' : 'items'}
                          </span>
                        )}
                      </div>
                      {folderItems.length > 0 && (
                        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                          <button
                            onClick={() => setItemViewMode('card')}
                            className={`p-1.5 rounded-md transition-all duration-200 ${
                              itemViewMode === 'card'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                            title="Card view"
                          >
                            <LayoutGrid size={16} />
                          </button>
                          <button
                            onClick={() => setItemViewMode('list')}
                            className={`p-1.5 rounded-md transition-all duration-200 ${
                              itemViewMode === 'list'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                            title="List view"
                          >
                            <List size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    {isFolderItemsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="h-6 w-6 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
                      </div>
                    ) : folderItems.length === 0 ? (
                      <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                        <Table2 className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 mb-4">No items in this sheet yet</p>
                        <button
                          onClick={() => setShowCreateItemModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-md shadow-emerald-500/20 text-sm"
                        >
                          <Plus size={18} />
                          Add Item
                        </button>
                      </div>
                    ) : itemViewMode === 'list' ? (
                      <div className="space-y-4">
                        <ItemListView
                          items={folderItems}
                          headers={activeFolderHeaders}
                          customValues={folderCustomValues}
                          onEdit={setEditingItem}
                          onDelete={setDeletingItem}
                          onMove={setMovingItem}
                          itemLinks={itemLinksMap}
                          showMovePerItem={false}
                          highlightItemId={highlightItemId}
                        />
                        <button
                          onClick={() => setShowCreateItemModal(true)}
                          className="w-full group bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center gap-2 py-3 transition-all duration-300 hover:border-emerald-400 hover:bg-emerald-50/50"
                        >
                          <Plus className="h-4 w-4 text-gray-400 group-hover:text-emerald-500 transition-colors duration-300" />
                          <span className="text-sm font-medium text-gray-500 group-hover:text-emerald-600 transition-colors duration-300">
                            Add Item
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 gap-4">
                        {folderItems.map((item, index) => (
                          <div key={item.id} className="relative">
                            {itemDropIndicator?.index === index && itemDropIndicator.position === 'before' && (
                              <div className="absolute -left-2.5 top-1 bottom-1 w-0.5 bg-emerald-500 rounded-full z-20 animate-drop-indicator" />
                            )}
                            <div
                              ref={highlightItemId === item.id ? highlightCardRef : undefined}
                              draggable
                              onDragStart={(e) => handleItemDragStart(e, item.id)}
                              onDragEnd={handleItemDragEnd}
                              onDragOver={(e) => handleItemDragOver(e, index, item.id)}
                              onDragLeave={handleItemDragLeave}
                              onDrop={handleItemDrop}
                              style={skipEntranceAnimation ? undefined : { animationDelay: `${index * 50}ms` }}
                              className={`cursor-grab active:cursor-grabbing ${
                                exitingItemId === item.id || skipEntranceAnimation ? '' : 'animate-fade-in-up'
                              } ${draggedItemId === item.id ? 'opacity-40' : ''} ${highlightItemId === item.id ? 'ring-2 ring-emerald-400 rounded-xl' : ''}`}
                            >
                              <ItemCard
                                item={item}
                                onEdit={setEditingItem}
                                onDelete={setDeletingItem}
                                onAdjustStock={handleAdjustStock}
                                onAdjustFreezeThaw={handleAdjustFreezeThaw}
                                onAddToProject={setAddingItemToProject}
                                isExiting={exitingItemId === item.id}
                                link={itemLinksMap[item.id] || null}
                                onLinkedDecrement={handleLinkedDecrement}
                                onUnlink={handleUnlinkItem}
                                onNavigateToLinkedBox={handleNavigateToLinkedBox}
                                onView={setViewingItem}
                              />
                            </div>
                            {itemDropIndicator?.index === index && itemDropIndicator.position === 'after' && (
                              <div className="absolute -right-2.5 top-1 bottom-1 w-0.5 bg-emerald-500 rounded-full z-20 animate-drop-indicator" />
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => setShowCreateItemModal(true)}
                          className="group relative min-h-[120px] bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 hover:border-emerald-400 hover:bg-emerald-50/50"
                        >
                          <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:border-emerald-300 group-hover:shadow-lg group-hover:shadow-emerald-500/10">
                            <Plus className="h-5 w-5 text-gray-400 group-hover:text-emerald-500 transition-colors duration-300" />
                          </div>
                          <span className="text-xs font-medium text-gray-500 group-hover:text-emerald-600 transition-colors duration-300">
                            Add Item
                          </span>
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold text-gray-900">Items</h2>
                    </div>

                    {folders.length === 0 && standaloneItems.length === 0 ? (
                      <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                        <Tag className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 mb-4">No items yet</p>
                        <button
                          onClick={() => setShowCreateStandaloneItemModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-md shadow-emerald-500/20 text-sm"
                        >
                          <Plus size={18} />
                          Add Item
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 gap-4">
                        {folders.map((folder, index) => (
                          <div key={folder.id} className="relative">
                            {folderDropIndicator?.index === index && folderDropIndicator.position === 'before' && (
                              <div className="absolute -left-2.5 top-1 bottom-1 w-0.5 bg-emerald-500 rounded-full z-20 animate-drop-indicator" />
                            )}
                            <div
                              draggable
                              onDragStart={(e) => handleFolderDragStart(e, folder.id)}
                              onDragEnd={handleFolderDragEnd}
                              onDragOver={(e) => handleFolderDragOver(e, index, folder.id)}
                              onDragLeave={handleFolderDragLeave}
                              onDrop={handleFolderDrop}
                              style={skipEntranceAnimation ? undefined : { animationDelay: `${index * 50}ms` }}
                              className={`cursor-grab active:cursor-grabbing ${skipEntranceAnimation ? '' : 'animate-fade-in-up'} ${
                                draggedFolderId === folder.id ? 'opacity-40' : ''
                              }`}
                            >
                              <ItemFolderCard
                                folder={folder}
                                onOpen={(f) => {
                                  if (onOpenSheet) {
                                    onOpenSheet(f.id, f.name, f.accent_color);
                                  } else {
                                    setActiveFolder(f);
                                  }
                                }}
                                onEdit={(f) => handleEditFolderClick(f)}
                                onDelete={setDeletingFolder}
                                onMove={handleMoveFolderClick}
                                isExiting={exitingFolderId === folder.id}
                              />
                            </div>
                            {folderDropIndicator?.index === index && folderDropIndicator.position === 'after' && (
                              <div className="absolute -right-2.5 top-1 bottom-1 w-0.5 bg-emerald-500 rounded-full z-20 animate-drop-indicator" />
                            )}
                          </div>
                        ))}
                        {standaloneItems.map((item, index) => (
                          <div
                            key={item.id}
                            style={skipEntranceAnimation ? undefined : { animationDelay: `${(folders.length + index) * 50}ms` }}
                            className={skipEntranceAnimation ? '' : 'animate-fade-in-up'}
                          >
                            <ItemCard
                              item={item}
                              onEdit={setEditingItem}
                              onDelete={setDeletingItem}
                              onMove={setMovingItem}
                              onAdjustStock={handleAdjustStock}
                              onAdjustFreezeThaw={handleAdjustFreezeThaw}
                              onAddToProject={setAddingItemToProject}
                              isExiting={exitingItemId === item.id}
                              link={itemLinksMap[item.id] || null}
                              onLinkedDecrement={handleLinkedDecrement}
                              onUnlink={handleUnlinkItem}
                              onNavigateToLinkedBox={handleNavigateToLinkedBox}
                              onView={setViewingItem}
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => setShowCreateStandaloneItemModal(true)}
                          className="group relative min-h-[120px] bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 hover:border-emerald-400 hover:bg-emerald-50/50"
                        >
                          <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:border-emerald-300 group-hover:shadow-lg group-hover:shadow-emerald-500/10">
                            <Plus className="h-5 w-5 text-gray-400 group-hover:text-emerald-500 transition-colors duration-300" />
                          </div>
                          <span className="text-xs font-medium text-gray-500 group-hover:text-emerald-600 transition-colors duration-300">
                            Add Item
                          </span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            )}
          </div>
        )}
        </div>
      </main>

      {showBoxTypeSelection && (
        <BoxTypeSelectionModal
          onClose={() => setShowBoxTypeSelection(false)}
          onSelect={handleBoxTypeSelect}
        />
      )}

      {showCreateModal && (
        <CreateBoxModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateBox}
          teamMembers={teamMembers}
          currentTeamMemberId={teamMember?.id}
          workspaceOwnerId={workspace?.owner_id}
        />
      )}

      {showCreateSlideModal && (
        <CreateSlideBoxModal
          onClose={() => setShowCreateSlideModal(false)}
          onCreate={handleCreateSlideBox}
          teamMembers={teamMembers}
          currentTeamMemberId={teamMember?.id}
          workspaceOwnerId={workspace?.owner_id}
        />
      )}

      {showCreateStructuredModal && (
        <CreateStructuredFreezerBoxModal
          onClose={() => setShowCreateStructuredModal(false)}
          onCreate={handleCreateStructuredBox}
          teamMembers={teamMembers}
          currentTeamMemberId={teamMember?.id}
          workspaceOwnerId={workspace?.owner_id}
        />
      )}

      {editingBox && editingBox.box_type === 'slide' && (
        <EditSlideBoxModal
          box={editingBox}
          onClose={() => setEditingBox(null)}
          onUpdate={handleUpdateSlideBox}
          teamMembers={teamMembers}
          currentTeamMemberId={teamMember?.id}
          workspaceOwnerId={workspace?.owner_id}
          workspaceId={workspace?.id}
        />
      )}

      {editingBox && editingBox.box_type === 'structured_freezer' && (
        <EditStructuredFreezerBoxModal
          box={editingBox}
          onClose={() => setEditingBox(null)}
          onUpdate={handleUpdateStructuredBox}
          teamMembers={teamMembers}
          currentTeamMemberId={teamMember?.id}
          workspaceOwnerId={workspace?.owner_id}
          workspaceId={workspace?.id}
        />
      )}

      {editingBox && editingBox.box_type !== 'slide' && editingBox.box_type !== 'structured_freezer' && (
        <EditBoxModal
          box={editingBox}
          onClose={() => setEditingBox(null)}
          onUpdate={handleUpdateBox}
          teamMembers={teamMembers}
          currentTeamMemberId={teamMember?.id}
          workspaceOwnerId={workspace?.owner_id}
          workspaceId={workspace?.id}
        />
      )}

      {deletingBox && (
        <DeleteBoxModal
          box={deletingBox}
          onClose={() => setDeletingBox(null)}
          onDelete={handleDeleteBox}
        />
      )}

      {showCreateFolderModal && (
        <CreateItemFolderModal
          onClose={() => setShowCreateFolderModal(false)}
          onCreate={handleCreateFolder}
        />
      )}

      {editingFolder && (
        <EditItemFolderModal
          folder={editingFolder}
          existingHeaders={editingFolderHeaders}
          onClose={() => setEditingFolder(null)}
          onUpdate={handleUpdateFolder}
        />
      )}

      {deletingFolder && (
        <DeleteItemFolderModal
          folder={deletingFolder}
          onClose={() => setDeletingFolder(null)}
          onDelete={handleDeleteFolder}
        />
      )}

      {showCreateItemModal && (
        <CreateItemModal
          folderHeaders={activeFolderHeaders}
          existingSiblings={folderItems.map(i => ({ id: i.id, name: i.name, customValues: folderCustomValues[i.id] || {} }))}
          onClose={() => setShowCreateItemModal(false)}
          onCreate={handleCreateItem}
        />
      )}

      {showCreateStandaloneItemModal && (
        <CreateStandaloneItemModal
          existingItems={standaloneItems}
          onClose={() => setShowCreateStandaloneItemModal(false)}
          onCreate={async (itemData) => {
            await createStandaloneItemMutation.mutateAsync(itemData);
            setShowCreateStandaloneItemModal(false);
            setToast({ message: `"${itemData.name}" created`, type: 'success' });
          }}
        />
      )}

      {editingItem && (() => {
        const editLink = itemLinksMap[editingItem.id] || null;
        const editPlaceholder = editLink?.link_type === 'info' && !editLink.linked_name
          ? editingItem.name : undefined;
        const isStandalone = !editingItem.folder_id;
        const editSiblings = isStandalone
          ? standaloneItems.map(i => ({ id: i.id, name: i.name, note: i.note, date: i.date }))
          : folderItems.map(i => ({ id: i.id, name: i.name, note: i.note, date: i.date, customValues: folderCustomValues[i.id] || {} }));
        return (
          <EditItemModal
            item={editingItem}
            folderHeaders={activeFolderHeaders}
            customValues={folderCustomValues[editingItem.id] || {}}
            onClose={() => setEditingItem(null)}
            onUpdate={handleUpdateItem}
            link={editLink}
            placeholderName={editPlaceholder}
            siblingItems={editSiblings}
          />
        );
      })()}

      {viewingItem && (() => {
        const viewLink = itemLinksMap[viewingItem.id] || null;
        return (
          <ItemDetailModal
            item={viewingItem}
            folderHeaders={activeFolderHeaders}
            customValues={folderCustomValues[viewingItem.id] || {}}
            link={viewLink}
            onClose={() => setViewingItem(null)}
            onUpdate={handleUpdateItem}
            onAdjustStock={handleAdjustStock}
            onAdjustFreezeThaw={handleAdjustFreezeThaw}
            onLinkedDecrement={handleLinkedDecrement}
            onNavigateToLinkedBox={(lk) => {
              setViewingItem(null);
              handleNavigateToLinkedBox(lk);
            }}
          />
        );
      })()}

      {deletingItem && (
        <DeleteItemModal
          item={deletingItem}
          onClose={() => setDeletingItem(null)}
          onDelete={handleDeleteItem}
        />
      )}

      {movingBox && (
        <MoveToLocationModal
          entityName={movingBox.name}
          entityType="box"
          currentLocationId={locationId}
          currentSublocationId={movingBox.sublocation_id}
          currentPositionId={movingBox.position_id}
          locations={locations}
          onClose={() => setMovingBox(null)}
          onMove={handleMoveBox}
          isMoving={isMoving}
        />
      )}

      {movingItem && (
        <MoveToLocationModal
          entityName={movingItem.name}
          entityType="item"
          currentLocationId={locationId}
          currentSublocationId={movingItem.sublocation_id}
          currentPositionId={movingItem.position_id}
          locations={locations}
          onClose={() => setMovingItem(null)}
          onMove={handleMoveItem}
          isMoving={isMoving}
        />
      )}

      {movingFolder && (
        <MoveToLocationModal
          entityName={movingFolder.name}
          entityType="sheet"
          currentLocationId={locationId}
          currentSublocationId={movingFolder.sublocation_id}
          currentPositionId={movingFolder.position_id}
          locations={locations}
          onClose={() => setMovingFolder(null)}
          onMove={handleMoveFolder}
          isMoving={isMoving}
        />
      )}

      {addingBoxToProject && (
        <AddToProjectModal
          itemType="box"
          itemName={addingBoxToProject.name}
          onClose={() => setAddingBoxToProject(null)}
          onConfirm={async (projectId, experimentId) => {
            await addBoxToProjectMutation.mutateAsync({ projectId, experimentId, boxId: addingBoxToProject.id });
            setAddingBoxToProject(null);
            setToast({ message: `Box added to project`, type: 'success' });
          }}
        />
      )}

      {addingItemToProject && (
        <AddToProjectModal
          itemType="item"
          itemName={addingItemToProject.name}
          onClose={() => setAddingItemToProject(null)}
          onConfirm={async (projectId, experimentId) => {
            await addItemToProjectMutation.mutateAsync({ projectId, experimentId, itemId: addingItemToProject.id });
            setAddingItemToProject(null);
            setToast({ message: `Item added to project`, type: 'success' });
          }}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showQRScanner && workspace && (
        <QRScannerModal
          workspaceId={workspace.id}
          onNavigateToBox={(resolvedLocationId, boxId, boxName, boxAccentColor, boxType) => {
            setShowQRScanner(false);
            onNavigateToBox(resolvedLocationId, boxId, boxName, boxAccentColor, boxType);
          }}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  );
};

export default Workspace;
