import { useRef, useCallback } from 'react';
import type { DateFilter, SearchFilterState } from '../types/search';
import { BoxType } from '../services/boxService';
import {
  ViewState,
  SublocationSelection,
  PositionSelection,
  SELECTED_LOCATION_KEY,
  SELECTED_SUBLOCATION_KEY,
  SELECTED_POSITION_KEY,
} from './types';

interface UseSearchStateParams {
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  setSelectedSublocation: (s: SublocationSelection | null) => void;
  setSelectedPosition: (p: PositionSelection | null) => void;
  setViewState: (vs: ViewState) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  hasAutoCollapsedRef: React.MutableRefObject<boolean>;
  returningFromSearchRef: React.MutableRefObject<boolean>;
}

export function useSearchState({
  selectedLocationId,
  setSelectedLocationId,
  setSelectedSublocation,
  setSelectedPosition,
  setViewState,
  sidebarCollapsed,
  setSidebarCollapsed,
  hasAutoCollapsedRef,
  returningFromSearchRef,
}: UseSearchStateParams) {
  const searchPageStateRef = useRef<{ query: string; dateFilter: DateFilter | null; filterState: SearchFilterState | null } | null>(null);

  const handleSearchStateChange = useCallback((query: string, dateFilter: DateFilter | null, filterState: SearchFilterState | null) => {
    searchPageStateRef.current = { query, dateFilter, filterState };
  }, []);

  const handleSearchBoxStateChange = useCallback((query: string, dateFilter: DateFilter | null, filterState: SearchFilterState | null) => {
    const hasInput = query.trim() || dateFilter || filterState;
    searchPageStateRef.current = hasInput ? { query, dateFilter, filterState } : null;
  }, []);

  const handleOpenSearchPage = (query: string, dateFilter: DateFilter | null, filterState: SearchFilterState | null) => {
    const hasNewInput = query.trim() || dateFilter || filterState;
    if (hasNewInput) {
      searchPageStateRef.current = { query, dateFilter, filterState };
      setViewState({ view: 'search', searchQuery: query, searchDateFilter: dateFilter, searchFilterState: filterState });
    } else if (searchPageStateRef.current) {
      const saved = searchPageStateRef.current;
      setViewState({ view: 'search', searchQuery: saved.query, searchDateFilter: saved.dateFilter, searchFilterState: saved.filterState });
    } else {
      setViewState({ view: 'search', searchQuery: '', searchDateFilter: null, searchFilterState: null });
    }
  };

  const handleSearchNavigateToBox = (
    locationId: string,
    boxId: string,
    boxName: string,
    boxAccentColor: string | null,
    boxType?: BoxType,
    highlightCellId?: string,
    highlightColumn?: number,
  ) => {
    if (locationId !== selectedLocationId) {
      setSelectedLocationId(locationId);
      setSelectedSublocation(null);
      setSelectedPosition(null);
      localStorage.setItem(SELECTED_LOCATION_KEY, locationId);
      localStorage.removeItem(SELECTED_SUBLOCATION_KEY);
      localStorage.removeItem(SELECTED_POSITION_KEY);
    }
    setViewState({ view: 'box', boxId, boxName, boxAccentColor, boxType, highlightCellId, highlightColumn });
    if (!hasAutoCollapsedRef.current && !sidebarCollapsed) {
      setSidebarCollapsed(true);
      hasAutoCollapsedRef.current = true;
    }
  };

  const handleSearchNavigateToLocation = (locationId: string) => {
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

  const hasPersistedSearch = !!(
    searchPageStateRef.current &&
    (searchPageStateRef.current.query.trim() || searchPageStateRef.current.dateFilter || searchPageStateRef.current.filterState)
  );

  return {
    searchPageStateRef,
    handleSearchStateChange,
    handleSearchBoxStateChange,
    handleOpenSearchPage,
    handleSearchNavigateToBox,
    handleSearchNavigateToLocation,
    handleBackToWorkspaceFromSearch,
    hasPersistedSearch,
  };
}
