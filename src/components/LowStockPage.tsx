import React, { useMemo, useState } from 'react';
import { ArrowLeft, PackageX, Search, OctagonAlert as AlertOctagon, TriangleAlert as AlertTriangle, TrendingDown, ChevronRight, ChevronDown, X, PackageCheck, Package, Menu } from 'lucide-react';
import { useLowStock } from '../hooks/useLowStock';
import SvgIcon from './SvgIcon';
import { ITEM_FALLBACK_ICON_ID } from '../config/iconRegistry';
import {
  LowStockRecord,
  LowStockSeverity,
  severityMeta,
} from '../services/lowStockService';
import DnaLoader from './DnaLoader';

interface LowStockPageProps {
  onNavigateToLocation: (locationId: string) => void;
  onMobileMenuToggle?: () => void;
  initialLocationFilter?: string;
}

type SortMode = 'severity' | 'name' | 'ratio';

const severityOrder: LowStockSeverity[] = ['out', 'critical', 'low'];

const LowStockPage: React.FC<LowStockPageProps> = ({ onNavigateToLocation, onMobileMenuToggle, initialLocationFilter }) => {
  const { data = [], isLoading } = useLowStock();
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<LowStockSeverity | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<string>(initialLocationFilter || 'all');
  const [sortMode, setSortMode] = useState<SortMode>('severity');
  const [collapsedLocations, setCollapsedLocations] = useState<Set<string>>(new Set());

  const allLocations = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((r) => map.set(r.locationId, r.locationName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const totals = useMemo(() => {
    const counts: Record<LowStockSeverity, number> = { out: 0, critical: 0, low: 0 };
    data.forEach((r) => (counts[r.severity] += 1));
    return counts;
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = data.filter((record) => {
      if (severityFilter !== 'all' && record.severity !== severityFilter) return false;
      if (locationFilter !== 'all' && record.locationId !== locationFilter) return false;
      if (q) {
        const haystack = [
          record.name,
          record.note,
          record.locationName,
          record.sublocationName,
          record.positionName,
          record.folderName,
          record.itemType,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...result];
    if (sortMode === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === 'ratio') {
      sorted.sort((a, b) => a.ratio - b.ratio);
    }
    return sorted;
  }, [data, search, severityFilter, locationFilter, sortMode]);

  const groupedByLocation = useMemo(() => {
    const groups = new Map<string, { locationId: string; locationName: string; locationAccent: string | null; records: LowStockRecord[] }>();
    for (const record of filtered) {
      if (!groups.has(record.locationId)) {
        groups.set(record.locationId, {
          locationId: record.locationId,
          locationName: record.locationName,
          locationAccent: record.locationAccentColor,
          records: [],
        });
      }
      groups.get(record.locationId)!.records.push(record);
    }
    return Array.from(groups.values());
  }, [filtered]);

  const toggleLocationGroup = (locationId: string) => {
    setCollapsedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) next.delete(locationId);
      else next.add(locationId);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setSeverityFilter('all');
    setLocationFilter('all');
  };

  const hasActiveFilters =
    search.trim() !== '' || severityFilter !== 'all' || locationFilter !== 'all';

  if (isLoading) {
    return <DnaLoader message="Loading stock levels..." />;
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 via-white to-rose-50/30 overflow-hidden">
      <header className="flex-shrink-0 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {onMobileMenuToggle && (
              <button
                onClick={onMobileMenuToggle}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                title="Open menu"
              >
                <Menu size={20} className="text-gray-600" />
              </button>
            )}
            {severityFilter !== 'all' && (
              <button
                onClick={() => setSeverityFilter('all')}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Return to overview"
              >
                <ArrowLeft size={18} className="text-gray-600" />
              </button>
            )}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-rose-600" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 tracking-tight truncate">
                  Low Stock
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  {data.length} item{data.length === 1 ? '' : 's'} below threshold
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
              {(['severity', 'name', 'ratio'] as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                    sortMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {mode === 'severity' ? 'Priority' : mode === 'ratio' ? 'Stock %' : 'Name'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 pb-4 grid grid-cols-3 gap-2">
          <StatCard
            label="Out of Stock"
            count={totals.out}
            iconColor="text-red-500"
            Icon={PackageX}
            active={severityFilter === 'out'}
            onClick={() => setSeverityFilter(severityFilter === 'out' ? 'all' : 'out')}
          />
          <StatCard
            label="Critical"
            count={totals.critical}
            iconColor="text-rose-500"
            Icon={AlertOctagon}
            active={severityFilter === 'critical'}
            onClick={() => setSeverityFilter(severityFilter === 'critical' ? 'all' : 'critical')}
          />
          <StatCard
            label="Low"
            count={totals.low}
            iconColor="text-amber-500"
            Icon={AlertTriangle}
            active={severityFilter === 'low'}
            onClick={() => setSeverityFilter(severityFilter === 'low' ? 'all' : 'low')}
          />
        </div>

        <div className="px-6 pb-4 flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items, locations, sheets..."
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
              >
                <X size={12} className="text-gray-400" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200"
              >
                <X size={12} />
                Clear
              </button>
            )}
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-400"
            >
              <option value="all">All Locations</option>
              {allLocations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-4">
        {data.length === 0 ? (
          <EmptyState
            title="All items are well stocked"
            message="Items fall below their configured threshold will appear here for quick restocking."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No matches"
            message="Try adjusting your filters or search."
          />
        ) : (
          <div className="space-y-4 max-w-5xl mx-auto">
            {groupedByLocation.map((group) => {
              const isCollapsed = collapsedLocations.has(group.locationId);
              const accent = group.locationAccent ?? '#e11d48';
              const groupStats = group.records.reduce(
                (acc, r) => {
                  acc[r.severity] += 1;
                  return acc;
                },
                { out: 0, critical: 0, low: 0 } as Record<LowStockSeverity, number>,
              );
              const records =
                sortMode === 'severity'
                  ? [...group.records].sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity) || a.ratio - b.ratio)
                  : group.records;

              return (
                <section
                  key={group.locationId}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
                >
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                    <button
                      onClick={() => toggleLocationGroup(group.locationId)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: accent }}
                      />
                      <h2 className="text-sm font-semibold text-gray-900 truncate">{group.locationName}</h2>
                      <div className="flex items-center gap-1">
                        {groupStats.out > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">
                            {groupStats.out} out
                          </span>
                        )}
                        {groupStats.critical > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700">
                            {groupStats.critical} critical
                          </span>
                        )}
                        {groupStats.low > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                            {groupStats.low} low
                          </span>
                        )}
                      </div>
                      {isCollapsed ? (
                        <ChevronRight size={16} className="text-gray-400 ml-auto flex-shrink-0" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-400 ml-auto flex-shrink-0" />
                      )}
                    </button>
                    <button
                      onClick={() => onNavigateToLocation(group.locationId)}
                      className="flex-shrink-0 text-[11px] font-medium text-rose-700 hover:text-rose-900 hover:bg-rose-50 px-2 py-1 rounded-md transition-colors"
                    >
                      Open
                    </button>
                  </div>
                  {!isCollapsed && (
                    <ul className="divide-y divide-gray-100">
                      {records.map((record) => (
                        <LowStockRow
                          key={record.id}
                          record={record}
                          onSelect={() => onNavigateToLocation(record.locationId)}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  count: number;
  iconColor: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  onClick: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ label, count, iconColor, Icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`group relative overflow-hidden rounded-xl border transition-all duration-200 text-left ${
      active
        ? 'border-rose-300 ring-2 ring-rose-200 shadow-sm'
        : 'border-gray-200 hover:border-gray-300 hover:-translate-y-0.5 hover:shadow-sm'
    } bg-white`}
  >
    <div className="p-3 flex items-center gap-3">
      <div className="w-8 h-8 flex items-center justify-center">
        <Icon size={20} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-xl font-semibold text-gray-900 leading-none mt-1">{count}</p>
      </div>
    </div>
  </button>
);

interface LowStockRowProps {
  record: LowStockRecord;
  onSelect: () => void;
}

const LowStockRow: React.FC<LowStockRowProps> = ({ record, onSelect }) => {
  const meta = severityMeta[record.severity];
  const iconId = record.iconId ?? ITEM_FALLBACK_ICON_ID;
  const accent = record.accentColor ?? record.folderAccentColor ?? '#e11d48';
  const breadcrumb = [record.locationName, record.sublocationName, record.positionName, record.folderName].filter(Boolean);
  const pct = Math.max(0, Math.min(100, Math.round(record.ratio * 100)));

  return (
    <li>
      <button
        onClick={onSelect}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-rose-50/40 transition-colors text-left group"
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border"
          style={{
            background: `${accent}1A`,
            borderColor: `${accent}33`,
            color: accent,
          }}
        >
          {iconId ? (
            <SvgIcon iconId={iconId} size={20} color={accent} />
          ) : (
            <Package size={18} style={{ color: accent }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">{record.name || '(untitled)'}</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 flex-shrink-0">
              {record.itemType}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5 flex-wrap">
            {breadcrumb.map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-gray-300">/</span>}
                <span className="truncate max-w-[140px]">{part}</span>
              </React.Fragment>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 max-w-[220px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${meta.bar} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">
              {record.stockNumber} / {record.stockThreshold}
              {record.unit && <span className="text-gray-400 ml-0.5">{record.unit}</span>}
            </span>
          </div>
        </div>
        <span
          className={`hidden md:inline-flex text-[10px] font-semibold px-2 py-1 rounded-full ${meta.chipBg} ${meta.chipText} flex-shrink-0`}
        >
          {meta.label}
        </span>
      </button>
    </li>
  );
};

interface EmptyStateProps {
  title: string;
  message: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, message }) => (
  <div className="max-w-md mx-auto text-center py-16">
    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 mb-4">
      <PackageCheck className="h-8 w-8 text-emerald-600" />
    </div>
    <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
    <p className="text-sm text-gray-500">{message}</p>
  </div>
);

export default LowStockPage;
