import React, { useState, useMemo, useCallback } from 'react';
import {
  Grid2x2 as Grid2X2,
  Layers,
  Package,
  Table2,
  LayoutList,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { groupByBox } from '../utils/searchGroupUtils';
import type { BoxMeta, BoxGroupItem } from '../utils/searchGroupUtils';
import type { SearchResults } from '../types/search';
import type {
  CellSearchResult,
  CellCombinedSearchResult,
  BoxSearchResult,
  ItemSearchResult,
  ItemCustomValueSearchResult,
  SlideValueSearchResult,
  SlideCombinedSearchResult,
  SlideHeaderSearchResult,
  StructuredFreezerCombinedSearchResult,
} from '../services/searchService';
import { getItemTypeIcon } from '../utils/itemTypeIcons';
import { ItemType } from '../services/itemService';

interface SearchPageTableResultsProps {
  results: SearchResults;
  showDate: boolean;
  showDaysRemaining: boolean;
  slideHeaderFilters: string[];
  itemHeaderFilters: string[];
  onCellClick: (result: CellSearchResult) => void;
  onCellCombinedClick: (result: CellCombinedSearchResult) => void;
  onBoxClick: (result: BoxSearchResult) => void;
  onItemClick: (result: ItemSearchResult) => void;
  onItemCustomValueClick: (result: ItemCustomValueSearchResult) => void;
  onSlideValueClick: (result: SlideValueSearchResult) => void;
  onSlideCombinedClick: (result: SlideCombinedSearchResult) => void;
  onStructuredFreezerCombinedClick: (result: StructuredFreezerCombinedSearchResult) => void;
  onSlideHeaderClick: (result: SlideHeaderSearchResult) => void;
}

function formatDaysRemaining(dateValue: string): string | null {
  const target = new Date(dateValue + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return null;
  if (diff === 0) return 'today';
  if (diff === 1) return '1 day';
  return `${diff} days`;
}


// --- Collapsible Section ---

interface CollapsibleSectionProps {
  id: string;
  title: string;
  count: number;
  accentColor: string;
  borderColor: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  id,
  title,
  count,
  accentColor,
  borderColor,
  icon,
  children,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div id={id} className="mb-6 last:mb-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-t-xl border ${borderColor} ${isOpen ? 'rounded-b-none' : 'rounded-b-xl'} bg-white hover:bg-gray-50 transition-colors`}
      >
        <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${accentColor} flex items-center justify-center`}>
          {icon}
        </div>
        <span className="font-semibold text-sm text-gray-800">{title}</span>
        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
          {count}
        </span>
        <div className="flex-1" />
        {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {isOpen && (
        <div className={`border border-t-0 ${borderColor} rounded-b-xl overflow-hidden`}>
          {children}
        </div>
      )}
    </div>
  );
};

const LocationCell: React.FC<{ value: string | null; className?: string }> = ({ value, className }) => (
  <td className={`px-3 py-2.5 text-xs text-gray-500 ${className || ''}`}>
    {value || <span className="text-gray-300">--</span>}
  </td>
);

// --- Box Group Header Row (rendered inside a table) ---

interface BoxGroupHeaderProps {
  meta: BoxMeta;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  colSpan: number;
  hoverColor: string;
  accentBg: string;
  icon: React.ReactNode;
}

const BoxGroupHeader: React.FC<BoxGroupHeaderProps> = ({
  meta,
  count,
  expanded,
  onToggle,
  colSpan,
  hoverColor,
  accentBg,
  icon,
}) => {
  const breadcrumb = [meta.positionName, meta.sublocationName, meta.locationName].filter(Boolean).join(' / ');
  return (
    <tr
      onClick={onToggle}
      className={`${hoverColor} cursor-pointer transition-colors ${expanded ? 'bg-gray-50/60' : ''}`}
    >
      <td colSpan={colSpan} className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div
            className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${accentBg}`}
            style={meta.boxAccentColor ? { backgroundColor: `${meta.boxAccentColor}20` } : undefined}
          >
            {icon}
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm font-semibold text-gray-800 truncate">{meta.boxName}</span>
            <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-600">
              {count} result{count !== 1 ? 's' : ''}
            </span>
            {breadcrumb && (
              <span className="hidden sm:inline text-[11px] text-gray-400 truncate">{breadcrumb}</span>
            )}
          </div>
          {expanded ? (
            <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
          )}
        </div>
      </td>
    </tr>
  );
};

