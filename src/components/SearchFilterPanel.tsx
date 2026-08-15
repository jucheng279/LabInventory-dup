import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Grid2x2 as Grid2X2,
  Layers,
  Package,
  X,
  Plus,
  Bookmark,
  ChevronDown,
  Trash2,
  Type,
  Info,
  Columns3,
  Calendar,
  Table2,
  Check,
} from 'lucide-react';
import type {
  SearchFilterScopes,
  SearchFilterScopeValue,
  FreezerSubFilters,
  FreezerSubFilterValue,
  SavedSearchFilter,
  SlideHeaderInfo,
  ItemFolderHeaderInfo,
  FreezerHeaderInfo,
  ItemSubFilters,
  ItemSubFilterValue,
  ColumnDateFilters,
  DateFilter,
} from '../types/search';
import DateFilterPicker from './DateFilterPicker';
import { getDateFilterLabel, getDateFilterIcon } from './DateFilterPicker';

interface SearchFilterPanelProps {
  scopes: SearchFilterScopes;
  onScopesChange: (scopes: SearchFilterScopes) => void;
  customFilters: string[];
  onAddCustomFilter: (text: string) => void;
  onRemoveCustomFilter: (index: number) => void;
  freezerSubFilters: FreezerSubFilters;
  onFreezerSubFiltersChange: (filters: FreezerSubFilters) => void;
  freezerHeaders: FreezerHeaderInfo[];
  freezerHeaderFilters: string[];
  onFreezerHeaderFiltersChange: (headers: string[]) => void;
  freezerDateFilters: ColumnDateFilters;
  onFreezerDateFiltersChange: (filters: ColumnDateFilters) => void;
  slideHeaderFilters: string[];
  onSlideHeaderFiltersChange: (headers: string[]) => void;
  slideHeaders: SlideHeaderInfo[];
  savedFilters: SavedSearchFilter[];
  onSaveFilter: (text: string) => void;
  onDeleteSavedFilter: (id: string) => void;
  slideDateFilters: ColumnDateFilters;
  onSlideDateFiltersChange: (filters: ColumnDateFilters) => void;
  itemSubFilters: ItemSubFilters;
  onItemSubFiltersChange: (filters: ItemSubFilters) => void;
  itemHeaderFilters: string[];
  onItemHeaderFiltersChange: (headers: string[]) => void;
  itemFolderNameFilter: string | null;
  onItemFolderNameFilterChange: (name: string | null) => void;
  itemFolderHeaders: ItemFolderHeaderInfo[];
  itemFolderNames: string[];
  itemDateFilters: ColumnDateFilters;
  onItemDateFiltersChange: (filters: ColumnDateFilters) => void;
}

const SCOPE_OPTIONS: { value: SearchFilterScopeValue; label: string; icon: React.ReactNode; activeColor: string; labelColor: string }[] = [
  {
    value: 'freezer_box',
    label: 'Freezer Box',
    icon: <Grid2X2 size={14} />,
    activeColor: 'text-blue-700 bg-blue-50 border-blue-200',
    labelColor: 'text-blue-600',
  },
  {
    value: 'slide_box',
    label: 'Slide Box',
    icon: <Layers size={14} />,
    activeColor: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    labelColor: 'text-cyan-600',
  },
  {
    value: 'item',
    label: 'Item',
    icon: <Package size={14} />,
    activeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    labelColor: 'text-emerald-600',
  },
];

const FREEZER_SUB_OPTIONS: { value: FreezerSubFilterValue; label: string; icon: React.ReactNode }[] = [
  { value: 'name', label: 'Name', icon: <Type size={12} /> },
  { value: 'info', label: 'Info', icon: <Info size={12} /> },
];

const ITEM_SUB_OPTIONS: { value: ItemSubFilterValue; label: string; icon: React.ReactNode }[] = [
  { value: 'name', label: 'Name', icon: <Type size={12} /> },
  { value: 'folder_name', label: 'Sheet', icon: <Table2 size={12} /> },
  { value: 'column_header', label: 'Column', icon: <Columns3 size={12} /> },
];

function toggleArrayItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

