import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Calendar,
  SlidersHorizontal,
  Printer,
  Lock,
} from 'lucide-react';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { useSavedFilters, useWorkspaceSlideHeaders, useWorkspaceItemFolderHeaders, useWorkspaceItemFolderNames, useWorkspaceFreezerBoxHeaders } from '../hooks/useSavedFilters';
import { useAuth } from '../contexts/AuthContext';
import type { BoxType } from '../types/database';
import type {
  SearchFilterScopes,
  FreezerSubFilters,
  ItemSubFilters,
  SearchFilterState,
  DateFilter,
  ColumnDateFilters,
} from '../types/search';
import type {
  CellSearchResult,
  CellCombinedSearchResult,
  BoxSearchResult,
  ItemSearchResult,
  SlideValueSearchResult,
  SlideCombinedSearchResult,
  SlideHeaderSearchResult,
  ItemCustomValueSearchResult,
  StructuredFreezerCombinedSearchResult,
} from '../services/searchService';
import SearchFilterPanel from './SearchFilterPanel';
import DateFilterPicker, { getDateFilterLabel, getDateFilterIcon } from './DateFilterPicker';
import SearchingLoader from './SearchingLoader';
import SearchPageTableResults from './SearchPageTableResults';
import SearchPagePrintView from './SearchPagePrintView';

interface SearchPageProps {
  initialQuery: string;
  initialDateFilter: DateFilter | null;
  initialFilterState: SearchFilterState | null;
  onBack: () => void;
  onNavigateToBox: (
    locationId: string,
    boxId: string,
    boxName: string,
    boxAccentColor: string | null,
    boxType?: BoxType,
    highlightCellId?: string,
    highlightColumn?: number,
  ) => void;
  onNavigateToLocation: (locationId: string) => void;
  onNavigateToItem?: (locationId: string, sublocationId: string | null, positionId: string | null, folderId: string, itemId: string, sheetName?: string, sheetAccentColor?: string | null) => void;
  onSearchStateChange?: (query: string, dateFilter: DateFilter | null, filterState: SearchFilterState | null) => void;
}

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRST';

function cellIdToColumnIndex(cellId: string): number {
  const letter = cellId.charAt(0).toUpperCase();
  const idx = ROW_LABELS.indexOf(letter);
  return idx >= 0 ? idx : 0;
}

function hasAnyColumnDateFilters(filters: ColumnDateFilters): boolean {
  return Object.keys(filters).length > 0;
}

