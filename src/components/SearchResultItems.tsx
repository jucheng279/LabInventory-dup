import React from 'react';
import { Grid2x2 as Grid2X2, Package, Layers, LayoutList, Calendar, Table2, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import {
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

function buildBreadcrumb(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' > ');
}

interface ResultSectionProps {
  title: string;
  children: React.ReactNode;
}

export const ResultSection: React.FC<ResultSectionProps> = ({ title, children }) => (
  <div className="mb-2 last:mb-0">
    <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
      {title}
    </div>
    <div>{children}</div>
  </div>
);

interface CellResultItemProps {
  result: CellSearchResult;
  onClick: () => void;
  showDate?: boolean;
  showDaysRemaining?: boolean;
}

export const CellResultItem: React.FC<CellResultItemProps> = ({ result, onClick, showDate, showDaysRemaining }) => {
  const isExpiration = result.dateType === 'expiration';
  const daysLabel = showDate && showDaysRemaining && isExpiration && result.dateValue
    ? formatDaysRemaining(result.dateValue)
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
        {result.boxType === 'slide' ? (
          <Layers size={16} className="text-blue-600" />
        ) : (
          <Grid2X2 size={16} className="text-blue-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{result.cellContent}</p>
          <span className="flex-shrink-0 text-xs text-gray-400 font-mono">{result.cellId}</span>
          {showDate && result.dateValue && (
            <span className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded border ${
              isExpiration
                ? 'bg-orange-50 text-orange-700 border-orange-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              {isExpiration ? (
                <AlertTriangle size={10} className="text-orange-500" />
              ) : (
                <Calendar size={10} className="text-gray-400" />
              )}
              {result.dateValue}
            </span>
          )}
          {daysLabel && (
            <span className="flex-shrink-0 text-[11px] text-orange-500 font-medium">
              {daysLabel}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {buildBreadcrumb([result.boxName, result.positionName, result.sublocationName, result.locationName])}
        </p>
      </div>
    </button>
  );
};

interface CellCombinedResultItemProps {
  result: CellCombinedSearchResult;
  onClick: () => void;
  showDate?: boolean;
  showDaysRemaining?: boolean;
}

export const CellCombinedResultItem: React.FC<CellCombinedResultItemProps> = ({ result, onClick, showDate, showDaysRemaining }) => {
  const isExpiration = result.dateType === 'expiration';
  const daysLabel = showDate && showDaysRemaining && isExpiration && result.dateValue
    ? formatDaysRemaining(result.dateValue)
    : null;
  const primary = result.name || result.information || '';
  const subtitle = result.name && result.information ? result.information : '';

  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
        <Grid2X2 size={16} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{primary}</p>
          <span className="flex-shrink-0 text-xs text-gray-400 font-mono">{result.cellId}</span>
          {showDate && result.dateValue && (
            <span className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded border ${
              isExpiration
                ? 'bg-orange-50 text-orange-700 border-orange-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              {isExpiration ? (
                <AlertTriangle size={10} className="text-orange-500" />
              ) : (
                <Calendar size={10} className="text-gray-400" />
              )}
              {result.dateValue}
            </span>
          )}
          {daysLabel && (
            <span className="flex-shrink-0 text-[11px] text-orange-500 font-medium">{daysLabel}</span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-gray-600 truncate italic">{subtitle}</p>
        )}
        <p className="text-[11px] text-gray-400 truncate">
          {buildBreadcrumb([result.boxName, result.positionName, result.sublocationName, result.locationName])}
        </p>
      </div>
    </button>
  );
};

interface SlideCombinedResultItemProps {
  result: SlideCombinedSearchResult;
  onClick: () => void;
  showDate?: boolean;
  showDaysRemaining?: boolean;
}

export const SlideCombinedResultItem: React.FC<SlideCombinedResultItemProps> = ({ result, onClick, showDate, showDaysRemaining }) => {
  const isExpiration = result.dateType === 'expiration';
  const daysLabel = showDate && showDaysRemaining && isExpiration && result.dateValue
    ? formatDaysRemaining(result.dateValue)
    : null;
  const primary = result.values[0]?.value || '';
  const rest = result.values.slice(1);

  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-cyan-50 transition-colors text-left"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
        <Table2 size={16} className="text-cyan-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{primary}</p>
          <span className="flex-shrink-0 text-xs text-gray-400 font-mono">{result.cellId}</span>
          {showDate && result.dateValue && (
            <span className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded border ${
              isExpiration
                ? 'bg-orange-50 text-orange-700 border-orange-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              {isExpiration ? <AlertTriangle size={10} className="text-orange-500" /> : <Calendar size={10} className="text-gray-400" />}
              {result.dateValue}
            </span>
          )}
          {daysLabel && (
            <span className="flex-shrink-0 text-[11px] text-orange-500 font-medium">{daysLabel}</span>
          )}
        </div>
        {rest.length > 0 && (
          <p className="text-xs text-gray-600 truncate">
            {rest.map((v) => `${v.headerText}: ${v.value}`).join(' | ')}
          </p>
        )}
        <p className="text-[11px] text-gray-400 truncate">
          {buildBreadcrumb([result.boxName, result.positionName, result.sublocationName, result.locationName])}
        </p>
      </div>
    </button>
  );
};

interface BoxResultItemProps {
  result: BoxSearchResult;
  onClick: () => void;
}

export const BoxResultItem: React.FC<BoxResultItemProps> = ({ result, onClick }) => (
  <button
    onClick={onClick}
    className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left"
  >
    <div
      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
      style={{ backgroundColor: `${result.boxAccentColor || '#3b82f6'}20` }}
    >
      {result.boxType === 'slide' ? (
        <Layers size={16} style={{ color: result.boxAccentColor || '#3b82f6' }} />
      ) : (
        <Package size={16} style={{ color: result.boxAccentColor || '#3b82f6' }} />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 truncate">{result.boxName}</p>
      <p className="text-xs text-gray-500 truncate">
        {buildBreadcrumb([result.positionName, result.sublocationName, result.locationName])}
      </p>
    </div>
  </button>
);

interface ItemResultItemProps {
  result: ItemSearchResult;
  onClick: () => void;
}

export const ItemResultItem: React.FC<ItemResultItemProps> = ({ result, onClick }) => (
  <button
    onClick={onClick}
    className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-emerald-50 transition-colors text-left"
  >
    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
      {getItemTypeIcon(result.itemType as ItemType, 16, '#059669')}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-gray-900 truncate">{result.itemName}</p>
        <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
          {result.itemType}
        </span>
      </div>
      <p className="text-xs text-gray-500 truncate">
        {buildBreadcrumb([result.folderName, result.positionName, result.sublocationName, result.locationName])}
      </p>
    </div>
  </button>
);

interface SlideValueResultItemProps {
  result: SlideValueSearchResult;
  onClick: () => void;
  showDate?: boolean;
  showDaysRemaining?: boolean;
}

export const SlideValueResultItem: React.FC<SlideValueResultItemProps> = ({ result, onClick, showDate, showDaysRemaining }) => {
  const isExpiration = result.dateType === 'expiration';
  const daysLabel = showDate && showDaysRemaining && isExpiration && result.dateValue
    ? formatDaysRemaining(result.dateValue)
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-cyan-50 transition-colors text-left"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center">
        <Table2 size={16} className="text-cyan-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{result.matchedValue}</p>
          <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-cyan-50 text-cyan-700 rounded border border-cyan-100">
            {result.headerText}
          </span>
          {showDate && result.dateValue && (
            <span className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded border ${
              isExpiration
                ? 'bg-orange-50 text-orange-700 border-orange-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              {isExpiration ? (
                <AlertTriangle size={10} className="text-orange-500" />
              ) : (
                <Calendar size={10} className="text-gray-400" />
              )}
              {result.dateValue}
            </span>
          )}
          {daysLabel && (
            <span className="flex-shrink-0 text-[11px] text-orange-500 font-medium">
              {daysLabel}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {buildBreadcrumb([
            result.cellId,
            `Col ${result.cellId.replace(/[0-9]/g, '')}`,
            result.boxName,
            result.positionName,
            result.sublocationName,
            result.locationName,
          ])}
        </p>
      </div>
    </button>
  );
};

interface SlideHeaderResultItemProps {
  result: SlideHeaderSearchResult;
  onClick: () => void;
}

export const SlideHeaderResultItem: React.FC<SlideHeaderResultItemProps> = ({ result, onClick }) => (
  <button
    onClick={onClick}
    className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-teal-50 transition-colors text-left"
  >
    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
      <LayoutList size={16} className="text-teal-700" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 truncate">{result.headerText}</p>
      <p className="text-xs text-gray-500 truncate">
        {buildBreadcrumb([result.boxName, result.positionName, result.sublocationName, result.locationName])}
      </p>
    </div>
  </button>
);

interface ItemCustomValueResultItemProps {
  result: ItemCustomValueSearchResult;
  onClick: () => void;
}

export const ItemCustomValueResultItem: React.FC<ItemCustomValueResultItemProps> = ({ result, onClick }) => (
  <button
    onClick={onClick}
    className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-emerald-50 transition-colors text-left"
  >
    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
      {getItemTypeIcon(result.itemType as ItemType, 16, '#059669')}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-gray-900 truncate">{result.matchedValue}</p>
        <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
          {result.headerText}
        </span>
      </div>
      <p className="text-xs text-gray-500 truncate">
        {buildBreadcrumb([result.itemName, result.folderName, result.positionName, result.sublocationName, result.locationName])}
      </p>
    </div>
  </button>
);
interface StructuredFreezerCombinedResultItemProps {
  result: StructuredFreezerCombinedSearchResult;
  onClick: () => void;
  showDate?: boolean;
  showDaysRemaining?: boolean;
}

export const StructuredFreezerCombinedResultItem: React.FC<StructuredFreezerCombinedResultItemProps> = ({ result, onClick, showDate, showDaysRemaining }) => {
  const isExpiration = result.dateType === 'expiration';
  const daysLabel = showDate && showDaysRemaining && isExpiration && result.dateValue
    ? formatDaysRemaining(result.dateValue)
    : null;
  const primary = result.name || result.values[0]?.value || result.information || '';
  const infoLine = result.name && result.information ? result.information : '';
  const columnValues = result.values.filter(v => v.value && v.value !== primary);

  return (
    <button
      onClick={onClick}
      className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
        <Grid2X2 size={16} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{primary}</p>
          <span className="flex-shrink-0 text-xs text-gray-400 font-mono">{result.cellId}</span>
          {showDate && result.dateValue && (
            <span className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded border ${
              isExpiration
                ? 'bg-orange-50 text-orange-700 border-orange-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              {isExpiration ? <AlertTriangle size={10} className="text-orange-500" /> : <Calendar size={10} className="text-gray-400" />}
              {result.dateValue}
            </span>
          )}
          {daysLabel && (
            <span className="flex-shrink-0 text-[11px] text-orange-500 font-medium">{daysLabel}</span>
          )}
        </div>
        {infoLine && (
          <p className="text-xs text-gray-600 truncate italic">{infoLine}</p>
        )}
        {columnValues.length > 0 && (
          <p className="text-xs text-gray-600 truncate">
            {columnValues.map((v) => `${v.headerText}: ${v.value}`).join(' | ')}
          </p>
        )}
        <p className="text-[11px] text-gray-400 truncate">
          {buildBreadcrumb([result.boxName, result.positionName, result.sublocationName, result.locationName])}
        </p>
      </div>
    </button>
  );
};

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

// --- Box Group Header for dropdown list view ---

interface BoxGroupHeaderItemProps {
  boxName: string;
  boxAccentColor: string | null;
  boxType?: 'slide' | 'freezer' | 'structured_freezer';
  count: number;
  expanded: boolean;
  breadcrumb: string;
  onClick: () => void;
}

export const BoxGroupHeaderItem: React.FC<BoxGroupHeaderItemProps> = ({
  boxName,
  boxAccentColor,
  boxType,
  count,
  expanded,
  breadcrumb,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-100 transition-colors text-left bg-gray-50/80"
  >
    <div
      className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center"
      style={{ backgroundColor: `${boxAccentColor || '#3b82f6'}15` }}
    >
      {boxType === 'slide' ? (
        <Layers size={14} style={{ color: boxAccentColor || '#3b82f6' }} />
      ) : (
        <Package size={14} style={{ color: boxAccentColor || '#3b82f6' }} />
      )}
    </div>
    <div className="flex-1 min-w-0 flex items-center gap-2">
      <span className="text-sm font-semibold text-gray-800 truncate">{boxName}</span>
      <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-gray-200/80 text-gray-600">
        {count}
      </span>
      {breadcrumb && (
        <span className="hidden sm:inline text-[11px] text-gray-400 truncate">{breadcrumb}</span>
      )}
    </div>
    <div className="flex-shrink-0 text-gray-400">
      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </div>
  </button>
);

