import React, { useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, Search, TriangleAlert as AlertTriangle, Clock, ChevronRight, ChevronDown, X, Calendar, Bell, BellOff, Menu, Settings2 } from 'lucide-react';
import { useExpirations } from '../hooks/useExpirations';
import { useExpirationSubscriptions } from '../hooks/useExpirationSubscriptions';
import SvgIcon from './SvgIcon';
import { ITEM_FALLBACK_ICON_ID } from '../config/iconRegistry';
import {
  ExpirationRecord,
  ExpirationSource,
  UrgencyBucket,
  getDaysUntil,
  getUrgency,
  urgencyMeta,
  formatDaysLabel,
  formatDateDisplay,
} from '../services/expirationService';
import type { BoxType } from '../types/database';
import DnaLoader from './DnaLoader';
import ExpirationSubscriptionsPanel from './ExpirationSubscriptionsPanel';

interface ExpirationPageProps {
  onNavigateToBox: (
    locationId: string,
    boxId: string,
    boxName: string,
    boxAccentColor: string | null,
    boxType?: BoxType,
    highlightCellId?: string
  ) => void;
  onNavigateToLocation: (locationId: string) => void;
  onMobileMenuToggle?: () => void;
  initialLocationFilter?: string;
}

type SortMode = 'date' | 'name' | 'urgency';
type ActiveTab = 'list' | 'subscriptions';

const urgencyOrder: UrgencyBucket[] = ['expired', 'week', 'month', 'quarter', 'later'];

