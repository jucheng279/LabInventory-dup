import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, X, Calendar, SlidersHorizontal, Maximize2, ScanLine } from 'lucide-react';
import SearchingLoader from './SearchingLoader';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { useSavedFilters, useWorkspaceSlideHeaders, useWorkspaceItemFolderHeaders, useWorkspaceItemFolderNames, useWorkspaceFreezerBoxHeaders } from '../hooks/useSavedFilters';
import { groupByBox } from '../utils/searchGroupUtils';
import type {
  CellSearchResult,
  BoxSearchResult,
  ItemSearchResult,
  SlideValueSearchResult,
  SlideHeaderSearchResult,
  ItemCustomValueSearchResult,
} from '../services/searchService';
import type { BoxType } from '../types/database';
import type {
  SearchFilterScopes,
  FreezerSubFilters,
  ItemSubFilters,
  SearchFilterState,
  DateFilter,
  ColumnDateFilters,
} from '../types/search';
import SearchFilterPanel from './SearchFilterPanel';
import DateFilterPicker, { getDateFilterLabel, getDateFilterIcon } from './DateFilterPicker';
import {
  ResultSection,
  CellResultItem,
  CellCombinedResultItem,
  BoxResultItem,
  ItemResultItem,
  SlideValueResultItem,
  SlideCombinedResultItem,
  SlideHeaderResultItem,
  ItemCustomValueResultItem,
  StructuredFreezerCombinedResultItem,
  BoxGroupHeaderItem,
} from './SearchResultItems';

interface SearchBoxProps {
  onSelectCell: (
    locationId: string,
    boxId: string,
    boxName: string,
    boxAccentColor: string | null,
    boxType?: BoxType,
    highlightCellId?: string,
    highlightColumn?: number,
  ) => void;
  onSelectBox: (
    locationId: string,
    boxId: string,
    boxName: string,
    boxAccentColor: string | null,
    boxType?: BoxType,
  ) => void;
  onSelectItem: (locationId: string, folderId?: string, folderName?: string) => void;
  onOpenSearchPage?: (query: string, dateFilter: DateFilter | null, filterState: SearchFilterState | null) => void;
  hasPersistedSearch?: boolean;
  initialQuery?: string;
  initialDateFilter?: DateFilter | null;
  initialFilterState?: SearchFilterState | null;
  onSearchStateChange?: (query: string, dateFilter: DateFilter | null, filterState: SearchFilterState | null) => void;
  onOpenScanner?: () => void;
  variant?: 'default' | 'white';
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

const SearchBox: React.FC<SearchBoxProps> = ({
  onSelectCell,
  onSelectBox,
  onSelectItem,
  onOpenSearchPage,
  hasPersistedSearch,
  initialQuery,
  initialDateFilter,
  initialFilterState,
  onSearchStateChange,
  onOpenScanner,
  variant = 'default',
}) => {
  const [query, setQuery] = useState(initialQuery || '');
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(initialDateFilter ?? null);
  const [suspendedCalendarFilter, setSuspendedCalendarFilter] = useState<DateFilter | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isOpen, setIsOpen] = useState(() => !!(initialQuery?.trim() || initialDateFilter));
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const [manualTrigger, setManualTrigger] = useState(0);

  const { results, isSearching, hasResults, hasError, isEmpty, canManualSearch, resetManualTrigger } = useGlobalSearch(query, dateFilter, filterState, manualTrigger);

  const [dropdownExpandedGroups, setDropdownExpandedGroups] = useState<Set<string>>(new Set());

