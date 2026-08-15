import { useState, useRef, useCallback } from 'react';
import { BoxType } from '../services/boxService';
import { useAllSublocations } from '../hooks/useSublocationData';
import { useAllPositions } from '../hooks/usePositionData';
import {
  ViewState,
  SublocationSelection,
  PositionSelection,
  SELECTED_LOCATION_KEY,
  SELECTED_SUBLOCATION_KEY,
  SELECTED_POSITION_KEY,
} from './types';

export function useNavigation() {
  const [viewState, setViewState] = useState<ViewState>({ view: 'inventoryOverview' });
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedSublocation, setSelectedSublocation] = useState<SublocationSelection | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<PositionSelection | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hasAutoCollapsedRef = useRef(false);
  const returningFromSearchRef = useRef(false);

  const { data: allSublocations = [] } = useAllSublocations();
  const { data: allPositions = [] } = useAllPositions();

  const handleSelectLocation = (locationId: string) => {
    setSelectedLocationId(locationId);
    setSelectedSublocation(null);
    setSelectedPosition(null);
    localStorage.setItem(SELECTED_LOCATION_KEY, locationId);
    localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
    localStorage.removeItem(SELECTED_POSITION_KEY);
    setViewState({ view: 'workspace' });
    setMobileMenuOpen(false);
  };

  const handleSelectSublocation = (
    locationId: string,
    sublocationId: string,
    sublocationName: string,
    accentColor: string | null,
    locationType: string = 'general',
    iconId: string | null = null
  ) => {
    setSelectedLocationId(locationId);
    setSelectedSublocation({ id: sublocationId, name: sublocationName, accentColor, locationType, iconId });
    setSelectedPosition(null);
    localStorage.setItem(SELECTED_LOCATION_KEY, locationId);
    localStorage.setItem(SELECTED_SUBLOCATION_KEY, sublocationId);
    localStorage.removeItem(SELECTED_POSITION_KEY);
    setViewState({ view: 'workspace' });
    setMobileMenuOpen(false);
  };

  const handleSelectPosition = (
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
    positionIconId: string | null = null
  ) => {
    setSelectedLocationId(locationId);
    setSelectedSublocation({ id: sublocationId, name: sublocationName, accentColor: sublocationAccentColor, locationType: sublocationLocationType, iconId: sublocationIconId });
    setSelectedPosition({ id: positionId, sublocationId, name: positionName, accentColor: positionAccentColor, locationType: positionLocationType, iconId: positionIconId });
    localStorage.setItem(SELECTED_LOCATION_KEY, locationId);
    localStorage.setItem(SELECTED_SUBLOCATION_KEY, sublocationId);
    localStorage.setItem(SELECTED_POSITION_KEY, positionId);
    setViewState({ view: 'workspace' });
    setMobileMenuOpen(false);
  };

  const handleOpenBox = (boxId: string, boxName: string, boxAccentColor?: string | null, boxType?: BoxType) => {
    setViewState({ view: 'box', boxId, boxName, boxAccentColor, boxType });
    if (!hasAutoCollapsedRef.current && !sidebarCollapsed) {
      setSidebarCollapsed(true);
      hasAutoCollapsedRef.current = true;
    }
  };

  const handleOpenSheet = (sheetId: string, sheetName: string, sheetAccentColor?: string | null) => {
    setViewState({ view: 'sheet', sheetId, sheetName, sheetAccentColor });
    if (!hasAutoCollapsedRef.current && !sidebarCollapsed) {
      setSidebarCollapsed(true);
      hasAutoCollapsedRef.current = true;
    }
  };

  const handleBackToWorkspace = (selectedProjectId: string | null) => {
    if (selectedProjectId && (viewState.view === 'box' || viewState.view === 'sheet')) {
      setViewState({ view: 'project' });
    } else {
      setViewState({ view: 'workspace' });
    }
    hasAutoCollapsedRef.current = false;
  };

  const setLocationHierarchy = useCallback((locationId: string, sublocationId: string | null, positionId: string | null) => {
    setSelectedLocationId(locationId);
    localStorage.setItem(SELECTED_LOCATION_KEY, locationId);

    if (sublocationId) {
      const sub = allSublocations.find(s => s.id === sublocationId);
      setSelectedSublocation(sub ? {
        id: sub.id, name: sub.name, accentColor: sub.accent_color,
        locationType: sub.location_type, iconId: sub.icon_id,
      } : { id: sublocationId, name: '', accentColor: null, locationType: 'general', iconId: null });
      localStorage.setItem(SELECTED_SUBLOCATION_KEY, sublocationId);
    } else {
      setSelectedSublocation(null);
      localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
    }

    if (positionId) {
      const pos = allPositions.find(p => p.id === positionId);
      setSelectedPosition(pos ? {
        id: pos.id, sublocationId: pos.sublocation_id, name: pos.name,
        accentColor: pos.accent_color, locationType: pos.location_type, iconId: pos.icon_id,
      } : { id: positionId, sublocationId: sublocationId || '', name: '', accentColor: null, locationType: 'general', iconId: null });
      localStorage.setItem(SELECTED_POSITION_KEY, positionId);
    } else {
      setSelectedPosition(null);
      localStorage.removeItem(SELECTED_POSITION_KEY);
    }
  }, [allSublocations, allPositions]);

  const handleNavigateToItem = useCallback((
    locationId: string,
    sublocationId: string | null,
    positionId: string | null,
    folderId: string,
    itemId: string,
    sheetName?: string,
    sheetAccentColor?: string | null,
  ) => {
    setLocationHierarchy(locationId, sublocationId, positionId);
    setViewState({ view: 'sheet', sheetId: folderId, sheetName: sheetName || '', sheetAccentColor, highlightItemId: itemId });
    if (!hasAutoCollapsedRef.current && !sidebarCollapsed) {
      setSidebarCollapsed(true);
      hasAutoCollapsedRef.current = true;
    }
  }, [setLocationHierarchy, sidebarCollapsed]);

  const handleNavigateToSheet = useCallback((
    locationId: string,
    sublocationId: string | null,
    positionId: string | null,
    sheetId: string,
    sheetName?: string,
    sheetAccentColor?: string | null,
  ) => {
    setLocationHierarchy(locationId, sublocationId, positionId);
    setViewState({ view: 'sheet', sheetId, sheetName: sheetName || '', sheetAccentColor });
    if (!hasAutoCollapsedRef.current && !sidebarCollapsed) {
      setSidebarCollapsed(true);
      hasAutoCollapsedRef.current = true;
    }
  }, [setLocationHierarchy, sidebarCollapsed]);

  const handleNavigateToBox = (
    locationId: string,
    boxId: string,
    boxName: string,
    boxAccentColor: string | null,
    boxType?: BoxType,
    highlightCellId?: string,
    highlightColumn?: number,
    sublocationId?: string,
    positionId?: string,
  ) => {
    setLocationHierarchy(locationId, sublocationId || null, positionId || null);
    setViewState({ view: 'box', boxId, boxName, boxAccentColor, boxType, highlightCellId, highlightColumn });
    if (!hasAutoCollapsedRef.current && !sidebarCollapsed) {
      setSidebarCollapsed(true);
      hasAutoCollapsedRef.current = true;
    }
  };

  const handleNavigateToLocation = (locationId: string) => {
    if (locationId !== selectedLocationId) {
      setSelectedLocationId(locationId);
      setSelectedSublocation(null);
      setSelectedPosition(null);
      localStorage.setItem(SELECTED_LOCATION_KEY, locationId);
      localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
      localStorage.removeItem(SELECTED_POSITION_KEY);
    }
    setViewState({ view: 'workspace' });
  };

  const handleBackToWorkspaceFromSearch = () => {
    returningFromSearchRef.current = true;
    setViewState({ view: 'workspace' });
    hasAutoCollapsedRef.current = false;
  };

  return {
    viewState,
    setViewState,
    selectedLocationId,
    setSelectedLocationId,
    selectedSublocation,
    setSelectedSublocation,
    selectedPosition,
    setSelectedPosition,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen,
    hasAutoCollapsedRef,
    returningFromSearchRef,
    allSublocations,
    allPositions,
    handleSelectLocation,
    handleSelectSublocation,
    handleSelectPosition,
    handleOpenBox,
    handleBackToWorkspace,
    handleNavigateToItem,
    handleNavigateToSheet,
    handleNavigateToBox,
    handleNavigateToLocation,
    handleBackToWorkspaceFromSearch,
    handleOpenSheet,
  };
}