const ExpirationPage: React.FC<ExpirationPageProps> = ({
  onNavigateToBox,
  onNavigateToLocation,
  onMobileMenuToggle,
  initialLocationFilter,
}) => {
  const { data = [], isLoading } = useExpirations();
  const { isSubscribed: checkSubscribed, toggleSubscription } = useExpirationSubscriptions();
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyBucket | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<ExpirationSource | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<string>(initialLocationFilter || 'all');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [collapsedLocations, setCollapsedLocations] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<ActiveTab>('list');

  const allLocations = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((r) => map.set(r.locationId, r.locationName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const totals = useMemo(() => {
    const counts: Record<UrgencyBucket, number> = { expired: 0, week: 0, month: 0, quarter: 0, later: 0 };
    data.forEach((r) => {
      const days = getDaysUntil(r.expirationDate);
      counts[getUrgency(days)] += 1;
    });
    return counts;
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = data.filter((record) => {
      if (urgencyFilter !== 'all') {
        const days = getDaysUntil(record.expirationDate);
        if (getUrgency(days) !== urgencyFilter) return false;
      }
      if (sourceFilter !== 'all' && record.source !== sourceFilter) return false;
      if (locationFilter !== 'all' && record.locationId !== locationFilter) return false;
      if (q) {
        const haystack = [
          record.name,
          record.information,
          record.locationName,
          record.sublocationName,
          record.positionName,
          record.boxName,
          record.folderName,
          record.headerText,
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
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortMode === 'urgency') {
      sorted.sort((a, b) => {
        const da = getDaysUntil(a.expirationDate);
        const db = getDaysUntil(b.expirationDate);
        return urgencyOrder.indexOf(getUrgency(da)) - urgencyOrder.indexOf(getUrgency(db)) || da - db;
      });
    }
    return sorted;
  }, [data, search, urgencyFilter, sourceFilter, locationFilter, sortMode]);

  const groupedByLocation = useMemo(() => {
    const groups = new Map<string, { locationId: string; locationName: string; locationAccent: string | null; records: ExpirationRecord[] }>();
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
    setUrgencyFilter('all');
    setSourceFilter('all');
    setLocationFilter('all');
  };

  const hasActiveFilters =
    search.trim() !== '' || urgencyFilter !== 'all' || sourceFilter !== 'all' || locationFilter !== 'all';

  const handleRecordClick = (record: ExpirationRecord) => {
    if (record.boxId && record.boxName) {
      onNavigateToBox(
        record.locationId,
        record.boxId,
        record.boxName,
        record.boxAccentColor,
        record.boxType ?? undefined,
        record.cellId ?? undefined
      );
    } else {
      onNavigateToLocation(record.locationId);
    }
  };

  const handleToggleSubscription = (record: ExpirationRecord) => {
    const sourceId = record.id.replace(/^(cell|slide|item)-/, '');
    toggleSubscription({
      item_name: record.name || '(untitled)',
      item_info: record.information || '',
      source: record.source,
      source_id: sourceId,
      expiration_date: record.expirationDate,
      location_name: record.locationName,
      box_name: record.boxName,
    });
  };

  if (isLoading) {
    return <DnaLoader message="Loading expirations..." />;
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 via-white to-amber-50/30 overflow-hidden">
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
            {urgencyFilter !== 'all' && (
              <button
                onClick={() => setUrgencyFilter('all')}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Return to overview"
              >
                <ArrowLeft size={18} className="text-gray-600" />
              </button>
            )}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 flex items-center justify-center">
                <CalendarClock className="h-5 w-5 text-amber-600" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 tracking-tight truncate">
                  Expirations
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  {data.length} tracked expiration{data.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
              <button
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'subscriptions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Settings2 size={12} />
                Alerts
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'list' && (
          <>
            <div className="px-6 pb-4 grid grid-cols-5 gap-2">
              {urgencyOrder.map((bucket) => {
                const meta = urgencyMeta[bucket];
                return (
                  <StatChip
                    key={bucket}
                    label={meta.label}
                    count={totals[bucket]}
                    dotColor={meta.dot}
                    active={urgencyFilter === bucket}
                    onClick={() => setUrgencyFilter(urgencyFilter === bucket ? 'all' : bucket)}
                  />
                );
              })}
            </div>

            <div className="px-6 pb-4 flex flex-col md:flex-row md:items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search expirations..."
                  className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
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
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as ExpirationSource | 'all')}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="all">All Sources</option>
                  <option value="cell">Grid Cells</option>
                  <option value="slide">Slides</option>
                  <option value="item">Items</option>
                </select>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="all">All Locations</option>
                  {allLocations.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <div className="hidden md:flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
                  {(['date', 'urgency', 'name'] as SortMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSortMode(mode)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                        sortMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {mode === 'date' ? 'Date' : mode === 'urgency' ? 'Priority' : 'Name'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="md:hidden px-6 pb-3 flex gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'list' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'subscriptions' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Settings2 size={12} />
            Alerts
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-4">
        {activeTab === 'subscriptions' ? (
          <ExpirationSubscriptionsPanel />
        ) : data.length === 0 ? (
          <EmptyState
            title="No expirations tracked"
            message="Items with expiration dates set will appear here for monitoring."
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
              const accent = group.locationAccent ?? '#d97706';
              const groupCounts = group.records.reduce(
                (acc, r) => {
                  const days = getDaysUntil(r.expirationDate);
                  acc[getUrgency(days)] += 1;
                  return acc;
                },
                { expired: 0, week: 0, month: 0, quarter: 0, later: 0 } as Record<UrgencyBucket, number>,
              );

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
                        {groupCounts.expired > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">
                            {groupCounts.expired} expired
                          </span>
                        )}
                        {groupCounts.week > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-700">
                            {groupCounts.week} this week
                          </span>
                        )}
                        {groupCounts.month > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                            {groupCounts.month} this month
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
                      className="flex-shrink-0 text-[11px] font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-50 px-2 py-1 rounded-md transition-colors"
                    >
                      Open
                    </button>
                  </div>
                  {!isCollapsed && (
                    <ul className="divide-y divide-gray-100">
                      {group.records.map((record) => (
                        <ExpirationRow
                          key={record.id}
                          record={record}
                          isSubscribed={checkSubscribed(record.name || '(untitled)', record.information || '', record.expirationDate)}
                          onSelect={() => handleRecordClick(record)}
                          onToggleSubscription={() => handleToggleSubscription(record)}
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

interface StatChipProps {
  label: string;
  count: number;
  dotColor: string;
  active: boolean;
  onClick: () => void;
}

const StatChip: React.FC<StatChipProps> = ({ label, count, dotColor, active, onClick }) => (
  <button
    onClick={onClick}
    className={`group relative overflow-hidden rounded-xl border transition-all duration-200 text-left ${
      active
        ? 'border-amber-300 ring-2 ring-amber-200 shadow-sm'
        : 'border-gray-200 hover:border-gray-300 hover:-translate-y-0.5 hover:shadow-sm'
    } bg-white`}
  >
    <div className="p-2.5 flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-lg font-semibold text-gray-900 leading-none mt-0.5">{count}</p>
      </div>
    </div>
  </button>
);

interface ExpirationRowProps {
  record: ExpirationRecord;
  isSubscribed: boolean;
  onSelect: () => void;
  onToggleSubscription: () => void;
}

const ExpirationRow: React.FC<ExpirationRowProps> = ({ record, isSubscribed, onSelect, onToggleSubscription }) => {
  const days = getDaysUntil(record.expirationDate);
  const urgency = getUrgency(days);
  const meta = urgencyMeta[urgency];
  const iconId = record.source === 'item'
    ? record.itemIconId ?? ITEM_FALLBACK_ICON_ID
    : record.boxIconId ?? null;
  const accent = record.source === 'item'
    ? record.itemAccentColor ?? '#d97706'
    : record.boxAccentColor ?? '#d97706';

  const breadcrumb = [record.sublocationName, record.positionName, record.boxName, record.folderName].filter(Boolean);

  return (
    <li className="flex items-center">
      <button
        onClick={onSelect}
        className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-amber-50/40 transition-colors text-left group min-w-0"
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
            <Calendar size={18} style={{ color: accent }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">{record.name || '(untitled)'}</p>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 flex-shrink-0 capitalize">
              {record.source}
            </span>
          </div>
          {breadcrumb.length > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5 flex-wrap">
              {breadcrumb.map((part, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-gray-300">/</span>}
                  <span className="truncate max-w-[140px]">{part}</span>
                </React.Fragment>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.chipBg} ${meta.chipText}`}>
              <Clock size={10} />
              {formatDaysLabel(days)}
            </span>
            <span className="text-[11px] text-gray-400">
              {formatDateDisplay(record.expirationDate)}
            </span>
          </div>
        </div>
      </button>
      <button
        onClick={onToggleSubscription}
        className={`flex-shrink-0 p-2.5 mr-3 rounded-lg transition-colors ${
          isSubscribed
            ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
        title={isSubscribed ? 'Unsubscribe from alerts' : 'Subscribe to alerts'}
      >
        {isSubscribed ? <Bell size={16} /> : <BellOff size={16} />}
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
    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-yellow-100 mb-4">
      <CalendarClock className="h-8 w-8 text-amber-600" />
    </div>
    <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
    <p className="text-sm text-gray-500">{message}</p>
  </div>
);

export default ExpirationPage;