  const toggleDropdownGroup = useCallback((key: string) => {
    setDropdownExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const slideMatchGroups = useMemo(() => results ? groupByBox(results.slideMatches) : [], [results]);
  const cellMatchGroups = useMemo(() => results ? groupByBox(results.cellMatches) : [], [results]);
  const structuredFreezerGroups = useMemo(() => results ? groupByBox(results.structuredFreezerMatches) : [], [results]);
  const slideValueGroups = useMemo(() => results ? groupByBox(results.slideValues) : [], [results]);
  const cellTitleGroups = useMemo(() => results ? groupByBox(results.cellTitles) : [], [results]);
  const cellInfoGroups = useMemo(() => results ? groupByBox(results.cellInfo) : [], [results]);
  const slideHeaderGroups = useMemo(() => results ? groupByBox(results.slideHeaders) : [], [results]);

  useEffect(() => {
    setDropdownExpandedGroups(new Set());
  }, [results]);

  const handleSearchIconClick = useCallback(() => {
    if (canManualSearch) {
      setManualTrigger((n) => n + 1);
      setIsOpen(true);
    }
  }, [canManualSearch]);

  useEffect(() => {
    onSearchStateChange?.(query, dateFilter, filterState);
  }, [query, dateFilter, filterState, onSearchStateChange]);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowDatePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim() || dateFilter || anyColumnDateActive) {
      setIsOpen(true);
    }
  }, [query, dateFilter, anyColumnDateActive]);

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
    setIsOpen(false);
    setShowDatePicker(false);
    setShowFilters(false);
    setManualTrigger(0);
    resetManualTrigger();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setShowDatePicker(false);
      setShowFilters(false);
      inputRef.current?.blur();
    }
  };

  const closeAndReset = () => {
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
    setIsOpen(false);
    setShowDatePicker(false);
    setShowFilters(false);
    setManualTrigger(0);
    resetManualTrigger();
    onSearchStateChange?.('', null, null);
  };

  const handleCellClick = (result: CellSearchResult) => {
    const columnIndex = cellIdToColumnIndex(result.cellId);
    onSelectCell(
      result.locationId,
      result.boxId,
      result.boxName,
      result.boxAccentColor,
      result.boxType,
      result.cellId,
      result.boxType === 'slide' ? columnIndex : undefined,
    );
    closeAndReset();
  };

  const handleBoxClick = (result: BoxSearchResult) => {
    onSelectBox(result.locationId, result.boxId, result.boxName, result.boxAccentColor, result.boxType);
    closeAndReset();
  };

  const handleItemClick = (result: ItemSearchResult) => {
    onSelectItem(result.locationId, result.folderId, result.folderName);
    closeAndReset();
  };

  const handleItemCustomValueClick = (result: ItemCustomValueSearchResult) => {
    onSelectItem(result.locationId, result.folderId, result.folderName);
    closeAndReset();
  };

  const handleSlideValueClick = (result: SlideValueSearchResult) => {
    const columnIndex = cellIdToColumnIndex(result.cellId);
    onSelectCell(
      result.locationId,
      result.boxId,
      result.boxName,
      result.boxAccentColor,
      result.boxType,
      result.cellId,
      columnIndex,
    );
    closeAndReset();
  };

  const handleSlideHeaderClick = (result: SlideHeaderSearchResult) => {
    onSelectBox(result.locationId, result.boxId, result.boxName, result.boxAccentColor, result.boxType);
    closeAndReset();
  };

  const handleDateFilterChange = (filter: DateFilter | null) => {
    setDateFilter(filter);
    setShowDatePicker(false);
    if (filter) {
      setIsOpen(true);
    } else if (!query.trim()) {
      setIsOpen(false);
    }
  };

  const handleRemoveDateFilter = () => {
    setDateFilter(null);
    if (!query.trim()) {
      setIsOpen(false);
    }
  };

  const handleDateIconClick = () => {
    if (anyColumnDateActive) return;
    const opening = !showDatePicker;
    setShowDatePicker(opening);
    if (opening) setShowFilters(false);
  };

  const handleAddCustomFilter = (text: string) => {
    setCustomFilters((prev) =>
      prev.some(f => f.toLowerCase() === text.toLowerCase()) ? prev : [...prev, text],
    );
  };

  const handleRemoveCustomFilter = (index: number) => {
    setCustomFilters((prev) => prev.filter((_, i) => i !== index));
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

  const showDropdown = isOpen && (isSearching || hasResults || isEmpty || hasError);
  const isExpiringSearch = dateFilter?.mode === 'expiring_within';

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

  const slideDataTitle = slideHeaderFilters.length === 1
    ? `Slide Data -- ${slideHeaderFilters[0]}`
    : 'Slide Data';

  const itemCustomValueTitle = itemHeaderFilters.length === 1
    ? `Item Data -- ${itemHeaderFilters[0]}`
    : 'Item Data';

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center gap-1.5">
        <div className="relative flex-1">
          <button
            onClick={handleSearchIconClick}
            disabled={!canManualSearch}
            className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 transition-colors duration-200 ${
              canManualSearch
                ? 'text-blue-500 hover:text-blue-700 cursor-pointer'
                : 'text-gray-400 cursor-default'
            }`}
            title={canManualSearch ? 'Run search' : 'Search all locations'}
            type="button"
          >
            <Search size={16} />
          </button>
          <input
            ref={inputRef}
            type="text"
            data-tutorial-id="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => (query.trim() || dateFilter) && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search all locations..."
            className={`w-full pl-9 pr-[100px] py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all duration-200 placeholder:text-gray-400 ${
              variant === 'white'
                ? 'bg-white border-0 shadow-sm'
                : 'bg-gray-100/80 border border-gray-200/50 focus:bg-white focus:border-blue-300'
            }`}
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {(query || dateFilter) && (
              <button
                onClick={handleClear}
                className="p-1 rounded-md hover:bg-gray-200 transition-colors"
              >
                <X size={14} className="text-gray-400" />
              </button>
            )}
            <button
              onClick={() => {
                const opening = !showFilters;
                setShowFilters(opening);
                if (opening) setShowDatePicker(false);
              }}
              className={`relative p-1 rounded-md transition-all duration-200 ${
                showFilters || activeFilterCount > 0
                  ? 'text-blue-600'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/60'
              }`}
              title="Search filters"
            >
              <SlidersHorizontal size={14} />
              {activeFilterCount > 0 && !showFilters && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={handleDateIconClick}
              disabled={anyColumnDateActive}
              className={`p-1 rounded-md transition-all duration-200 ${
                anyColumnDateActive
                  ? 'text-gray-300 cursor-not-allowed'
                  : dateFilter
                    ? 'text-blue-600 hover:bg-blue-50'
                    : showDatePicker
                      ? 'text-gray-600 bg-gray-200/60'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/60'
              }`}
              title={anyColumnDateActive ? 'Disabled while column date filters are active' : 'Filter by date'}
            >
              <Calendar size={14} />
            </button>
            {onOpenSearchPage && (
              <button
                onClick={() => onOpenSearchPage(query, dateFilter, filterState)}
                className={`p-1 rounded-md transition-all duration-200 ${
                  hasPersistedSearch && !query && !dateFilter
                    ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/60'
                }`}
                title={hasPersistedSearch && !query && !dateFilter ? 'Return to search results' : 'Expand search'}
              >
                <Maximize2 size={14} />
              </button>
            )}
          </div>
        </div>
        {onOpenScanner && (
          <button
            onClick={onOpenScanner}
            className={`p-2 rounded-xl transition-all duration-200 flex-shrink-0 text-gray-400 hover:text-gray-600 ${
              variant === 'white'
                ? 'bg-white border-0 shadow-sm hover:bg-gray-50'
                : 'bg-gray-100/80 border border-gray-200/50 hover:bg-gray-200/80'
            }`}
            title="Scan QR code"
          >
            <ScanLine size={16} />
          </button>
        )}
        {showDatePicker && !anyColumnDateActive && (
          <div className="absolute top-full left-0 right-0 mt-2 z-[60]">
            <DateFilterPicker
              value={dateFilter}
              onChange={handleDateFilterChange}
              onClose={() => setShowDatePicker(false)}
              showDateTypeOptions
            />
          </div>
        )}
      </div>

      {(showFilters || (!showFilters && activeFilterCount > 0) || dateFilter || showDropdown) && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 flex flex-col gap-1.5">
          {showFilters && (
            <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-lg">
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
                onAddCustomFilter={handleAddCustomFilter}
                onRemoveCustomFilter={handleRemoveCustomFilter}
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
          )}

          {!showFilters && activeFilterCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap p-2 bg-white rounded-xl border border-gray-200 shadow-lg">
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
                    onClick={() => handleRemoveCustomFilter(i)}
                    className="p-0.5 rounded hover:bg-amber-100 transition-colors"
                  >
                    <X size={8} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {dateFilter && (
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-lg ${
                dateFilter.mode === 'expiring_within'
                  ? 'bg-white text-orange-600 border-orange-200'
                  : 'bg-white text-blue-700 border-gray-200'
              }`}>
                <DateFilterIcon size={12} />
                {getDateFilterLabel(dateFilter)}
                <button
                  onClick={handleRemoveDateFilter}
                  className={`ml-0.5 p-0.5 rounded transition-colors ${
                    dateFilter.mode === 'expiring_within'
                      ? 'hover:bg-orange-100'
                      : 'hover:bg-blue-100'
                  }`}
                >
                  <X size={10} />
                </button>
              </span>
            </div>
          )}

          {showDropdown && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden max-h-[400px] overflow-y-auto">
              {isSearching && (
                <div className="flex items-center justify-center py-4">
                  <SearchingLoader size={64} />
                </div>
              )}

              {!isSearching && hasError && (
                <div className="py-8 text-center text-red-500 text-sm">
                  Search failed. Please try again.
                </div>
              )}

              {!isSearching && isEmpty && (
                <div className="py-8 text-center text-gray-500 text-sm">
                  No results found
                </div>
              )}

              {!isSearching && hasResults && (
                <div className="py-2">
                  {results.slideMatches.length > 0 && (
                    <ResultSection title="Slide Matches">
                      {slideMatchGroups.map((entry) => {
                        if (entry.kind === 'single') {
                          const result = entry.item;
                          return (
                            <SlideCombinedResultItem
                              key={`sm-${result.boxId}-${result.cellId}-${entry.index}`}
                              result={result}
                              onClick={() => handleSlideValueClick({
                                type: 'slide_value',
                                matchedValue: result.values[0]?.value || '',
                                headerText: result.values[0]?.headerText || '',
                                displayOrder: result.values[0]?.displayOrder ?? 0,
                                cellId: result.cellId,
                                boxId: result.boxId,
                                boxName: result.boxName,
                                boxAccentColor: result.boxAccentColor,
                                boxType: result.boxType,
                                locationId: result.locationId,
                                locationName: result.locationName,
                                sublocationName: result.sublocationName,
                                positionName: result.positionName,
                                dateValue: result.dateValue,
                                dateType: result.dateType,
                              })}
                              showDate={!!dateFilter}
                              showDaysRemaining={isExpiringSearch}
                            />
                          );
                        }
                        const groupKey = `sb-sm:${entry.meta.boxId}`;
                        const expanded = dropdownExpandedGroups.has(groupKey);
                        return (
                          <React.Fragment key={groupKey}>
                            <BoxGroupHeaderItem
                              boxName={entry.meta.boxName}
                              boxAccentColor={entry.meta.boxAccentColor}
                              boxType="slide"
                              count={entry.items.length}
                              expanded={expanded}
                              breadcrumb={[entry.meta.positionName, entry.meta.sublocationName, entry.meta.locationName].filter(Boolean).join(' > ')}
                              onClick={() => toggleDropdownGroup(groupKey)}
                            />
                            {expanded && entry.items.map(({ item: result, index }) => (
                              <div key={`sm-${result.boxId}-${result.cellId}-${index}`} className="border-l-2 border-cyan-200 ml-3">
                                <SlideCombinedResultItem
                                  result={result}
                                  onClick={() => handleSlideValueClick({
                                    type: 'slide_value',
                                    matchedValue: result.values[0]?.value || '',
                                    headerText: result.values[0]?.headerText || '',
                                    displayOrder: result.values[0]?.displayOrder ?? 0,
                                    cellId: result.cellId,
                                    boxId: result.boxId,
                                    boxName: result.boxName,
                                    boxAccentColor: result.boxAccentColor,
                                    boxType: result.boxType,
                                    locationId: result.locationId,
                                    locationName: result.locationName,
                                    sublocationName: result.sublocationName,
                                    positionName: result.positionName,
                                    dateValue: result.dateValue,
                                    dateType: result.dateType,
                                  })}
                                  showDate={!!dateFilter}
                                  showDaysRemaining={isExpiringSearch}
                                />
                              </div>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </ResultSection>
                  )}

                  {results.slideValues.length > 0 && (
                    <ResultSection title={slideDataTitle}>
                      {slideValueGroups.map((entry) => {
                        if (entry.kind === 'single') {
                          const result = entry.item;
                          return (
                            <SlideValueResultItem
                              key={`sv-${result.boxId}-${result.cellId}-${entry.index}`}
                              result={result}
                              onClick={() => handleSlideValueClick(result)}
                              showDate={!!dateFilter}
                              showDaysRemaining={isExpiringSearch}
                            />
                          );
                        }
                        const groupKey = `sb-sv:${entry.meta.boxId}`;
                        const expanded = dropdownExpandedGroups.has(groupKey);
                        return (
                          <React.Fragment key={groupKey}>
                            <BoxGroupHeaderItem
                              boxName={entry.meta.boxName}
                              boxAccentColor={entry.meta.boxAccentColor}
                              boxType="slide"
                              count={entry.items.length}
                              expanded={expanded}
                              breadcrumb={[entry.meta.positionName, entry.meta.sublocationName, entry.meta.locationName].filter(Boolean).join(' > ')}
                              onClick={() => toggleDropdownGroup(groupKey)}
                            />
                            {expanded && entry.items.map(({ item: result, index }) => (
                              <div key={`sv-${result.boxId}-${result.cellId}-${index}`} className="border-l-2 border-cyan-200 ml-3">
                                <SlideValueResultItem
                                  result={result}
                                  onClick={() => handleSlideValueClick(result)}
                                  showDate={!!dateFilter}
                                  showDaysRemaining={isExpiringSearch}
                                />
                              </div>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </ResultSection>
                  )}

                  {results.cellMatches.length > 0 && (
                    <ResultSection title="Freezer Matches">
                      {cellMatchGroups.map((entry) => {
                        if (entry.kind === 'single') {
                          const result = entry.item;
                          return (
                            <CellCombinedResultItem
                              key={`cm-${result.boxId}-${result.cellId}-${entry.index}`}
                              result={result}
                              onClick={() => handleCellClick({
                                type: 'cell_title',
                                cellContent: result.name || result.information,
                                cellId: result.cellId,
                                boxId: result.boxId,
                                boxName: result.boxName,
                                boxAccentColor: result.boxAccentColor,
                                boxType: result.boxType,
                                locationId: result.locationId,
                                locationName: result.locationName,
                                sublocationName: result.sublocationName,
                                positionName: result.positionName,
                                dateValue: result.dateValue,
                                dateType: result.dateType,
                              })}
                              showDate={!!dateFilter}
                              showDaysRemaining={isExpiringSearch}
                            />
                          );
                        }
                        const groupKey = `sb-cm:${entry.meta.boxId}`;
                        const expanded = dropdownExpandedGroups.has(groupKey);
                        return (
                          <React.Fragment key={groupKey}>
                            <BoxGroupHeaderItem
                              boxName={entry.meta.boxName}
                              boxAccentColor={entry.meta.boxAccentColor}
                              boxType="freezer"
                              count={entry.items.length}
                              expanded={expanded}
                              breadcrumb={[entry.meta.positionName, entry.meta.sublocationName, entry.meta.locationName].filter(Boolean).join(' > ')}
                              onClick={() => toggleDropdownGroup(groupKey)}
                            />
                            {expanded && entry.items.map(({ item: result, index }) => (
                              <div key={`cm-${result.boxId}-${result.cellId}-${index}`} className="border-l-2 border-blue-200 ml-3">
                                <CellCombinedResultItem
                                  result={result}
                                  onClick={() => handleCellClick({
                                    type: 'cell_title',
                                    cellContent: result.name || result.information,
                                    cellId: result.cellId,
                                    boxId: result.boxId,
                                    boxName: result.boxName,
                                    boxAccentColor: result.boxAccentColor,
                                    boxType: result.boxType,
                                    locationId: result.locationId,
                                    locationName: result.locationName,
                                    sublocationName: result.sublocationName,
                                    positionName: result.positionName,
                                    dateValue: result.dateValue,
                                    dateType: result.dateType,
                                  })}
                                  showDate={!!dateFilter}
                                  showDaysRemaining={isExpiringSearch}
                                />
                              </div>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </ResultSection>
                  )}
                  {results.structuredFreezerMatches.length > 0 && (
                    <ResultSection title="Structured Freezer Matches">
                      {structuredFreezerGroups.map((entry) => {
                        if (entry.kind === 'single') {
                          const result = entry.item;
                          return (
                            <StructuredFreezerCombinedResultItem
                              key={`sfm-${result.boxId}-${result.cellId}-${entry.index}`}
                              result={result}
                              onClick={() => handleCellClick({
                                type: 'cell_title',
                                cellContent: result.name || result.values[0]?.value || result.information,
                                cellId: result.cellId,
                                boxId: result.boxId,
                                boxName: result.boxName,
                                boxAccentColor: result.boxAccentColor,
                                boxType: result.boxType,
                                locationId: result.locationId,
                                locationName: result.locationName,
                                sublocationName: result.sublocationName,
                                positionName: result.positionName,
                                dateValue: result.dateValue,
                                dateType: result.dateType,
                              })}
                              showDate={!!dateFilter}
                              showDaysRemaining={isExpiringSearch}
                            />
                          );
                        }
                        const groupKey = `sb-sfm:${entry.meta.boxId}`;
                        const expanded = dropdownExpandedGroups.has(groupKey);
                        return (
                          <React.Fragment key={groupKey}>
                            <BoxGroupHeaderItem
                              boxName={entry.meta.boxName}
                              boxAccentColor={entry.meta.boxAccentColor}
                              boxType="structured_freezer"
                              count={entry.items.length}
                              expanded={expanded}
                              breadcrumb={[entry.meta.positionName, entry.meta.sublocationName, entry.meta.locationName].filter(Boolean).join(' > ')}
                              onClick={() => toggleDropdownGroup(groupKey)}
                            />
                            {expanded && entry.items.map(({ item: result, index }) => (
                              <div key={`sfm-${result.boxId}-${result.cellId}-${index}`} className="border-l-2 border-blue-200 ml-3">
                                <StructuredFreezerCombinedResultItem
                                  result={result}
                                  onClick={() => handleCellClick({
                                    type: 'cell_title',
                                    cellContent: result.name || result.values[0]?.value || result.information,
                                    cellId: result.cellId,
                                    boxId: result.boxId,
                                    boxName: result.boxName,
                                    boxAccentColor: result.boxAccentColor,
                                    boxType: result.boxType,
                                    locationId: result.locationId,
                                    locationName: result.locationName,
                                    sublocationName: result.sublocationName,
                                    positionName: result.positionName,
                                    dateValue: result.dateValue,
                                    dateType: result.dateType,
                                  })}
                                  showDate={!!dateFilter}
                                  showDaysRemaining={isExpiringSearch}
                                />
                              </div>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </ResultSection>
                  )}

                  {results.itemCustomValues.length > 0 && (
                    <ResultSection title={itemCustomValueTitle}>
                      {results.itemCustomValues.map((result, index) => (
                        <ItemCustomValueResultItem
                          key={`icv-${result.itemId}-${index}`}
                          result={result}
                          onClick={() => handleItemCustomValueClick(result)}
                        />
                      ))}
                    </ResultSection>
                  )}

                  {results.cellTitles.length > 0 && (
                    <ResultSection title="Cell Titles">
                      {cellTitleGroups.map((entry) => {
                        if (entry.kind === 'single') {
                          const result = entry.item;
                          return (
                            <CellResultItem
                              key={`title-${result.boxId}-${result.cellId}-${entry.index}`}
                              result={result}
                              onClick={() => handleCellClick(result)}
                              showDate={!!dateFilter}
                              showDaysRemaining={isExpiringSearch}
                            />
                          );
                        }
                        const groupKey = `sb-ct:${entry.meta.boxId}`;
                        const expanded = dropdownExpandedGroups.has(groupKey);
                        return (
                          <React.Fragment key={groupKey}>
                            <BoxGroupHeaderItem
                              boxName={entry.meta.boxName}
                              boxAccentColor={entry.meta.boxAccentColor}
                              boxType="freezer"
                              count={entry.items.length}
                              expanded={expanded}
                              breadcrumb={[entry.meta.positionName, entry.meta.sublocationName, entry.meta.locationName].filter(Boolean).join(' > ')}
                              onClick={() => toggleDropdownGroup(groupKey)}
                            />
                            {expanded && entry.items.map(({ item: result, index }) => (
                              <div key={`title-${result.boxId}-${result.cellId}-${index}`} className="border-l-2 border-blue-200 ml-3">
                                <CellResultItem
                                  result={result}
                                  onClick={() => handleCellClick(result)}
                                  showDate={!!dateFilter}
                                  showDaysRemaining={isExpiringSearch}
                                />
                              </div>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </ResultSection>
                  )}

                  {results.cellInfo.length > 0 && (
                    <ResultSection title="Cell Info">
                      {cellInfoGroups.map((entry) => {
                        if (entry.kind === 'single') {
                          const result = entry.item;
                          return (
                            <CellResultItem
                              key={`info-${result.boxId}-${result.cellId}-${entry.index}`}
                              result={result}
                              onClick={() => handleCellClick(result)}
                              showDate={!!dateFilter}
                              showDaysRemaining={isExpiringSearch}
                            />
                          );
                        }
                        const groupKey = `sb-ci:${entry.meta.boxId}`;
                        const expanded = dropdownExpandedGroups.has(groupKey);
                        return (
                          <React.Fragment key={groupKey}>
                            <BoxGroupHeaderItem
                              boxName={entry.meta.boxName}
                              boxAccentColor={entry.meta.boxAccentColor}
                              boxType="freezer"
                              count={entry.items.length}
                              expanded={expanded}
                              breadcrumb={[entry.meta.positionName, entry.meta.sublocationName, entry.meta.locationName].filter(Boolean).join(' > ')}
                              onClick={() => toggleDropdownGroup(groupKey)}
                            />
                            {expanded && entry.items.map(({ item: result, index }) => (
                              <div key={`info-${result.boxId}-${result.cellId}-${index}`} className="border-l-2 border-blue-200 ml-3">
                                <CellResultItem
                                  result={result}
                                  onClick={() => handleCellClick(result)}
                                  showDate={!!dateFilter}
                                  showDaysRemaining={isExpiringSearch}
                                />
                              </div>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </ResultSection>
                  )}

                  {results.slideHeaders.length > 0 && (
                    <ResultSection title="Slide Headers">
                      {slideHeaderGroups.map((entry) => {
                        if (entry.kind === 'single') {
                          const result = entry.item;
                          return (
                            <SlideHeaderResultItem
                              key={`sh-${result.boxId}-${entry.index}`}
                              result={result}
                              onClick={() => handleSlideHeaderClick(result)}
                            />
                          );
                        }
                        const groupKey = `sb-sh:${entry.meta.boxId}`;
                        const expanded = dropdownExpandedGroups.has(groupKey);
                        return (
                          <React.Fragment key={groupKey}>
                            <BoxGroupHeaderItem
                              boxName={entry.meta.boxName}
                              boxAccentColor={entry.meta.boxAccentColor}
                              boxType="slide"
                              count={entry.items.length}
                              expanded={expanded}
                              breadcrumb={[entry.meta.positionName, entry.meta.sublocationName, entry.meta.locationName].filter(Boolean).join(' > ')}
                              onClick={() => toggleDropdownGroup(groupKey)}
                            />
                            {expanded && entry.items.map(({ item: result, index }) => (
                              <div key={`sh-${result.boxId}-${index}`} className="border-l-2 border-teal-200 ml-3">
                                <SlideHeaderResultItem
                                  result={result}
                                  onClick={() => handleSlideHeaderClick(result)}
                                />
                              </div>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </ResultSection>
                  )}

                  {results.boxes.length > 0 && (
                    <ResultSection title="Boxes">
                      {results.boxes.map((result) => (
                        <BoxResultItem
                          key={result.boxId}
                          result={result}
                          onClick={() => handleBoxClick(result)}
                        />
                      ))}
                    </ResultSection>
                  )}

                  {results.items.length > 0 && (
                    <ResultSection title="Items">
                      {results.items.map((result) => (
                        <ItemResultItem
                          key={result.itemId}
                          result={result}
                          onClick={() => handleItemClick(result)}
                        />
                      ))}
                    </ResultSection>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBox;