const SearchPage: React.FC<SearchPageProps> = ({
  initialQuery,
  initialDateFilter,
  initialFilterState,
  onBack,
  onNavigateToBox,
  onNavigateToLocation,
  onNavigateToItem,
  onSearchStateChange,
}) => {
  const { teamMember } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(initialDateFilter);
  const [suspendedCalendarFilter, setSuspendedCalendarFilter] = useState<DateFilter | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [manualTrigger, setManualTrigger] = useState(0);

  const [scopes, setScopes] = useState<SearchFilterScopes>(initialFilterState?.scopes ?? []);
  const [customFilters, setCustomFilters] = useState<string[]>(initialFilterState?.customFilters ?? []);
  const [freezerSubFilters, setFreezerSubFilters] = useState<FreezerSubFilters>(initialFilterState?.freezerSubFilters ?? []);
  const [freezerHeaderFilters, setFreezerHeaderFilters] = useState<string[]>(initialFilterState?.freezerHeaderFilters ?? []);
  const [freezerDateFilters, setFreezerDateFilters] = useState<ColumnDateFilters>(initialFilterState?.freezerDateFilters ?? {});
  const [slideHeaderFilters, setSlideHeaderFilters] = useState<string[]>(initialFilterState?.slideHeaderFilters ?? []);
  const [slideDateFilters, setSlideDateFilters] = useState<ColumnDateFilters>(initialFilterState?.slideDateFilters ?? {});
  const [itemSubFilters, setItemSubFilters] = useState<ItemSubFilters>(initialFilterState?.itemSubFilters ?? []);
  const [itemHeaderFilters, setItemHeaderFilters] = useState<string[]>(initialFilterState?.itemHeaderFilters ?? []);
  const [itemFolderNameFilter, setItemFolderNameFilter] = useState<string | null>(initialFilterState?.itemFolderNameFilter ?? null);
  const [itemDateFilters, setItemDateFilters] = useState<ColumnDateFilters>(initialFilterState?.itemDateFilters ?? {});

  const { savedFilters, addFilter: saveFilter, removeFilter: deleteSavedFilter } = useSavedFilters();
  const { data: slideHeaders = [] } = useWorkspaceSlideHeaders();
  const { data: itemFolderHeaders = [] } = useWorkspaceItemFolderHeaders();
  const { data: itemFolderNames = [] } = useWorkspaceItemFolderNames();
  const { data: freezerHeaders = [] } = useWorkspaceFreezerBoxHeaders();

  const anyColumnDateActive = hasAnyColumnDateFilters(slideDateFilters) ||
    hasAnyColumnDateFilters(freezerDateFilters) ||
    hasAnyColumnDateFilters(itemDateFilters);

  // Mutual exclusivity: suspend calendar when column date filters are added
  useEffect(() => {
    if (anyColumnDateActive && dateFilter) {
      setSuspendedCalendarFilter(dateFilter);
      setDateFilter(null);
      setShowDatePicker(false);
    } else if (!anyColumnDateActive && suspendedCalendarFilter && !dateFilter) {
      setDateFilter(suspendedCalendarFilter);
      setSuspendedCalendarFilter(null);
    }
  }, [anyColumnDateActive]);

  const filterState = useMemo<SearchFilterState | null>(() => {
    const hasFreezerDate = Object.keys(freezerDateFilters).length > 0;
    const hasSlideDate = Object.keys(slideDateFilters).length > 0;
    const hasItemDate = Object.keys(itemDateFilters).length > 0;
    if (
      scopes.length === 0 && customFilters.length === 0 && freezerSubFilters.length === 0 &&
      freezerHeaderFilters.length === 0 && !hasFreezerDate &&
      slideHeaderFilters.length === 0 && !hasSlideDate &&
      itemSubFilters.length === 0 && itemHeaderFilters.length === 0 && !itemFolderNameFilter && !hasItemDate
    ) {
      return null;
    }
    return {
      scopes, customFilters, freezerSubFilters,
      freezerHeaderFilters, freezerDateFilters,
      slideHeaderFilters, slideDateFilters,
      itemSubFilters, itemHeaderFilters, itemFolderNameFilter, itemDateFilters,
    };
  }, [scopes, customFilters, freezerSubFilters, freezerHeaderFilters, freezerDateFilters, slideHeaderFilters, slideDateFilters, itemSubFilters, itemHeaderFilters, itemFolderNameFilter, itemDateFilters]);

  const { results, isSearching, isFetching, hasResults, hasError, isEmpty, canManualSearch, resetManualTrigger } = useGlobalSearch(query, dateFilter, filterState, manualTrigger, teamMember?.id);

  const handleSearchIconClick = useCallback(() => {
    if (canManualSearch) {
      setManualTrigger((n) => n + 1);
    }
  }, [canManualSearch]);

  const activeFilterCount = scopes.length +
    customFilters.length +
    freezerSubFilters.length +
    freezerHeaderFilters.length +
    Object.keys(freezerDateFilters).length +
    slideHeaderFilters.length +
    Object.keys(slideDateFilters).length +
    itemSubFilters.length +
    itemHeaderFilters.length +
    (itemFolderNameFilter ? 1 : 0) +
    Object.keys(itemDateFilters).length;

  const isExpiringSearch = dateFilter?.mode === 'expiring_within';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    onSearchStateChange?.(query, dateFilter, filterState);
  }, [query, dateFilter, filterState, onSearchStateChange]);

  const handleClear = () => {
    setQuery('');
    setDateFilter(null);
    setSuspendedCalendarFilter(null);
    setScopes([]);
    setCustomFilters([]);
    setFreezerSubFilters([]);
    setSlideHeaderFilters([]);
    setSlideDateFilters({});
    setItemSubFilters([]);
    setItemHeaderFilters([]);
    setItemFolderNameFilter(null);
    setItemDateFilters({});
    setFreezerHeaderFilters([]);
    setFreezerDateFilters({});
    setShowDatePicker(false);
    setShowFilters(false);
    setManualTrigger(0);
    resetManualTrigger();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showDatePicker) setShowDatePicker(false);
      else if (showFilters) setShowFilters(false);
      else onBack();
    }
  };

  const handleCellClick = (result: CellSearchResult) => {
    const columnIndex = cellIdToColumnIndex(result.cellId);
    onNavigateToBox(
      result.locationId,
      result.boxId,
      result.boxName,
      result.boxAccentColor,
      result.boxType,
      result.cellId,
      result.boxType === 'slide' ? columnIndex : undefined,
    );
  };

  const handleBoxClick = (result: BoxSearchResult) => {
    onNavigateToBox(result.locationId, result.boxId, result.boxName, result.boxAccentColor, result.boxType);
  };

  const handleItemClick = (result: ItemSearchResult) => {
    if (onNavigateToItem && result.folderId) {
      onNavigateToItem(result.locationId, result.sublocationId, result.positionId, result.folderId, result.itemId, result.folderName || undefined, null);
    } else {
      onNavigateToLocation(result.locationId);
    }
  };

  const handleItemCustomValueClick = (result: ItemCustomValueSearchResult) => {
    if (onNavigateToItem && result.folderId) {
      onNavigateToItem(result.locationId, result.sublocationId, result.positionId, result.folderId, result.itemId, result.folderName || undefined, null);
    } else {
      onNavigateToLocation(result.locationId);
    }
  };

  const handleSlideValueClick = (result: SlideValueSearchResult) => {
    const columnIndex = cellIdToColumnIndex(result.cellId);
    onNavigateToBox(
      result.locationId,
      result.boxId,
      result.boxName,
      result.boxAccentColor,
      result.boxType,
      result.cellId,
      columnIndex,
    );
  };

  const handleCellCombinedClick = (result: CellCombinedSearchResult) => {
    const columnIndex = cellIdToColumnIndex(result.cellId);
    onNavigateToBox(
      result.locationId,
      result.boxId,
      result.boxName,
      result.boxAccentColor,
      result.boxType,
      result.cellId,
      result.boxType === 'slide' ? columnIndex : undefined,
    );
  };

  const handleSlideCombinedClick = (result: SlideCombinedSearchResult) => {
    const columnIndex = cellIdToColumnIndex(result.cellId);
    onNavigateToBox(
      result.locationId,
      result.boxId,
      result.boxName,
      result.boxAccentColor,
      result.boxType,
      result.cellId,
      columnIndex,
    );
  };
  const handleStructuredFreezerCombinedClick = (result: StructuredFreezerCombinedSearchResult) => {
    onNavigateToBox(
      result.locationId,
      result.boxId,
      result.boxName,
      result.boxAccentColor,
      result.boxType,
      result.cellId,
    );
  };

  const handleSlideHeaderClick = (result: SlideHeaderSearchResult) => {
    onNavigateToBox(result.locationId, result.boxId, result.boxName, result.boxAccentColor, result.boxType);
  };

  const handleDateFilterChange = (filter: DateFilter | null) => {
    setDateFilter(filter);
    setShowDatePicker(false);
  };

  const handleDateIconClick = () => {
    if (anyColumnDateActive) return;
    const opening = !showDatePicker;
    setShowDatePicker(opening);
    if (opening) setShowFilters(false);
  };

  const handleClearAllFilters = () => {
    setScopes([]);
    setCustomFilters([]);
    setFreezerSubFilters([]);
    setFreezerHeaderFilters([]);
    setFreezerDateFilters({});
    setSlideHeaderFilters([]);
    setSlideDateFilters({});
    setItemSubFilters([]);
    setItemHeaderFilters([]);
    setItemFolderNameFilter(null);
    setItemDateFilters({});
  };

  const totalResultCount =
    results.cellMatches.length +
    results.structuredFreezerMatches.length +
    results.cellTitles.length +
    results.cellInfo.length +
    results.boxes.length +
    results.items.length +
    results.itemCustomValues.length +
    results.slideMatches.length +
    results.slideValues.length +
    results.slideHeaders.length;

  const filterSummaryParts: string[] = [];
  if (scopes.includes('freezer_box')) filterSummaryParts.push('Freezer Box');
  if (scopes.includes('slide_box')) filterSummaryParts.push('Slide Box');
  if (scopes.includes('item')) filterSummaryParts.push('Item');
  for (const f of freezerSubFilters) filterSummaryParts.push(f.charAt(0).toUpperCase() + f.slice(1));
  for (const h of freezerHeaderFilters) filterSummaryParts.push(h);
  for (const [col, df] of Object.entries(freezerDateFilters)) filterSummaryParts.push(`${col}: ${getDateFilterLabel(df)}`);
  for (const h of slideHeaderFilters) filterSummaryParts.push(h);
  for (const [col, df] of Object.entries(slideDateFilters)) filterSummaryParts.push(`${col}: ${getDateFilterLabel(df)}`);
  if (itemSubFilters.includes('name')) filterSummaryParts.push('Name');
  if (itemSubFilters.includes('folder_name')) filterSummaryParts.push('Sheet');
  if (itemSubFilters.includes('column_header')) filterSummaryParts.push('Column');
  if (itemFolderNameFilter) filterSummaryParts.push(itemFolderNameFilter);
  for (const h of itemHeaderFilters) filterSummaryParts.push(h);
  for (const [col, df] of Object.entries(itemDateFilters)) filterSummaryParts.push(`${col}: ${getDateFilterLabel(df)}`);

  const DateFilterIcon = dateFilter ? getDateFilterIcon(dateFilter) : Calendar;

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <>
      <div className="flex flex-col h-full no-print">
        <header className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
                title="Back to workspace"
              >
                <ArrowLeft size={20} />
              </button>

              <div className="flex-1 relative">
                <button
                  onClick={handleSearchIconClick}
                  disabled={!canManualSearch}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-colors duration-200 ${
                    canManualSearch
                      ? 'text-blue-500 hover:text-blue-700 cursor-pointer'
                      : 'text-gray-400 cursor-default'
                  }`}
                  title={canManualSearch ? 'Run search' : 'Search all locations'}
                  type="button"
                >
                  <Search size={18} />
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search all locations..."
                  className="w-full pl-11 pr-10 py-3 text-base bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-300 focus:bg-white transition-all duration-200 placeholder:text-gray-400"
                />
                {(query || dateFilter) && (
                  <button
                    onClick={handleClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    <X size={16} className="text-gray-400" />
                  </button>
                )}
              </div>

              <button
                onClick={() => {
                  const opening = !showFilters;
                  setShowFilters(opening);
                  if (opening) setShowDatePicker(false);
                }}
                className={`p-2.5 rounded-xl border transition-all duration-200 flex-shrink-0 relative ${
                  showFilters || activeFilterCount > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                title="Search filters"
              >
                <SlidersHorizontal size={18} />
                {activeFilterCount > 0 && !showFilters && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <button
                onClick={handleDateIconClick}
                disabled={anyColumnDateActive}
                className={`p-2.5 rounded-xl border transition-all duration-200 flex-shrink-0 ${
                  anyColumnDateActive
                    ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                    : dateFilter
                      ? 'bg-blue-50 border-blue-200 text-blue-600'
                      : showDatePicker
                        ? 'bg-gray-200 border-gray-300 text-gray-600'
                        : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
                title={anyColumnDateActive ? 'Disabled while column date filters are active' : 'Filter by date'}
              >
                <DateFilterIcon size={18} />
              </button>

              <div className="w-px h-8 bg-gray-200" />

              <button
                onClick={handlePrint}
                disabled={!hasResults}
                className={`p-2.5 rounded-xl border transition-all duration-200 flex-shrink-0 ${
                  hasResults
                    ? 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                }`}
                title="Print results"
              >
                <Printer size={18} />
              </button>
            </div>
          </div>

          {showDatePicker && !anyColumnDateActive && (
            <div className="px-4 sm:px-6 lg:px-8 pb-4">
              <DateFilterPicker
                value={dateFilter}
                onChange={handleDateFilterChange}
                onClose={() => setShowDatePicker(false)}
                showDateTypeOptions
              />
            </div>
          )}

          {showFilters && (
            <div className="px-4 sm:px-6 lg:px-8 pb-4">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Filters</span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={handleClearAllFilters}
                      className="text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <SearchFilterPanel
                  scopes={scopes}
                  onScopesChange={setScopes}
                  customFilters={customFilters}
                  onAddCustomFilter={(text) => setCustomFilters((prev) =>
                    prev.some(f => f.toLowerCase() === text.toLowerCase()) ? prev : [...prev, text],
                  )}
                  onRemoveCustomFilter={(index) => setCustomFilters((prev) => prev.filter((_, i) => i !== index))}
                  freezerSubFilters={freezerSubFilters}
                  onFreezerSubFiltersChange={setFreezerSubFilters}
                  freezerHeaders={freezerHeaders}
                  freezerHeaderFilters={freezerHeaderFilters}
                  onFreezerHeaderFiltersChange={setFreezerHeaderFilters}
                  freezerDateFilters={freezerDateFilters}
                  onFreezerDateFiltersChange={setFreezerDateFilters}
                  slideHeaderFilters={slideHeaderFilters}
                  onSlideHeaderFiltersChange={setSlideHeaderFilters}
                  slideHeaders={slideHeaders}
                  savedFilters={savedFilters}
                  onSaveFilter={saveFilter}
                  onDeleteSavedFilter={deleteSavedFilter}
                  slideDateFilters={slideDateFilters}
                  onSlideDateFiltersChange={setSlideDateFilters}
                  itemSubFilters={itemSubFilters}
                  onItemSubFiltersChange={setItemSubFilters}
                  itemHeaderFilters={itemHeaderFilters}
                  onItemHeaderFiltersChange={setItemHeaderFilters}
                  itemFolderNameFilter={itemFolderNameFilter}
                  onItemFolderNameFilterChange={setItemFolderNameFilter}
                  itemFolderHeaders={itemFolderHeaders}
                  itemFolderNames={itemFolderNames}
                  itemDateFilters={itemDateFilters}
                  onItemDateFiltersChange={setItemDateFilters}
                />
              </div>
            </div>
          )}

          {!showFilters && (activeFilterCount > 0 || dateFilter) && (
            <div className="px-4 sm:px-6 lg:px-8 pb-3 flex items-center gap-1.5 flex-wrap">
              {filterSummaryParts.map((part, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[11px] font-medium border border-blue-100"
                >
                  {part}
                </span>
              ))}
              {customFilters.map((text, i) => (
                <span
                  key={`cf-${i}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md text-[11px] font-medium border border-amber-200"
                >
                  {text}
                  <button
                    onClick={() => setCustomFilters((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-0.5 rounded hover:bg-amber-100 transition-colors"
                  >
                    <X size={8} />
                  </button>
                </span>
              ))}
              {dateFilter && (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                  dateFilter.mode === 'expiring_within'
                    ? 'bg-orange-50 text-orange-600 border-orange-200'
                    : 'bg-blue-50 text-blue-700 border-blue-100'
                }`}>
                  <DateFilterIcon size={10} />
                  {getDateFilterLabel(dateFilter)}
                  <button
                    onClick={() => setDateFilter(null)}
                    className={`p-0.5 rounded transition-colors ${
                      dateFilter.mode === 'expiring_within' ? 'hover:bg-orange-100' : 'hover:bg-blue-100'
                    }`}
                  >
                    <X size={8} />
                  </button>
                </span>
              )}
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          {isSearching && (
            <div className="flex items-center justify-center py-16">
              <SearchingLoader size={80} />
            </div>
          )}

          {!isSearching && hasError && (
            <div className="flex flex-col items-center justify-center py-16 text-red-500">
              <p className="text-sm font-medium">Search failed. Please try again.</p>
            </div>
          )}

          {!isSearching && isEmpty && (
            <div className="flex flex-col items-center justify-center py-16">
              <Search size={48} className="text-gray-300 mb-4" />
              <p className="text-gray-500 text-sm">No results found</p>
              <p className="text-gray-400 text-xs mt-1">Try adjusting your search terms or filters</p>
              {results.blockedCount > 0 && (
                <p className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium border border-amber-200">
                  <Lock size={12} />
                  {results.blockedCount} matching result{results.blockedCount !== 1 ? 's' : ''} hidden due to box access restrictions
                </p>
              )}
            </div>
          )}

          {!isSearching && !hasResults && !isEmpty && !hasError && (
            <div className="flex flex-col items-center justify-center py-16">
              <Search size={48} className="text-gray-300 mb-4" />
              <p className="text-gray-500 text-sm">Search across all your locations</p>
              <p className="text-gray-400 text-xs mt-1">Enter a search term or apply filters to find items</p>
            </div>
          )}

          {!isSearching && hasResults && (
            <div className="px-4 sm:px-6 lg:px-8 py-6">
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-500">
                  {totalResultCount} result{totalResultCount !== 1 ? 's' : ''}
                </span>
                {results.blockedCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-[11px] font-medium border border-amber-200">
                    <Lock size={11} />
                    {results.blockedCount} result{results.blockedCount !== 1 ? 's' : ''} hidden due to box access restrictions
                  </span>
                )}
                {isFetching && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Refreshing
                  </span>
                )}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {results.slideMatches.length > 0 && (
                    <a href="#section-slide-matches" className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-cyan-50 text-cyan-700 border border-cyan-100 hover:bg-cyan-100 transition-colors">
                      {results.slideMatches.length} Slide Matches
                    </a>
                  )}
                  {results.cellMatches.length > 0 && (
                    <a href="#section-cell-matches" className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">
                      {results.cellMatches.length} Freezer Matches
                    </a>
                  )}
                  {results.structuredFreezerMatches.length > 0 && (
                    <a href="#section-structured-freezer-matches" className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">
                      {results.structuredFreezerMatches.length} Structured Freezer Matches
                    </a>
                  )}
                  {results.slideValues.length > 0 && (
                    <a href="#section-slide-data" className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-cyan-50 text-cyan-700 border border-cyan-100 hover:bg-cyan-100 transition-colors">
                      {results.slideValues.length} Slide Data
                    </a>
                  )}
                  {results.itemCustomValues.length > 0 && (
                    <a href="#section-item-data" className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-colors">
                      {results.itemCustomValues.length} Item Data
                    </a>
                  )}
                  {results.cellTitles.length > 0 && (
                    <a href="#section-cell-titles" className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">
                      {results.cellTitles.length} Cell Titles
                    </a>
                  )}
                  {results.cellInfo.length > 0 && (
                    <a href="#section-cell-info" className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">
                      {results.cellInfo.length} Cell Info
                    </a>
                  )}
                  {results.slideHeaders.length > 0 && (
                    <a href="#section-slide-headers" className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-teal-50 text-teal-700 border border-teal-100 hover:bg-teal-100 transition-colors">
                      {results.slideHeaders.length} Slide Headers
                    </a>
                  )}
                  {results.boxes.length > 0 && (
                    <a href="#section-boxes" className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-colors">
                      {results.boxes.length} Boxes
                    </a>
                  )}
                  {results.items.length > 0 && (
                    <a href="#section-items" className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-colors">
                      {results.items.length} Items
                    </a>
                  )}
                </div>
              </div>

              <SearchPageTableResults
                results={results}
                showDate={!!dateFilter}
                showDaysRemaining={isExpiringSearch}
                slideHeaderFilters={slideHeaderFilters}
                itemHeaderFilters={itemHeaderFilters}
                onCellClick={handleCellClick}
                onCellCombinedClick={handleCellCombinedClick}
                onBoxClick={handleBoxClick}
                onItemClick={handleItemClick}
                onItemCustomValueClick={handleItemCustomValueClick}
                onSlideValueClick={handleSlideValueClick}
                onSlideCombinedClick={handleSlideCombinedClick}
                onSlideHeaderClick={handleSlideHeaderClick}
                onStructuredFreezerCombinedClick={handleStructuredFreezerCombinedClick}
              />
            </div>
          )}
        </main>
      </div>

      <SearchPagePrintView
        results={results}
        query={query}
        dateFilter={dateFilter}
        filterSummaryParts={filterSummaryParts}
        customFilters={customFilters}
        showDate={!!dateFilter}
        showDaysRemaining={isExpiringSearch}
        slideHeaderFilters={slideHeaderFilters}
        itemHeaderFilters={itemHeaderFilters}
      />
    </>
  );
};

export default SearchPage;
