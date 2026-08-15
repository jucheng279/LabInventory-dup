import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchService, SearchResults } from '../services/searchService';
import type { SearchFilterState, DateFilter } from '../types/search';

const DEBOUNCE_DELAY = 300;

const emptyResults: SearchResults = {
  cellMatches: [],
  structuredFreezerMatches: [],
  cellTitles: [],
  cellInfo: [],
  boxes: [],
  items: [],
  itemCustomValues: [],
  slideMatches: [],
  slideValues: [],
  slideHeaders: [],
  blockedCount: 0,
};

function hasAutoSearchInput(
  query: string,
  dateFilter?: DateFilter | null,
  filters?: SearchFilterState | null,
): boolean {
  const hasSlideDateFilters = !!(filters?.slideDateFilters && Object.keys(filters.slideDateFilters).length > 0);
  const hasItemDateFilters = !!(filters?.itemDateFilters && Object.keys(filters.itemDateFilters).length > 0);
  const hasFreezerDateFilters = !!(filters?.freezerDateFilters && Object.keys(filters.freezerDateFilters).length > 0);
  return !!(query.trim() || dateFilter || hasSlideDateFilters || hasItemDateFilters || hasFreezerDateFilters);
}

function hasAnySearchableInput(
  query: string,
  dateFilter?: DateFilter | null,
  filters?: SearchFilterState | null,
): boolean {
  if (hasAutoSearchInput(query, dateFilter, filters)) return true;
  if (!filters) return false;
  return !!(
    filters.scopes?.length ||
    filters.customFilters?.length ||
    filters.freezerSubFilters?.length ||
    filters.freezerHeaderFilters?.length ||
    filters.slideHeaderFilters?.length ||
    filters.itemSubFilters?.length ||
    filters.itemHeaderFilters?.length ||
    filters.itemFolderNameFilter
  );
}

export function useGlobalSearch(
  query: string,
  dateFilter?: DateFilter | null,
  filters?: SearchFilterState | null,
  manualTrigger?: number,
  teamMemberId?: string,
) {
  const [debouncedQuery, setDebouncedQuery] = useState(() => query.trim());
  const [debouncedDateFilter, setDebouncedDateFilter] = useState<DateFilter | null>(() => dateFilter ?? null);
  const [debouncedFilters, setDebouncedFilters] = useState<SearchFilterState | null>(() => filters ?? null);
  const [activeManualTrigger, setActiveManualTrigger] = useState(0);
  const prevManualTriggerRef = useRef(manualTrigger ?? 0);

  const filtersJson = filters ? JSON.stringify(filters) : null;
  const dateFilterJson = dateFilter ? JSON.stringify(dateFilter) : null;

  useEffect(() => {
    const current = manualTrigger ?? 0;
    if (current !== prevManualTriggerRef.current) {
      prevManualTriggerRef.current = current;
      const trimmed = query.trim();
      if (trimmed || hasAnySearchableInput(trimmed, dateFilter, filters)) {
        setDebouncedQuery(trimmed);
        setDebouncedDateFilter(dateFilter ?? null);
        setDebouncedFilters(filters ?? null);
        setActiveManualTrigger(current);
      }
      return;
    }

    const trimmed = query.trim();
    const hasAutoInput = hasAutoSearchInput(trimmed, dateFilter, filters);

    if (!hasAutoInput) {
      if (activeManualTrigger && !hasAnySearchableInput(trimmed, dateFilter, filters)) {
        setActiveManualTrigger(0);
      }
      if (!activeManualTrigger || !hasAnySearchableInput(trimmed, dateFilter, filters)) {
        setDebouncedQuery('');
        setDebouncedDateFilter(null);
        setDebouncedFilters(null);
      }
      return;
    }

    const currentFiltersJson = filtersJson;
    const currentDateFilterJson = dateFilterJson;
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
      setDebouncedDateFilter(currentDateFilterJson ? JSON.parse(currentDateFilterJson) : null);
      setDebouncedFilters(currentFiltersJson ? JSON.parse(currentFiltersJson) : null);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [query, dateFilterJson, filtersJson, manualTrigger]);

  const queryKey = useMemo(() => [
    'global-search',
    debouncedQuery,
    debouncedDateFilter,
    debouncedFilters,
    activeManualTrigger,
    teamMemberId,
  ], [debouncedQuery, debouncedDateFilter, debouncedFilters, activeManualTrigger, teamMemberId]);

  const isManuallyTriggered = activeManualTrigger > 0;
  const enabled = isManuallyTriggered
    ? hasAnySearchableInput(debouncedQuery, debouncedDateFilter, debouncedFilters)
    : hasAutoSearchInput(debouncedQuery, debouncedDateFilter, debouncedFilters);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      searchService.searchAll(debouncedQuery, debouncedDateFilter, debouncedFilters, signal, teamMemberId),
    enabled,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const results = enabled ? (data ?? emptyResults) : emptyResults;

  const hasInput = isManuallyTriggered
    ? hasAnySearchableInput(query, dateFilter, filters)
    : hasAutoSearchInput(query, dateFilter, filters);

  const isSearching = enabled && isLoading;

  const hasAutoInput = hasAutoSearchInput(query, dateFilter, filters);
  const isDebouncing = hasAutoInput && (
    query.trim() !== debouncedQuery ||
    (dateFilterJson ?? null) !== (debouncedDateFilter ? JSON.stringify(debouncedDateFilter) : null) ||
    (filtersJson ?? null) !== (debouncedFilters ? JSON.stringify(debouncedFilters) : null)
  );

  const hasResults =
    results.structuredFreezerMatches.length > 0 ||
    results.cellMatches.length > 0 ||
    results.structuredFreezerMatches.length > 0 ||
    results.cellTitles.length > 0 ||
    results.cellInfo.length > 0 ||
    results.boxes.length > 0 ||
    results.items.length > 0 ||
    results.itemCustomValues.length > 0 ||
    results.slideMatches.length > 0 ||
    results.slideValues.length > 0 ||
    results.slideHeaders.length > 0;

  const canManualSearch = hasAnySearchableInput(query, dateFilter, filters);

  const resetManualTrigger = useCallback(() => {
    setActiveManualTrigger(0);
  }, []);

  return {
    results,
    isSearching: isSearching || isDebouncing,
    isFetching: enabled && isFetching && !isLoading,
    hasResults,
    hasError: isError,
    isEmpty: !hasResults && hasInput && !isSearching && !isError && !isDebouncing,
    canManualSearch,
    resetManualTrigger,
  };
}