const SearchFilterPanel: React.FC<SearchFilterPanelProps> = ({
  scopes,
  onScopesChange,
  customFilters,
  onAddCustomFilter,
  onRemoveCustomFilter,
  freezerSubFilters,
  onFreezerSubFiltersChange,
  freezerHeaders,
  freezerHeaderFilters,
  onFreezerHeaderFiltersChange,
  freezerDateFilters,
  onFreezerDateFiltersChange,
  slideHeaderFilters,
  onSlideHeaderFiltersChange,
  slideHeaders,
  savedFilters,
  onSaveFilter,
  onDeleteSavedFilter,
  slideDateFilters,
  onSlideDateFiltersChange,
  itemSubFilters,
  onItemSubFiltersChange,
  itemHeaderFilters,
  onItemHeaderFiltersChange,
  itemFolderNameFilter,
  onItemFolderNameFilterChange,
  itemFolderHeaders,
  itemFolderNames,
  itemDateFilters,
  onItemDateFiltersChange,
}) => {
  const [filterInput, setFilterInput] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [showSlideHeaderDropdown, setShowSlideHeaderDropdown] = useState(false);
  const [showItemHeaderDropdown, setShowItemHeaderDropdown] = useState(false);
  const [showFreezerHeaderDropdown, setShowFreezerHeaderDropdown] = useState(false);
  const [openDatePickerKey, setOpenDatePickerKey] = useState<string | null>(null);
  const savedDropdownRef = useRef<HTMLDivElement>(null);
  const slideHeaderDropdownRef = useRef<HTMLDivElement>(null);
  const itemHeaderDropdownRef = useRef<HTMLDivElement>(null);
  const freezerHeaderDropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const selectedSlideDateHeaders = useMemo(() => {
    return slideHeaderFilters.filter((h) => {
      const info = slideHeaders.find((sh) => sh.headerText === h);
      return info?.headerType === 'date' || info?.headerType === 'expiration';
    });
  }, [slideHeaderFilters, slideHeaders]);

  const selectedItemDateHeaders = useMemo(() => {
    return itemHeaderFilters.filter((h) => {
      const info = itemFolderHeaders.find((ih) => ih.headerText === h);
      return info?.headerType === 'date' || info?.headerType === 'expiration';
    });
  }, [itemHeaderFilters, itemFolderHeaders]);

  const selectedFreezerDateHeaders = useMemo(() => {
    return freezerHeaderFilters.filter((h) => {
      const info = freezerHeaders.find((fh) => fh.headerText === h);
      return info?.headerType === 'date' || info?.headerType === 'expiration';
    });
  }, [freezerHeaderFilters, freezerHeaders]);

  // Clean up date filters when headers are removed
  useEffect(() => {
    const validKeys = Object.keys(slideDateFilters).filter((k) => selectedSlideDateHeaders.includes(k));
    if (validKeys.length !== Object.keys(slideDateFilters).length) {
      const cleaned: ColumnDateFilters = {};
      for (const k of validKeys) cleaned[k] = slideDateFilters[k];
      onSlideDateFiltersChange(cleaned);
    }
  }, [selectedSlideDateHeaders, slideDateFilters, onSlideDateFiltersChange]);

  useEffect(() => {
    const validKeys = Object.keys(itemDateFilters).filter((k) => selectedItemDateHeaders.includes(k));
    if (validKeys.length !== Object.keys(itemDateFilters).length) {
      const cleaned: ColumnDateFilters = {};
      for (const k of validKeys) cleaned[k] = itemDateFilters[k];
      onItemDateFiltersChange(cleaned);
    }
  }, [selectedItemDateHeaders, itemDateFilters, onItemDateFiltersChange]);

  useEffect(() => {
    const validKeys = Object.keys(freezerDateFilters).filter((k) => selectedFreezerDateHeaders.includes(k));
    if (validKeys.length !== Object.keys(freezerDateFilters).length) {
      const cleaned: ColumnDateFilters = {};
      for (const k of validKeys) cleaned[k] = freezerDateFilters[k];
      onFreezerDateFiltersChange(cleaned);
    }
  }, [selectedFreezerDateHeaders, freezerDateFilters, onFreezerDateFiltersChange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (savedDropdownRef.current && !savedDropdownRef.current.contains(event.target as Node)) {
        setShowSaved(false);
      }
      if (slideHeaderDropdownRef.current && !slideHeaderDropdownRef.current.contains(event.target as Node)) {
        setShowSlideHeaderDropdown(false);
      }
      if (itemHeaderDropdownRef.current && !itemHeaderDropdownRef.current.contains(event.target as Node)) {
        setShowItemHeaderDropdown(false);
      }
      if (freezerHeaderDropdownRef.current && !freezerHeaderDropdownRef.current.contains(event.target as Node)) {
        setShowFreezerHeaderDropdown(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setOpenDatePickerKey(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddFilter = () => {
    const parts = filterInput.split(',').map(s => s.trim()).filter(Boolean);
    const unique = parts.filter(
      (p, i) =>
        parts.findIndex(q => q.toLowerCase() === p.toLowerCase()) === i &&
        !customFilters.some(f => f.toLowerCase() === p.toLowerCase()),
    );
    if (unique.length > 0) {
      unique.forEach(t => onAddCustomFilter(t));
      setFilterInput('');
    }
  };

  const handleFilterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAddFilter();
    }
  };

  const handleSaveFilter = () => {
    const text = filterInput.trim();
    if (text) {
      onSaveFilter(text);
      setFilterInput('');
    }
  };

  const handleApplySaved = (filterText: string) => {
    if (!customFilters.some(f => f.toLowerCase() === filterText.toLowerCase())) {
      onAddCustomFilter(filterText);
    }
    setShowSaved(false);
  };

  const handleScopeClick = (value: SearchFilterScopeValue) => {
    onScopesChange(toggleArrayItem(scopes, value));
  };

  const handleToggleSlideHeader = (headerText: string) => {
    onSlideHeaderFiltersChange(toggleArrayItem(slideHeaderFilters, headerText));
  };

  const handleToggleFreezerHeader = (headerText: string) => {
    onFreezerHeaderFiltersChange(toggleArrayItem(freezerHeaderFilters, headerText));
  };

  const handleToggleItemHeader = (headerText: string) => {
    onItemHeaderFiltersChange(toggleArrayItem(itemHeaderFilters, headerText));
  };

  const handleColumnDateChange = (
    category: 'slide' | 'freezer' | 'item',
    columnName: string,
    filter: DateFilter | null,
  ) => {
    if (category === 'slide') {
      const next = { ...slideDateFilters };
      if (filter) next[columnName] = filter;
      else delete next[columnName];
      onSlideDateFiltersChange(next);
    } else if (category === 'freezer') {
      const next = { ...freezerDateFilters };
      if (filter) next[columnName] = filter;
      else delete next[columnName];
      onFreezerDateFiltersChange(next);
    } else {
      const next = { ...itemDateFilters };
      if (filter) next[columnName] = filter;
      else delete next[columnName];
      onItemDateFiltersChange(next);
    }
    setOpenDatePickerKey(null);
  };

  const freezerHeaderLabel = freezerHeaderFilters.length === 0
    ? 'All Headers'
    : freezerHeaderFilters.length === 1
      ? freezerHeaderFilters[0]
      : `${freezerHeaderFilters.length} headers`;

  const slideHeaderLabel = slideHeaderFilters.length === 0
    ? 'All Columns'
    : slideHeaderFilters.length === 1
      ? slideHeaderFilters[0]
      : `${slideHeaderFilters.length} columns`;

  const itemHeaderLabel = itemHeaderFilters.length === 0
    ? 'All Columns'
    : itemHeaderFilters.length === 1
      ? itemHeaderFilters[0]
      : `${itemHeaderFilters.length} columns`;

  const renderColumnDateFilters = (
    category: 'slide' | 'freezer' | 'item',
    dateHeaders: string[],
    dateFilters: ColumnDateFilters,
    colorClass: string,
  ) => {
    if (dateHeaders.length === 0) return null;
    return (
      <div className="flex items-center gap-1.5 flex-wrap pl-1">
        {dateHeaders.map((headerName) => {
          const filter = dateFilters[headerName] || null;
          const pickerKey = `${category}-${headerName}`;
          const isOpen = openDatePickerKey === pickerKey;
          return (
            <div key={pickerKey} className="relative" ref={isOpen ? datePickerRef : undefined}>
              <button
                onClick={() => setOpenDatePickerKey(isOpen ? null : pickerKey)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-all duration-150 ${
                  filter
                    ? `${colorClass}`
                    : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50'
                }`}
                title={`Date filter for "${headerName}"`}
              >
                {filter ? (
                  <>
                    {React.createElement(getDateFilterIcon(filter), { size: 12 })}
                    <span className="max-w-[80px] truncate">{headerName}</span>
                    <span className="text-[10px] opacity-70 max-w-[60px] truncate">{getDateFilterLabel(filter)}</span>
                  </>
                ) : (
                  <>
                    <Calendar size={12} />
                    <span className="max-w-[100px] truncate">{headerName}</span>
                  </>
                )}
              </button>
              {isOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-[300px]">
                  <DateFilterPicker
                    value={filter}
                    onChange={(f) => handleColumnDateChange(category, headerName, f)}
                    onClose={() => setOpenDatePickerKey(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderActiveColumnDateTags = (
    category: 'slide' | 'freezer' | 'item',
    dateFilters: ColumnDateFilters,
    tagColorClass: string,
    hoverClass: string,
  ) => {
    const entries = Object.entries(dateFilters);
    if (entries.length === 0) return null;
    return (
      <div className="flex items-center gap-1.5 flex-wrap pl-1">
        {entries.map(([headerName, filter]) => (
          <span
            key={`${category}-tag-${headerName}`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${tagColorClass}`}
          >
            {React.createElement(getDateFilterIcon(filter), { size: 10 })}
            <span className="max-w-[80px] truncate">{headerName}:</span>
            <span className="max-w-[80px] truncate">{getDateFilterLabel(filter)}</span>
            <button
              onClick={() => handleColumnDateChange(category, headerName, null)}
              className={`p-0.5 rounded ${hoverClass} transition-colors`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {SCOPE_OPTIONS.map((opt) => {
          const isActive = scopes.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => handleScopeClick(opt.value)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
                isActive ? opt.activeColor : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>

      {scopes.includes('freezer_box') && (
        <div className="space-y-1.5">
          {scopes.length > 1 && (
            <div className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${SCOPE_OPTIONS[0].labelColor}`}>
              <Grid2X2 size={10} />
              Freezer Box
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 pl-1">
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mr-1">Field:</span>
              {FREEZER_SUB_OPTIONS.map((opt) => {
                const isActive = freezerSubFilters.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => onFreezerSubFiltersChange(toggleArrayItem(freezerSubFilters, opt.value))}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-all duration-150 ${
                      isActive
                        ? 'text-blue-700 bg-blue-50 border-blue-200'
                        : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {freezerSubFilters.includes('info') && freezerHeaders.length > 0 && (
              <div className="flex items-center gap-1.5 pl-1">
                <Columns3 size={12} className="text-gray-400 flex-shrink-0" />
                <div ref={freezerHeaderDropdownRef} className="relative flex-1 max-w-[200px]">
                  <button
                    onClick={() => setShowFreezerHeaderDropdown(!showFreezerHeaderDropdown)}
                    className="w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[11px] font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <span className="truncate">{freezerHeaderLabel}</span>
                    <ChevronDown size={12} className="text-gray-400 flex-shrink-0 ml-1" />
                  </button>
                  {showFreezerHeaderDropdown && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1 max-h-48 overflow-y-auto">
                      {freezerHeaders.map((h) => {
                        const isSelected = freezerHeaderFilters.includes(h.headerText);
                        return (
                          <button
                            key={h.headerText}
                            onClick={() => handleToggleFreezerHeader(h.headerText)}
                            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'
                            }`}>
                              {isSelected && <Check size={10} />}
                            </span>
                            <span className="truncate">{h.headerText}</span>
                            {h.headerType !== 'text' && (
                              <span className="text-[10px] text-gray-400 ml-auto">({h.headerType})</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {renderColumnDateFilters('freezer', selectedFreezerDateHeaders, freezerDateFilters, 'text-blue-700 bg-blue-50 border-blue-200')}
            {renderActiveColumnDateTags('freezer', freezerDateFilters, 'bg-blue-50 text-blue-800 border-blue-200', 'hover:bg-blue-100')}
          </div>
        </div>
      )}

      {scopes.includes('slide_box') && (
        <div className="space-y-1.5">
          {scopes.length > 1 && (
            <div className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${SCOPE_OPTIONS[1].labelColor}`}>
              <Layers size={10} />
              Slide Box
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 pl-1">
              <Columns3 size={12} className="text-gray-400 flex-shrink-0" />
              <div ref={slideHeaderDropdownRef} className="relative flex-1 max-w-[200px]">
                <button
                  onClick={() => setShowSlideHeaderDropdown(!showSlideHeaderDropdown)}
                  className="w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[11px] font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <span className="truncate">{slideHeaderLabel}</span>
                  <ChevronDown size={12} className="text-gray-400 flex-shrink-0 ml-1" />
                </button>
                {showSlideHeaderDropdown && (
                  <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1 max-h-48 overflow-y-auto">
                    {slideHeaders.map((h) => {
                      const isSelected = slideHeaderFilters.includes(h.headerText);
                      return (
                        <button
                          key={h.headerText}
                          onClick={() => handleToggleSlideHeader(h.headerText)}
                          className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check size={10} />}
                          </span>
                          <span className="truncate">{h.headerText}</span>
                          {h.headerType !== 'text' && (
                            <span className="text-[10px] text-gray-400 ml-auto">({h.headerType})</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {renderColumnDateFilters('slide', selectedSlideDateHeaders, slideDateFilters, 'text-cyan-700 bg-cyan-50 border-cyan-200')}
            {renderActiveColumnDateTags('slide', slideDateFilters, 'bg-cyan-50 text-cyan-800 border-cyan-200', 'hover:bg-cyan-100')}
          </div>
        </div>
      )}

      {scopes.includes('item') && (
        <div className="space-y-1.5">
          {scopes.length > 1 && (
            <div className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${SCOPE_OPTIONS[2].labelColor}`}>
              <Package size={10} />
              Item
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 pl-1">
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mr-1">Field:</span>
              {ITEM_SUB_OPTIONS.map((opt) => {
                const isActive = itemSubFilters.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => onItemSubFiltersChange(toggleArrayItem(itemSubFilters, opt.value))}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-all duration-150 ${
                      isActive
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {itemSubFilters.includes('folder_name') && (
              <div className="flex items-center gap-1.5 pl-1">
                <Table2 size={12} className="text-gray-400 flex-shrink-0" />
                <div className="relative flex-1 max-w-[200px]">
                  <select
                    value={itemFolderNameFilter || ''}
                    onChange={(e) => onItemFolderNameFilterChange(e.target.value || null)}
                    className="w-full appearance-none px-2.5 py-1 pr-7 rounded-md text-[11px] font-medium border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-300 transition-colors cursor-pointer"
                  >
                    <option value="">All Sheets</option>
                    {itemFolderNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            {itemSubFilters.includes('column_header') && (
              <div className="flex items-center gap-1.5 pl-1">
                <Columns3 size={12} className="text-gray-400 flex-shrink-0" />
                <div ref={itemHeaderDropdownRef} className="relative flex-1 max-w-[200px]">
                  <button
                    onClick={() => setShowItemHeaderDropdown(!showItemHeaderDropdown)}
                    className="w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[11px] font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <span className="truncate">{itemHeaderLabel}</span>
                    <ChevronDown size={12} className="text-gray-400 flex-shrink-0 ml-1" />
                  </button>
                  {showItemHeaderDropdown && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1 max-h-48 overflow-y-auto">
                      {itemFolderHeaders.map((h) => {
                        const isSelected = itemHeaderFilters.includes(h.headerText);
                        return (
                          <button
                            key={h.headerText}
                            onClick={() => handleToggleItemHeader(h.headerText)}
                            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'
                            }`}>
                              {isSelected && <Check size={10} />}
                            </span>
                            <span className="truncate">{h.headerText}</span>
                            {h.headerType !== 'text' && (
                              <span className="text-[10px] text-gray-400 ml-auto">({h.headerType})</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {renderColumnDateFilters('item', selectedItemDateHeaders, itemDateFilters, 'text-emerald-700 bg-emerald-50 border-emerald-200')}
            {renderActiveColumnDateTags('item', itemDateFilters, 'bg-emerald-50 text-emerald-800 border-emerald-200', 'hover:bg-emerald-100')}
          </div>
        </div>
      )}


      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={filterInput}
          onChange={(e) => setFilterInput(e.target.value)}
          onKeyDown={handleFilterKeyDown}
          placeholder="Add text filter..."
          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-300 placeholder:text-gray-400 transition-colors"
        />
        <button
          onClick={handleAddFilter}
          disabled={!filterInput.trim()}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          title="Add filter"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={handleSaveFilter}
          disabled={!filterInput.trim()}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          title="Save filter for later"
        >
          <Bookmark size={14} />
        </button>
        {savedFilters.length > 0 && (
          <div ref={savedDropdownRef} className="relative">
            <button
              onClick={() => setShowSaved(!showSaved)}
              className={`p-1.5 rounded-lg border transition-colors ${
                showSaved
                  ? 'bg-amber-50 border-amber-200 text-amber-600'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
              title="Saved filters"
            >
              <ChevronDown size={14} />
            </button>
            {showSaved && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1 max-h-48 overflow-y-auto">
                <div className="px-2.5 py-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                  Saved Filters
                </div>
                {savedFilters.map((sf) => (
                  <div
                    key={sf.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 group"
                  >
                    <button
                      onClick={() => handleApplySaved(sf.filterText)}
                      className="flex-1 text-left text-xs text-gray-700 truncate"
                    >
                      {sf.filterText}
                    </button>
                    <button
                      onClick={() => onDeleteSavedFilter(sf.id)}
                      className="flex-shrink-0 p-0.5 rounded text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 touch-visible transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {customFilters.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {customFilters.map((text, i) => (
            <span
              key={`${text}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md text-[11px] font-medium border border-amber-200"
            >
              {text}
              <button
                onClick={() => onRemoveCustomFilter(i)}
                className="p-0.5 rounded hover:bg-amber-100 transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchFilterPanel;