// --- Date Cell helper ---

const DateCell: React.FC<{ dateValue: string | null; dateType: string | null; showDate: boolean; showDaysRemaining: boolean }> = ({
  dateValue,
  dateType,
  showDate,
  showDaysRemaining,
}) => {
  if (!showDate) return null;
  const isExpiration = dateType === 'expiration';
  const daysLabel = showDaysRemaining && isExpiration && dateValue ? formatDaysRemaining(dateValue) : null;
  return (
    <td className="px-3 py-2.5">
      {dateValue ? (
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border ${
            isExpiration
              ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-gray-100 text-gray-600 border-gray-200'
          }`}>
            {isExpiration ? <AlertTriangle size={9} /> : <Calendar size={9} />}
            {dateValue}
          </span>
          {daysLabel && (
            <span className="text-[10px] text-orange-500 font-medium">{daysLabel}</span>
          )}
        </div>
      ) : (
        <span className="text-gray-300 text-xs">--</span>
      )}
    </td>
  );
};

// --- Main Component ---

const SearchPageTableResults: React.FC<SearchPageTableResultsProps> = ({
  results,
  showDate,
  showDaysRemaining,
  slideHeaderFilters,
  itemHeaderFilters,
  onCellClick,
  onCellCombinedClick,
  onBoxClick,
  onItemClick,
  onItemCustomValueClick,
  onSlideValueClick,
  onStructuredFreezerCombinedClick,
  onSlideCombinedClick,
  onSlideHeaderClick,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const itemCustomValueTitle = itemHeaderFilters.length === 1 ? `Item Data -- ${itemHeaderFilters[0]}` : 'Item Data';
  const slideDataTitle = slideHeaderFilters.length === 1 ? `Slide Data -- ${slideHeaderFilters[0]}` : 'Slide Data';

  const slideMatchGroups = useMemo(() => groupByBox(results.slideMatches), [results.slideMatches]);
  const cellMatchGroups = useMemo(() => groupByBox(results.cellMatches), [results.cellMatches]);
  const structuredFreezerGroups = useMemo(() => groupByBox(results.structuredFreezerMatches), [results.structuredFreezerMatches]);
  const slideValueGroups = useMemo(() => groupByBox(results.slideValues), [results.slideValues]);
  const cellTitleGroups = useMemo(() => groupByBox(results.cellTitles), [results.cellTitles]);
  const cellInfoGroups = useMemo(() => groupByBox(results.cellInfo), [results.cellInfo]);
  const slideHeaderGroups = useMemo(() => groupByBox(results.slideHeaders), [results.slideHeaders]);

  const allGroupKeys = useMemo(() => {
    const keys: string[] = [];
    const collect = (groups: BoxGroupItem<any>[], prefix: string) => {
      for (const g of groups) {
        if (g.kind === 'group') keys.push(`${prefix}:${g.meta.boxId}`);
      }
    };
    collect(slideMatchGroups, 'sm');
    collect(cellMatchGroups, 'cm');
    collect(structuredFreezerGroups, 'sfm');
    collect(slideValueGroups, 'sv');
    collect(cellTitleGroups, 'ct');
    collect(cellInfoGroups, 'ci');
    collect(slideHeaderGroups, 'sh');
    return keys;
  }, [slideMatchGroups, cellMatchGroups, structuredFreezerGroups, slideValueGroups, cellTitleGroups, cellInfoGroups, slideHeaderGroups]);

  const hasAnyGroups = allGroupKeys.length > 0;
  const allExpanded = hasAnyGroups && allGroupKeys.every((k) => expandedGroups.has(k));

  const handleExpandAll = useCallback(() => {
    setExpandedGroups(new Set(allGroupKeys));
  }, [allGroupKeys]);

  const handleCollapseAll = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  const baseColCount = 7;
  const dateColCount = showDate ? baseColCount + 1 : baseColCount;

  return (
    <div className="space-y-6">
      {hasAnyGroups && (
        <div className="flex justify-end">
          <button
            onClick={allExpanded ? handleCollapseAll : handleExpandAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {allExpanded ? (
              <>
                <ChevronsUp size={13} />
                Collapse all
              </>
            ) : (
              <>
                <ChevronsDown size={13} />
                Expand all
              </>
            )}
          </button>
        </div>
      )}
      {results.slideMatches.length > 0 && (
        <CollapsibleSection
          id="section-slide-matches"
          title="Slide Matches"
          count={results.slideMatches.length}
          accentColor="bg-cyan-100"
          borderColor="border-cyan-200"
          icon={<Table2 size={14} className="text-cyan-700" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Slide</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Cell</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Box</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Position</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Sublocation</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                  {showDate && <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {slideMatchGroups.map((entry) => {
                  if (entry.kind === 'single') {
                    const result = entry.item;
                    const primary = result.values[0]?.value || '--';
                    const rest = result.values.slice(1);
                    return (
                      <tr
                        key={`sm-${result.boxId}-${result.cellId}-${entry.index}`}
                        onClick={() => onSlideCombinedClick(result)}
                        className="hover:bg-cyan-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2.5">
                          <div className="w-6 h-6 rounded bg-cyan-100 flex items-center justify-center">
                            <Table2 size={12} className="text-cyan-700" />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 max-w-[320px]">
                          <div className="text-sm font-medium text-gray-900 truncate">{primary}</div>
                          {rest.length > 0 && (
                            <div className="text-[11px] text-gray-500 truncate">
                              {rest.map((v) => `${v.headerText}: ${v.value}`).join(' | ')}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{result.cellId}</td>
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{result.boxName}</td>
                        <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                        <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                        <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                        <DateCell dateValue={result.dateValue} dateType={result.dateType} showDate={showDate} showDaysRemaining={showDaysRemaining} />
                      </tr>
                    );
                  }
                  const groupKey = `sm:${entry.meta.boxId}`;
                  const expanded = expandedGroups.has(groupKey);
                  return (
                    <React.Fragment key={groupKey}>
                      <BoxGroupHeader
                        meta={entry.meta}
                        count={entry.items.length}
                        expanded={expanded}
                        onToggle={() => toggleGroup(groupKey)}
                        colSpan={dateColCount}
                        hoverColor="hover:bg-cyan-50/40"
                        accentBg="bg-cyan-100"
                        icon={<Table2 size={12} className="text-cyan-700" />}
                      />
                      {expanded && entry.items.map(({ item: result, index }) => {
                        const primary = result.values[0]?.value || '--';
                        const rest = result.values.slice(1);
                        return (
                          <tr
                            key={`sm-${result.boxId}-${result.cellId}-${index}`}
                            onClick={() => onSlideCombinedClick(result)}
                            className="hover:bg-cyan-50/50 cursor-pointer transition-colors bg-gray-50/30"
                          >
                            <td className="px-3 py-2.5 border-l-2 border-cyan-200">
                              <div className="w-6 h-6 rounded bg-cyan-100 flex items-center justify-center">
                                <Table2 size={12} className="text-cyan-700" />
                              </div>
                            </td>
                            <td className="px-3 py-2.5 max-w-[320px]">
                              <div className="text-sm font-medium text-gray-900 truncate">{primary}</div>
                              {rest.length > 0 && (
                                <div className="text-[11px] text-gray-500 truncate">
                                  {rest.map((v) => `${v.headerText}: ${v.value}`).join(' | ')}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{result.cellId}</td>
                            <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{result.boxName}</td>
                            <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                            <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                            <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                            <DateCell dateValue={result.dateValue} dateType={result.dateType} showDate={showDate} showDaysRemaining={showDaysRemaining} />
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {results.cellMatches.length > 0 && (
        <CollapsibleSection
          id="section-cell-matches"
          title="Freezer Matches"
          count={results.cellMatches.length}
          accentColor="bg-blue-100"
          borderColor="border-blue-200"
          icon={<Grid2X2 size={14} className="text-blue-600" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Content</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Cell</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Box</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Position</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Sublocation</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                  {showDate && <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cellMatchGroups.map((entry) => {
                  if (entry.kind === 'single') {
                    const result = entry.item;
                    const primary = result.name || result.information || '--';
                    const subtitle = result.name && result.information ? result.information : '';
                    return (
                      <tr
                        key={`cm-${result.boxId}-${result.cellId}-${entry.index}`}
                        onClick={() => onCellCombinedClick(result)}
                        className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2.5">
                          <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                            <Grid2X2 size={12} className="text-blue-600" />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 max-w-[320px]">
                          <div className="text-sm font-medium text-gray-900 truncate">{primary}</div>
                          {subtitle && <div className="text-[11px] text-gray-500 italic truncate">{subtitle}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{result.cellId}</td>
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{result.boxName}</td>
                        <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                        <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                        <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                        <DateCell dateValue={result.dateValue} dateType={result.dateType} showDate={showDate} showDaysRemaining={showDaysRemaining} />
                      </tr>
                    );
                  }
                  const groupKey = `cm:${entry.meta.boxId}`;
                  const expanded = expandedGroups.has(groupKey);
                  return (
                    <React.Fragment key={groupKey}>
                      <BoxGroupHeader
                        meta={entry.meta}
                        count={entry.items.length}
                        expanded={expanded}
                        onToggle={() => toggleGroup(groupKey)}
                        colSpan={dateColCount}
                        hoverColor="hover:bg-blue-50/40"
                        accentBg="bg-blue-100"
                        icon={<Grid2X2 size={12} className="text-blue-600" />}
                      />
                      {expanded && entry.items.map(({ item: result, index }) => {
                        const primary = result.name || result.information || '--';
                        const subtitle = result.name && result.information ? result.information : '';
                        return (
                          <tr
                            key={`cm-${result.boxId}-${result.cellId}-${index}`}
                            onClick={() => onCellCombinedClick(result)}
                            className="hover:bg-blue-50/50 cursor-pointer transition-colors bg-gray-50/30"
                          >
                            <td className="px-3 py-2.5 border-l-2 border-blue-200">
                              <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                                <Grid2X2 size={12} className="text-blue-600" />
                              </div>
                            </td>
                            <td className="px-3 py-2.5 max-w-[320px]">
                              <div className="text-sm font-medium text-gray-900 truncate">{primary}</div>
                              {subtitle && <div className="text-[11px] text-gray-500 italic truncate">{subtitle}</div>}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{result.cellId}</td>
                            <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{result.boxName}</td>
                            <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                            <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                            <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                            <DateCell dateValue={result.dateValue} dateType={result.dateType} showDate={showDate} showDaysRemaining={showDaysRemaining} />
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {results.structuredFreezerMatches.length > 0 && (
        <CollapsibleSection
          id="section-structured-freezer-matches"
          title="Structured Freezer Matches"
          count={results.structuredFreezerMatches.length}
          accentColor="bg-blue-100"
          borderColor="border-blue-200"
          icon={<Grid2X2 size={14} className="text-blue-600" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Content</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Cell</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Box</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Position</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Sublocation</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                  {showDate && <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {structuredFreezerGroups.map((entry) => {
                  if (entry.kind === 'single') {
                    const result = entry.item;
                    const primary = result.name || result.values[0]?.value || result.information || '--';
                    const infoLine = result.name && result.information ? result.information : '';
                    const columnValues = result.values.filter(v => v.value && v.value !== primary);
                    return (
                      <tr
                        key={`sfm-${result.boxId}-${result.cellId}-${entry.index}`}
                        onClick={() => onStructuredFreezerCombinedClick(result)}
                        className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2.5">
                          <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                            <Grid2X2 size={12} className="text-blue-600" />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 max-w-[320px]">
                          <div className="text-sm font-medium text-gray-900 truncate">{primary}</div>
                          {infoLine && <div className="text-[11px] text-gray-500 italic truncate">{infoLine}</div>}
                          {columnValues.length > 0 && (
                            <div className="text-[11px] text-gray-500 truncate">
                              {columnValues.map((v) => `${v.headerText}: ${v.value}`).join(' | ')}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{result.cellId}</td>
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{result.boxName}</td>
                        <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                        <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                        <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                        <DateCell dateValue={result.dateValue} dateType={result.dateType} showDate={showDate} showDaysRemaining={showDaysRemaining} />
                      </tr>
                    );
                  }
                  const groupKey = `sfm:${entry.meta.boxId}`;
                  const expanded = expandedGroups.has(groupKey);
                  return (
                    <React.Fragment key={groupKey}>
                      <BoxGroupHeader
                        meta={entry.meta}
                        count={entry.items.length}
                        expanded={expanded}
                        onToggle={() => toggleGroup(groupKey)}
                        colSpan={dateColCount}
                        hoverColor="hover:bg-blue-50/40"
                        accentBg="bg-blue-100"
                        icon={<Grid2X2 size={12} className="text-blue-600" />}
                      />
                      {expanded && entry.items.map(({ item: result, index }) => {
                        const primary = result.name || result.values[0]?.value || result.information || '--';
                        const infoLine = result.name && result.information ? result.information : '';
                        const columnValues = result.values.filter(v => v.value && v.value !== primary);
                        return (
                          <tr
                            key={`sfm-${result.boxId}-${result.cellId}-${index}`}
                            onClick={() => onStructuredFreezerCombinedClick(result)}
                            className="hover:bg-blue-50/50 cursor-pointer transition-colors bg-gray-50/30"
                          >
                            <td className="px-3 py-2.5 border-l-2 border-blue-200">
                              <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                                <Grid2X2 size={12} className="text-blue-600" />
                              </div>
                            </td>
                            <td className="px-3 py-2.5 max-w-[320px]">
                              <div className="text-sm font-medium text-gray-900 truncate">{primary}</div>
                              {infoLine && <div className="text-[11px] text-gray-500 italic truncate">{infoLine}</div>}
                              {columnValues.length > 0 && (
                                <div className="text-[11px] text-gray-500 truncate">
                                  {columnValues.map((v) => `${v.headerText}: ${v.value}`).join(' | ')}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{result.cellId}</td>
                            <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{result.boxName}</td>
                            <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                            <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                            <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                            <DateCell dateValue={result.dateValue} dateType={result.dateType} showDate={showDate} showDaysRemaining={showDaysRemaining} />
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {results.slideValues.length > 0 && (
        <CollapsibleSection
          id="section-slide-data"
          title={slideDataTitle}
          count={results.slideValues.length}
          accentColor="bg-cyan-100"
          borderColor="border-cyan-200"
          icon={<Table2 size={14} className="text-cyan-700" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Column</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Cell</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Box</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Position</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Sublocation</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                  {showDate && <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {slideValueGroups.map((entry) => {
                  if (entry.kind === 'single') {
                    const result = entry.item;
                    return (
                      <tr
                        key={`sv-${result.boxId}-${result.cellId}-${entry.index}`}
                        onClick={() => onSlideValueClick(result)}
                        className="hover:bg-cyan-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2.5">
                          <div className="w-6 h-6 rounded bg-cyan-100 flex items-center justify-center">
                            <Table2 size={12} className="text-cyan-700" />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-sm font-medium text-gray-900 max-w-[200px] truncate">{result.matchedValue}</td>
                        <td className="px-3 py-2.5">
                          <span className="px-1.5 py-0.5 text-[11px] font-medium bg-cyan-50 text-cyan-700 rounded border border-cyan-100">
                            {result.headerText}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{result.cellId}</td>
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{result.boxName}</td>
                        <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                        <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                        <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                        <DateCell dateValue={result.dateValue} dateType={result.dateType} showDate={showDate} showDaysRemaining={showDaysRemaining} />
                      </tr>
                    );
                  }
                  const groupKey = `sv:${entry.meta.boxId}`;
                  const expanded = expandedGroups.has(groupKey);
                  const slideColSpan = showDate ? 9 : 8;
                  return (
                    <React.Fragment key={groupKey}>
                      <BoxGroupHeader
                        meta={entry.meta}
                        count={entry.items.length}
                        expanded={expanded}
                        onToggle={() => toggleGroup(groupKey)}
                        colSpan={slideColSpan}
                        hoverColor="hover:bg-cyan-50/40"
                        accentBg="bg-cyan-100"
                        icon={<Table2 size={12} className="text-cyan-700" />}
                      />
                      {expanded && entry.items.map(({ item: result, index }) => (
                        <tr
                          key={`sv-${result.boxId}-${result.cellId}-${index}`}
                          onClick={() => onSlideValueClick(result)}
                          className="hover:bg-cyan-50/50 cursor-pointer transition-colors bg-gray-50/30"
                        >
                          <td className="px-3 py-2.5 border-l-2 border-cyan-200">
                            <div className="w-6 h-6 rounded bg-cyan-100 flex items-center justify-center">
                              <Table2 size={12} className="text-cyan-700" />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-sm font-medium text-gray-900 max-w-[200px] truncate">{result.matchedValue}</td>
                          <td className="px-3 py-2.5">
                            <span className="px-1.5 py-0.5 text-[11px] font-medium bg-cyan-50 text-cyan-700 rounded border border-cyan-100">
                              {result.headerText}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{result.cellId}</td>
                          <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{result.boxName}</td>
                          <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                          <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                          <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                          <DateCell dateValue={result.dateValue} dateType={result.dateType} showDate={showDate} showDaysRemaining={showDaysRemaining} />
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {results.itemCustomValues.length > 0 && (
        <CollapsibleSection
          id="section-item-data"
          title={itemCustomValueTitle}
          count={results.itemCustomValues.length}
          accentColor="bg-emerald-100"
          borderColor="border-emerald-200"
          icon={<Package size={14} className="text-emerald-700" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Column</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Folder</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Position</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Sublocation</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.itemCustomValues.map((result, index) => (
                  <tr
                    key={`icv-${result.itemId}-${index}`}
                    onClick={() => onItemCustomValueClick(result)}
                    className="hover:bg-emerald-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center">
                        {getItemTypeIcon(result.itemType as ItemType, 12, '#059669')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900 max-w-[200px] truncate">{result.matchedValue}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-1.5 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
                        {result.headerText}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{result.itemName}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{result.folderName}</td>
                    <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                    <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                    <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {results.cellTitles.length > 0 && (
        <GroupedCellResultsTable
          id="section-cell-titles"
          title="Cell Titles"
          groups={cellTitleGroups}
          totalCount={results.cellTitles.length}
          showDate={showDate}
          showDaysRemaining={showDaysRemaining}
          onClick={onCellClick}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          sectionPrefix="ct"
        />
      )}

      {results.cellInfo.length > 0 && (
        <GroupedCellResultsTable
          id="section-cell-info"
          title="Cell Info"
          groups={cellInfoGroups}
          totalCount={results.cellInfo.length}
          showDate={showDate}
          showDaysRemaining={showDaysRemaining}
          onClick={onCellClick}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          sectionPrefix="ci"
        />
      )}

      {results.slideHeaders.length > 0 && (
        <CollapsibleSection
          id="section-slide-headers"
          title="Slide Headers"
          count={results.slideHeaders.length}
          accentColor="bg-teal-100"
          borderColor="border-teal-200"
          icon={<LayoutList size={14} className="text-teal-700" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Header</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Box</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Position</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Sublocation</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {slideHeaderGroups.map((entry) => {
                  if (entry.kind === 'single') {
                    const result = entry.item;
                    return (
                      <tr
                        key={`sh-${result.boxId}-${entry.index}`}
                        onClick={() => onSlideHeaderClick(result)}
                        className="hover:bg-teal-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2.5">
                          <div className="w-6 h-6 rounded bg-teal-100 flex items-center justify-center">
                            <LayoutList size={12} className="text-teal-700" />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{result.headerText}</td>
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{result.boxName}</td>
                        <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                        <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                        <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                      </tr>
                    );
                  }
                  const groupKey = `sh:${entry.meta.boxId}`;
                  const expanded = expandedGroups.has(groupKey);
                  return (
                    <React.Fragment key={groupKey}>
                      <BoxGroupHeader
                        meta={entry.meta}
                        count={entry.items.length}
                        expanded={expanded}
                        onToggle={() => toggleGroup(groupKey)}
                        colSpan={6}
                        hoverColor="hover:bg-teal-50/40"
                        accentBg="bg-teal-100"
                        icon={<LayoutList size={12} className="text-teal-700" />}
                      />
                      {expanded && entry.items.map(({ item: result, index }) => (
                        <tr
                          key={`sh-${result.boxId}-${index}`}
                          onClick={() => onSlideHeaderClick(result)}
                          className="hover:bg-teal-50/50 cursor-pointer transition-colors bg-gray-50/30"
                        >
                          <td className="px-3 py-2.5 border-l-2 border-teal-200">
                            <div className="w-6 h-6 rounded bg-teal-100 flex items-center justify-center">
                              <LayoutList size={12} className="text-teal-700" />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{result.headerText}</td>
                          <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{result.boxName}</td>
                          <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                          <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                          <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {results.boxes.length > 0 && (
        <CollapsibleSection
          id="section-boxes"
          title="Boxes"
          count={results.boxes.length}
          accentColor="bg-blue-100"
          borderColor="border-blue-200"
          icon={<Package size={14} className="text-blue-700" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Box Name</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Position</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Sublocation</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.boxes.map((result) => (
                  <tr
                    key={result.boxId}
                    onClick={() => onBoxClick(result)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ backgroundColor: `${result.boxAccentColor || '#3b82f6'}20` }}
                      >
                        {result.boxType === 'slide' ? (
                          <Layers size={12} style={{ color: result.boxAccentColor || '#3b82f6' }} />
                        ) : (
                          <Package size={12} style={{ color: result.boxAccentColor || '#3b82f6' }} />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{result.boxName}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-1.5 py-0.5 text-[11px] font-medium rounded border ${
                        result.boxType === 'slide'
                          ? 'bg-cyan-50 text-cyan-700 border-cyan-100'
                          : 'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {result.boxType === 'slide' ? 'Slide' : 'Freezer'}
                      </span>
                    </td>
                    <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                    <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                    <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {results.items.length > 0 && (
        <CollapsibleSection
          id="section-items"
          title="Items"
          count={results.items.length}
          accentColor="bg-emerald-100"
          borderColor="border-emerald-200"
          icon={<Package size={14} className="text-emerald-700" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Item Name</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Folder</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Position</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Sublocation</th>
                  <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.items.map((result) => (
                  <tr
                    key={result.itemId}
                    onClick={() => onItemClick(result)}
                    className="hover:bg-emerald-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center">
                        {getItemTypeIcon(result.itemType as ItemType, 12, '#059669')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{result.itemName}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-1.5 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600 rounded border border-gray-200">
                        {result.itemType}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{result.folderName}</td>
                    <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                    <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                    <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
};

// --- Grouped Cell Results Table (for cellTitles / cellInfo) ---

interface GroupedCellResultsTableProps {
  id: string;
  title: string;
  groups: BoxGroupItem<CellSearchResult>[];
  totalCount: number;
  showDate: boolean;
  showDaysRemaining: boolean;
  onClick: (result: CellSearchResult) => void;
  expandedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  sectionPrefix: string;
}

const GroupedCellResultsTable: React.FC<GroupedCellResultsTableProps> = ({
  id,
  title,
  groups,
  totalCount,
  showDate,
  showDaysRemaining,
  onClick,
  expandedGroups,
  onToggleGroup,
  sectionPrefix,
}) => {
  const colSpan = showDate ? 8 : 7;
  return (
    <CollapsibleSection
      id={id}
      title={title}
      count={totalCount}
      accentColor="bg-blue-100"
      borderColor="border-blue-200"
      icon={<Grid2X2 size={14} className="text-blue-600" />}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
              <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Content</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Cell</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Box</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Position</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Sublocation</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Location</th>
              {showDate && <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groups.map((entry) => {
              if (entry.kind === 'single') {
                const result = entry.item;
                return (
                  <tr
                    key={`${sectionPrefix}-${result.boxId}-${result.cellId}-${entry.index}`}
                    onClick={() => onClick(result)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                        {result.boxType === 'slide' ? (
                          <Layers size={12} className="text-blue-600" />
                        ) : (
                          <Grid2X2 size={12} className="text-blue-600" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900 max-w-[200px] truncate">{result.cellContent}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{result.cellId}</td>
                    <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{result.boxName}</td>
                    <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                    <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                    <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                    <DateCell dateValue={result.dateValue} dateType={result.dateType} showDate={showDate} showDaysRemaining={showDaysRemaining} />
                  </tr>
                );
              }
              const groupKey = `${sectionPrefix}:${entry.meta.boxId}`;
              const expanded = expandedGroups.has(groupKey);
              return (
                <React.Fragment key={groupKey}>
                  <BoxGroupHeader
                    meta={entry.meta}
                    count={entry.items.length}
                    expanded={expanded}
                    onToggle={() => onToggleGroup(groupKey)}
                    colSpan={colSpan}
                    hoverColor="hover:bg-blue-50/40"
                    accentBg="bg-blue-100"
                    icon={<Grid2X2 size={12} className="text-blue-600" />}
                  />
                  {expanded && entry.items.map(({ item: result, index }) => (
                    <tr
                      key={`${sectionPrefix}-${result.boxId}-${result.cellId}-${index}`}
                      onClick={() => onClick(result)}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors bg-gray-50/30"
                    >
                      <td className="px-3 py-2.5 border-l-2 border-blue-200">
                        <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                          {result.boxType === 'slide' ? (
                            <Layers size={12} className="text-blue-600" />
                          ) : (
                            <Grid2X2 size={12} className="text-blue-600" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-sm font-medium text-gray-900 max-w-[200px] truncate">{result.cellContent}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{result.cellId}</td>
                      <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{result.boxName}</td>
                      <LocationCell value={result.positionName} className="hidden lg:table-cell" />
                      <LocationCell value={result.sublocationName} className="hidden md:table-cell" />
                      <td className="px-3 py-2.5 text-xs text-gray-500">{result.locationName}</td>
                      <DateCell dateValue={result.dateValue} dateType={result.dateType} showDate={showDate} showDaysRemaining={showDaysRemaining} />
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  );
};

export default SearchPageTableResults;
