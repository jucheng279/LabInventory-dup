import React, { useState, useMemo, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, Package, MapPin, Box, Search, X, Layers, FileSpreadsheet, CalendarClock, Calendar, ExternalLink, Bell, BellRing, Clock, Plus, Tag, MoveHorizontal as MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useCentralizedInventory } from '../hooks/useCentralizedInventory';
import { useColumnCount } from '../hooks/useColumnCount';
import {
  computeCentralizedInventory,
  type InventoryNameGroup,
  type InventoryInfoEntry,
  type InventoryLocationEntry,
  type InventoryBoxEntry,
} from '../utils/centralizedInventoryUtils';
import { useExpirationSubscriptions } from '../hooks/useExpirationSubscriptions';
import { useInventoryItemTypes } from '../hooks/useInventoryItemTypes';
import { useAuth } from '../contexts/AuthContext';
import type { BoxType, InventoryItemTypeRecord } from '../types/database';
import SvgIcon from './SvgIcon';
import ItemTypeModal from './ItemTypeModal';
import AssignItemTypeModal from './AssignItemTypeModal';

export interface InventoryListViewProps {
  onNavigateToBox?: (
    locationId: string,
    boxId: string,
    boxName: string,
    boxAccentColor: string | null,
    boxType?: BoxType,
    highlightCellId?: string,
  ) => void;
  onNavigateToItem?: (
    locationId: string,
    sublocationId: string | null,
    positionId: string | null,
    folderId: string,
    itemId: string,
  ) => void;
  onNavigateToLocation?: (locationId: string) => void;
}

const InventoryListView: React.FC<InventoryListViewProps> = ({
  onNavigateToBox,
  onNavigateToItem,
  onNavigateToLocation,
}) => {
  const { data, isLoading } = useCentralizedInventory();
  const { workspace } = useAuth();
  const {
    itemTypes,
    createItemType,
    updateItemType,
    deleteItemType,
    assignItemType,
    isCreating,
    isUpdating,
    isAssigning,
  } = useInventoryItemTypes();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
  const [expandedInfos, setExpandedInfos] = useState<Set<string>>(new Set());
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const { isSubscribed, toggleSubscription } = useExpirationSubscriptions();

  // Modal state
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<InventoryItemTypeRecord | null>(null);
  const [typeContextMenu, setTypeContextMenu] = useState<{ type: InventoryItemTypeRecord; x: number; y: number } | null>(null);
  const [assignModal, setAssignModal] = useState<{ itemName: string; currentTypeId: string | null; itemIds: string[] } | null>(null);

  const handleToggleExpirationSubscription = useCallback((nameKey: string, itemInfo: string, date: string, locationName?: string, boxName?: string) => {
    toggleSubscription({
      item_name: nameKey,
      item_info: itemInfo,
      source: 'cell',
      source_id: `inv:${nameKey}:${itemInfo}`,
      expiration_date: date,
      location_name: locationName ?? null,
      box_name: boxName ?? null,
    });
  }, [toggleSubscription]);

  const summary = useMemo(() => {
    if (!data) return null;
    return computeCentralizedInventory(data);
  }, [data]);

  // Build a map of itemId -> item_type_id from raw data for assign lookups
  const itemTypeMap = useMemo(() => {
    if (!data) return new Map<string, string | null>();
    const map = new Map<string, string | null>();
    for (const item of data.standaloneItems) {
      map.set(item.id, (item as any).item_type_id ?? null);
    }
    for (const item of data.folderItems) {
      map.set(item.id, (item as any).item_type_id ?? null);
    }
    return map;
  }, [data]);

  // Collect all item IDs that belong to a name group (standalone + folder items only)
  const itemIdsByName = useMemo(() => {
    if (!data) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    for (const item of [...data.standaloneItems, ...data.folderItems]) {
      const name = (item.name || '').trim();
      if (!name) continue;
      const existing = map.get(name) || [];
      existing.push(item.id);
      map.set(name, existing);
    }
    return map;
  }, [data]);

  const filteredGroups = useMemo(() => {
    if (!summary) return [];
    let groups = summary.groups;

    // Filter by selected type
    if (selectedTypeId !== null) {
      groups = groups.filter(g => g.itemTypeIds.has(selectedTypeId));
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      groups = groups.filter(g => g.name.toLowerCase().includes(term));
    }

    return groups;
  }, [summary, searchTerm, selectedTypeId]);

  // Build a map of typeId -> icon_id for icon overrides
  const typeIconMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of itemTypes) {
      map.set(t.id, t.icon_id);
    }
    return map;
  }, [itemTypes]);

  // For a given name group, resolve the icon: if all items in the group share one type, use that type's icon
  const getGroupIconId = useCallback((group: InventoryNameGroup): string | null => {
    const typeIds = Array.from(group.itemTypeIds).filter((id): id is string => id !== null);
    if (typeIds.length === 1) {
      return typeIconMap.get(typeIds[0]) || null;
    }
    return null;
  }, [typeIconMap]);

  const toggleName = useCallback((name: string) => {
    setExpandedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleInfo = useCallback((key: string) => {
    setExpandedInfos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleLocation = useCallback((key: string) => {
    setExpandedLocations(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleCreateType = async (name: string, iconId: string) => {
    if (!workspace) return;
    await createItemType({ workspace_id: workspace.id, name, icon_id: iconId });
    setShowCreateTypeModal(false);
  };

  const handleEditType = async (name: string, iconId: string) => {
    if (!editingType) return;
    await updateItemType({ id: editingType.id, data: { name, icon_id: iconId } });
    setEditingType(null);
  };

  const handleDeleteType = async (typeId: string) => {
    await deleteItemType(typeId);
    if (selectedTypeId === typeId) setSelectedTypeId(null);
    setTypeContextMenu(null);
  };

  const handleAssignType = async (typeId: string | null) => {
    if (!assignModal) return;
    for (const itemId of assignModal.itemIds) {
      await assignItemType({ itemId, typeId });
    }
    setAssignModal(null);
  };

  const handleTypeContextMenu = (e: React.MouseEvent, type: InventoryItemTypeRecord) => {
    e.preventDefault();
    e.stopPropagation();
    setTypeContextMenu({ type, x: e.clientX, y: e.clientY });
  };

  const openAssignModal = (groupName: string) => {
    const ids = itemIdsByName.get(groupName) || [];
    if (ids.length === 0) return;
    const firstTypeId = itemTypeMap.get(ids[0]) ?? null;
    setAssignModal({ itemName: groupName, currentTypeId: firstTypeId, itemIds: ids });
  };

  if (isLoading) {
    return (
      <div className="@container flex-1 min-w-0 overflow-y-auto p-4 @3xl:p-6">
        <div className="grid grid-cols-1 @3xl:grid-cols-2 @7xl:grid-cols-3 @min-[100rem]:grid-cols-4 gap-x-0 gap-y-0">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary || summary.groups.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Package size={24} className="text-gray-400" />
        </div>
        <h3 className="text-sm font-medium text-gray-700 mb-1">No inventory items</h3>
        <p className="text-xs text-gray-500 max-w-xs">
          Add reagents to your boxes or create inventory items to see them listed here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      {/* Type filter pills + search */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white space-y-2.5">
        {/* Type pills row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {/* All pill */}
          <button
            onClick={() => setSelectedTypeId(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              selectedTypeId === null
                ? 'bg-gray-900 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>

          {/* Item type pills */}
          {itemTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedTypeId(type.id === selectedTypeId ? null : type.id)}
              onContextMenu={(e) => handleTypeContextMenu(e, type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 group ${
                selectedTypeId === type.id
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <SvgIcon
                iconId={type.icon_id}
                size={14}
                tintColor={selectedTypeId === type.id ? '#ffffff' : '#6b7280'}
              />
              <span>{type.name}</span>
              <button
                onClick={(e) => handleTypeContextMenu(e, type)}
                className={`ml-0.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                  selectedTypeId === type.id ? 'hover:bg-blue-600' : 'hover:bg-gray-300'
                }`}
              >
                <MoreHorizontal size={12} />
              </button>
            </button>
          ))}

          {/* Add type button */}
          <button
            onClick={() => setShowCreateTypeModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all flex-shrink-0 border border-dashed border-gray-300 hover:border-gray-400"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg border border-gray-200 px-2.5 py-1.5">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Filter by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="p-0.5 hover:bg-gray-200 rounded">
              <X size={12} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Context menu for type pill */}
      {typeContextMenu && (
        <TypeContextMenu
          x={typeContextMenu.x}
          y={typeContextMenu.y}
          onEdit={() => {
            setEditingType(typeContextMenu.type);
            setTypeContextMenu(null);
          }}
          onDelete={() => handleDeleteType(typeContextMenu.type.id)}
          onClose={() => setTypeContextMenu(null)}
        />
      )}

      {/* Column list */}
      <ColumnLayout
        groups={filteredGroups}
        expandedNames={expandedNames}
        toggleName={toggleName}
        expandedInfos={expandedInfos}
        onToggleInfo={toggleInfo}
        expandedLocations={expandedLocations}
        onToggleLocation={toggleLocation}
        isSubscribed={isSubscribed}
        onToggleExpirationSubscription={handleToggleExpirationSubscription}
        searchTerm={searchTerm}
        onNavigateToBox={onNavigateToBox}
        onNavigateToItem={onNavigateToItem}
        onNavigateToLocation={onNavigateToLocation}
        getGroupIconId={getGroupIconId}
        onAssignType={openAssignModal}
        hasItemTypes={itemTypes.length > 0}
      />

      {/* Create type modal */}
      <ItemTypeModal
        isOpen={showCreateTypeModal}
        onClose={() => setShowCreateTypeModal(false)}
        onSave={handleCreateType}
        isSaving={isCreating}
        title="New Item Type"
      />

      {/* Edit type modal */}
      <ItemTypeModal
        isOpen={!!editingType}
        onClose={() => setEditingType(null)}
        onSave={handleEditType}
        isSaving={isUpdating}
        title="Edit Item Type"
        initialName={editingType?.name}
        initialIconId={editingType?.icon_id}
      />

      {/* Assign type modal */}
      <AssignItemTypeModal
        isOpen={!!assignModal}
        onClose={() => setAssignModal(null)}
        itemTypes={itemTypes}
        currentTypeId={assignModal?.currentTypeId ?? null}
        onAssign={handleAssignType}
        isAssigning={isAssigning}
        itemName={assignModal?.itemName ?? ''}
      />
    </div>
  );
};

// ─── Type Context Menu ──────────────────────────────────────────────────────────

interface TypeContextMenuProps {
  x: number;
  y: number;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const TypeContextMenu: React.FC<TypeContextMenuProps> = ({ x, y, onEdit, onDelete, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const adjustedY = Math.min(y, window.innerHeight - 120);
  const adjustedX = Math.min(x, window.innerWidth - 160);

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 min-w-[140px]"
      style={{ top: adjustedY, left: adjustedX }}
    >
      <button
        onClick={onEdit}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Pencil size={14} className="text-gray-400" />
        Edit
      </button>
      <button
        onClick={onDelete}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={14} className="text-red-400" />
        Delete
      </button>
    </div>
  );
};

// ─── Column Layout ──────────────────────────────────────────────────────────────

interface ColumnLayoutProps {
  groups: InventoryNameGroup[];
  expandedNames: Set<string>;
  toggleName: (name: string) => void;
  expandedInfos: Set<string>;
  onToggleInfo: (key: string) => void;
  expandedLocations: Set<string>;
  onToggleLocation: (key: string) => void;
  isSubscribed: (name: string, info: string, date: string) => boolean;
  onToggleExpirationSubscription: (nameKey: string, itemInfo: string, date: string, locationName?: string, boxName?: string) => void;
  searchTerm: string;
  onNavigateToBox?: InventoryListViewProps['onNavigateToBox'];
  onNavigateToItem?: InventoryListViewProps['onNavigateToItem'];
  onNavigateToLocation?: InventoryListViewProps['onNavigateToLocation'];
  getGroupIconId: (group: InventoryNameGroup) => string | null;
  onAssignType: (groupName: string) => void;
  hasItemTypes: boolean;
}

const COLLAPSED_CARD_HEIGHT = 44;

const ColumnLayout: React.FC<ColumnLayoutProps> = ({
  groups,
  expandedNames,
  toggleName,
  expandedInfos,
  onToggleInfo,
  expandedLocations,
  onToggleLocation,
  isSubscribed,
  onToggleExpirationSubscription,
  searchTerm,
  onNavigateToBox,
  onNavigateToItem,
  onNavigateToLocation,
  getGroupIconId,
  onAssignType,
  hasItemTypes,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const colCount = useColumnCount(containerRef);

  const columns = useMemo(() => {
    const cols: InventoryNameGroup[][] = Array.from({ length: colCount }, () => []);
    groups.forEach((group, i) => {
      cols[i % colCount].push(group);
    });
    return cols;
  }, [groups, colCount]);

  return (
    <div ref={containerRef} className="flex-1 min-w-0 overflow-y-auto px-2 py-3" style={{ containerType: 'inline-size' }}>
      <div className="flex gap-0 items-start">
        {columns.map((col, colIdx) => (
          <div key={colIdx} className="flex-1 min-w-0 flex flex-col">
            {col.map(group => {
              const isExpanded = expandedNames.has(group.name);
              return (
                <div key={group.name} style={!isExpanded ? { height: COLLAPSED_CARD_HEIGHT, flexShrink: 0 } : { flexShrink: 0 }}>
                  <ItemCard
                    group={group}
                    isExpanded={isExpanded}
                    onToggle={() => toggleName(group.name)}
                    expandedInfos={expandedInfos}
                    onToggleInfo={onToggleInfo}
                    expandedLocations={expandedLocations}
                    onToggleLocation={onToggleLocation}
                    isSubscribed={isSubscribed}
                    onToggleExpirationSubscription={onToggleExpirationSubscription}
                    onNavigateToBox={onNavigateToBox}
                    onNavigateToItem={onNavigateToItem}
                    onNavigateToLocation={onNavigateToLocation}
                    iconId={getGroupIconId(group)}
                    onAssignType={() => onAssignType(group.name)}
                    hasItemTypes={hasItemTypes}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {groups.length === 0 && searchTerm && (
        <div className="text-center py-12 text-gray-500 text-sm">
          No items matching &ldquo;{searchTerm}&rdquo;
        </div>
      )}
    </div>
  );
};

// ─── Item Card ──────────────────────────────────────────────────────────────────

interface ItemCardProps {
  group: InventoryNameGroup;
  isExpanded: boolean;
  onToggle: () => void;
  expandedInfos: Set<string>;
  onToggleInfo: (key: string) => void;
  expandedLocations: Set<string>;
  onToggleLocation: (key: string) => void;
  isSubscribed: (name: string, info: string, date: string) => boolean;
  onToggleExpirationSubscription: (nameKey: string, itemInfo: string, date: string, locationName?: string, boxName?: string) => void;
  onNavigateToBox?: InventoryListViewProps['onNavigateToBox'];
  onNavigateToItem?: InventoryListViewProps['onNavigateToItem'];
  onNavigateToLocation?: InventoryListViewProps['onNavigateToLocation'];
  iconId: string | null;
  onAssignType: () => void;
  hasItemTypes: boolean;
}

const ItemCard: React.FC<ItemCardProps> = ({
  group,
  isExpanded,
  onToggle,
  expandedInfos,
  onToggleInfo,
  expandedLocations,
  onToggleLocation,
  isSubscribed,
  onToggleExpirationSubscription,
  onNavigateToBox,
  onNavigateToItem,
  onNavigateToLocation,
  iconId,
  onAssignType,
  hasItemTypes,
}) => {
  const hasChildren = group.hasInfoSubdivision
    ? group.infos.length > 0
    : group.infos.some(i => i.locations.length > 0);

  const hasExpirationChild = group.infos.some(i => i.dateType === 'expiration');

  return (
    <div className={`rounded-lg border transition-all duration-200 ${isExpanded ? 'border-gray-200 bg-white shadow-sm' : 'border-transparent hover:bg-white hover:border-gray-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]'}`}>
      {/* Name row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-2 py-2 text-left rounded-lg transition-colors group"
      >
        <div className="flex-shrink-0 w-5 flex items-center justify-center">
          {hasChildren ? (
            isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />
          ) : (
            <div className="w-4" />
          )}
        </div>
        {iconId ? (
          <SvgIcon iconId={iconId} size={16} tintColor="#3b82f6" />
        ) : (
          <Package size={16} className="text-blue-500 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
        )}
        <span className="font-medium text-gray-900 flex-1 break-words min-w-0">{group.name}</span>
        {hasItemTypes && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAssignType();
            }}
            className="p-1 rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
            title="Assign item type"
          >
            <Tag size={12} />
          </button>
        )}
        {hasExpirationChild && (
          <span className="flex items-center gap-0 mr-1 text-gray-300" title="Has expiration dates">
            <Bell size={12} />
            <Clock size={9} className="-ml-0.5 mt-1.5" />
          </span>
        )}
        <span className="inline-flex items-center justify-center min-w-[32px] h-6 px-2.5 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full flex-shrink-0">
          {group.totalCount}
        </span>
      </button>

      {/* Expanded details */}
      {isExpanded && hasChildren && (
        <div className="px-1 pb-2">
          {group.hasInfoSubdivision ? (
            <div className="space-y-0.5">
              {group.infos.map((info, idx) => {
                const infoKey = `${group.name}__${idx}`;
                const isInfoExpanded = expandedInfos.has(infoKey);
                return (
                  <InfoSection
                    key={infoKey}
                    info={info}
                    isExpanded={isInfoExpanded}
                    onToggle={() => onToggleInfo(infoKey)}
                    nameKey={group.name}
                    infoIndex={idx}
                    expandedLocations={expandedLocations}
                    onToggleLocation={onToggleLocation}
                    isSubscribed={isSubscribed}
                    onToggleExpirationSubscription={onToggleExpirationSubscription}
                    hideCount={group.infos.length === 1}
                    onNavigateToBox={onNavigateToBox}
                    onNavigateToItem={onNavigateToItem}
                    onNavigateToLocation={onNavigateToLocation}
                  />
                );
              })}
            </div>
          ) : (
            <div className="space-y-0.5">
              {group.infos.flatMap((info, infoIdx) =>
                info.locations.map((loc, locIdx) => {
                  const locKey = `${group.name}__${infoIdx}__${locIdx}`;
                  const isLocExpanded = expandedLocations.has(locKey);
                  return (
                    <LocationSection
                      key={locKey}
                      location={loc}
                      isExpanded={isLocExpanded}
                      onToggle={() => onToggleLocation(locKey)}
                      hideCount={group.infos.flatMap(i => i.locations).length === 1}
                      onNavigateToBox={onNavigateToBox}
                      onNavigateToItem={onNavigateToItem}
                      onNavigateToLocation={onNavigateToLocation}
                    />
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Expiration Subscribe Button ────────────────────────────────────────────────

interface ExpirationSubscribeButtonProps {
  isSubscribed: boolean;
  onToggle: () => void;
}

const ExpirationSubscribeButton: React.FC<ExpirationSubscribeButtonProps> = ({
  isSubscribed: subscribed,
  onToggle,
}) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={subscribed ? 'Unsubscribe from expiration notification' : 'Subscribe to expiration notification'}
      className={`relative flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 flex-shrink-0 ${
        subscribed
          ? 'bg-teal-50 text-teal-600 hover:bg-teal-100 ring-1 ring-teal-200'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
      }`}
    >
      {subscribed ? (
        <BellRing size={14} className="transition-transform duration-200 scale-110" />
      ) : (
        <Bell size={14} />
      )}
      <Clock
        size={7}
        className={`absolute -bottom-0 -right-0 transition-colors duration-200 ${
          subscribed ? 'text-teal-500' : 'text-gray-300'
        }`}
      />
    </button>
  );
};

// ─── Level 2: Info Section ──────────────────────────────────────────────────────

interface InfoSectionProps {
  info: InventoryInfoEntry;
  isExpanded: boolean;
  onToggle: () => void;
  nameKey: string;
  infoIndex: number;
  expandedLocations: Set<string>;
  onToggleLocation: (key: string) => void;
  isSubscribed: (name: string, info: string, date: string) => boolean;
  onToggleExpirationSubscription: (nameKey: string, itemInfo: string, date: string, locationName?: string, boxName?: string) => void;
  hideCount?: boolean;
  onNavigateToBox?: InventoryListViewProps['onNavigateToBox'];
  onNavigateToItem?: InventoryListViewProps['onNavigateToItem'];
  onNavigateToLocation?: InventoryListViewProps['onNavigateToLocation'];
}

const InfoSection: React.FC<InfoSectionProps> = ({
  info,
  isExpanded,
  onToggle,
  nameKey,
  infoIndex,
  expandedLocations,
  onToggleLocation,
  isSubscribed,
  onToggleExpirationSubscription,
  hideCount,
  onNavigateToBox,
  onNavigateToItem,
  onNavigateToLocation,
}) => {
  const hasChildren = info.locations.length > 0;
  const hasInfo = !!info.infoDisplay;
  const hasDate = !!info.date;

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getExpirationColor = (dateString: string) => {
    const now = new Date();
    const exp = new Date(dateString);
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'text-red-500';
    if (diffDays <= 30) return 'text-amber-500';
    return 'text-gray-400';
  };

  return (
    <div className={`rounded-md ${isExpanded ? 'bg-gray-50' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-100/70 rounded-md transition-colors"
      >
        <div className="flex-shrink-0 w-5 flex items-center justify-center">
          {hasChildren ? (
            isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />
          ) : (
            <div className="w-4" />
          )}
        </div>
        <Layers size={14} className="text-amber-500 flex-shrink-0" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {hasInfo && (
            <span className="text-sm text-gray-700 truncate">{info.infoDisplay}</span>
          )}
          {hasInfo && hasDate && (
            <span className="text-gray-300 flex-shrink-0">|</span>
          )}
          {hasDate && (
            <span className={`text-xs flex items-center gap-1 flex-shrink-0 whitespace-nowrap ${
              info.dateType === 'expiration' ? getExpirationColor(info.date!) : 'text-gray-400'
            }`}>
              {info.dateType === 'expiration' ? <CalendarClock className="h-3 w-3 flex-shrink-0" /> : <Calendar className="h-3 w-3 flex-shrink-0" />}
              {formatDate(info.date!)}
            </span>
          )}
          {!hasInfo && !hasDate && (
            <span className="text-sm text-gray-400 italic">(no additional info)</span>
          )}
        </div>
        {!hideCount && (
          <span className="inline-flex items-center justify-center min-w-[28px] h-5 px-2 bg-gray-200 text-gray-600 text-xs font-medium rounded-full flex-shrink-0">
            {info.totalCount}
          </span>
        )}
        {info.dateType === 'expiration' && info.date && (
          <ExpirationSubscribeButton
            isSubscribed={isSubscribed(nameKey, info.infoDisplay || '', info.date!)}
            onToggle={() => onToggleExpirationSubscription(
              nameKey,
              info.infoDisplay || '',
              info.date!,
              info.locations[0]?.locationPath,
            )}
          />
        )}
      </button>

      {isExpanded && hasChildren && (
        <div className="pb-1.5 space-y-0.5">
          {info.locations.map((loc, locIdx) => {
            const locKey = `${nameKey}__${infoIndex}__${locIdx}`;
            const isLocExpanded = expandedLocations.has(locKey);
            return (
              <LocationSection
                key={locKey}
                location={loc}
                isExpanded={isLocExpanded}
                onToggle={() => onToggleLocation(locKey)}
                hideCount={info.locations.length === 1}
                onNavigateToBox={onNavigateToBox}
                onNavigateToItem={onNavigateToItem}
                onNavigateToLocation={onNavigateToLocation}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Level 3: Location Section ──────────────────────────────────────────────────

interface LocationSectionProps {
  location: InventoryLocationEntry;
  isExpanded: boolean;
  onToggle: () => void;
  hideCount?: boolean;
  onNavigateToBox?: InventoryListViewProps['onNavigateToBox'];
  onNavigateToItem?: InventoryListViewProps['onNavigateToItem'];
  onNavigateToLocation?: InventoryListViewProps['onNavigateToLocation'];
}

const LocationSection: React.FC<LocationSectionProps> = ({ location, isExpanded, onToggle, hideCount, onNavigateToBox, onNavigateToItem, onNavigateToLocation }) => {
  const hasMultipleBoxes = location.boxes.length > 1;

  const handleNavigateSingleBox = (e: React.MouseEvent) => {
    e.stopPropagation();
    const box = location.boxes[0];
    if (!box) return;
    navigateToEntry(box, onNavigateToBox, onNavigateToItem, onNavigateToLocation);
  };

  return (
    <div className={`rounded-md ${isExpanded ? 'bg-white/80' : ''}`}>
      <div
        onClick={hasMultipleBoxes ? onToggle : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md transition-colors ${
          hasMultipleBoxes ? 'hover:bg-gray-100/70 cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="flex-shrink-0 w-5 flex items-center justify-center">
          {hasMultipleBoxes ? (
            isExpanded ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />
          ) : (
            <NavigateButton onClick={handleNavigateSingleBox} />
          )}
        </div>
        <MapPin size={13} className="text-teal-500 flex-shrink-0" />
        <span className="text-sm text-gray-600 flex-1 break-words min-w-0">{location.locationPath}</span>
        {!hasMultipleBoxes && location.boxes.length === 1 && (
          <BoxBadge entry={location.boxes[0]} />
        )}
        {!hideCount && (
          <span className="inline-flex items-center justify-center min-w-[28px] h-5 px-2 bg-gray-200 text-gray-600 text-xs font-medium rounded-full flex-shrink-0">
            {location.totalCount}
          </span>
        )}
      </div>

      {isExpanded && hasMultipleBoxes && (
        <div className="pb-1.5 space-y-0.5">
          {location.boxes.map((box, boxIdx) => (
            <BoxRow
              key={boxIdx}
              entry={box}
              hideCount={location.boxes.length === 1}
              onNavigateToBox={onNavigateToBox}
              onNavigateToItem={onNavigateToItem}
              onNavigateToLocation={onNavigateToLocation}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Level 4: Box Row ───────────────────────────────────────────────────────────

interface BoxRowProps {
  entry: InventoryBoxEntry;
  hideCount?: boolean;
  onNavigateToBox?: InventoryListViewProps['onNavigateToBox'];
  onNavigateToItem?: InventoryListViewProps['onNavigateToItem'];
  onNavigateToLocation?: InventoryListViewProps['onNavigateToLocation'];
}

const BoxRow: React.FC<BoxRowProps> = ({ entry, hideCount, onNavigateToBox, onNavigateToItem, onNavigateToLocation }) => {
  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigateToEntry(entry, onNavigateToBox, onNavigateToItem, onNavigateToLocation);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 transition-colors">
      <div className="flex-shrink-0 w-5 flex items-center justify-center">
        <NavigateButton onClick={handleNavigate} />
      </div>
      <div className="w-5 flex-shrink-0" />
      <BoxIcon boxType={entry.boxType} />
      <span className="text-sm text-gray-500 flex-1 break-words min-w-0">{entry.boxName}</span>
      {!hideCount && (
        <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full flex-shrink-0">
          {entry.count}
        </span>
      )}
    </div>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function BoxIcon({ boxType }: { boxType: InventoryBoxEntry['boxType'] }) {
  switch (boxType) {
    case 'freezer':
      return <Box size={12} className="text-blue-400 flex-shrink-0" />;
    case 'structured_freezer':
      return <Layers size={12} className="text-purple-400 flex-shrink-0" />;
    case 'standalone':
      return <Package size={12} className="text-green-400 flex-shrink-0" />;
    case 'item_sheet':
      return <FileSpreadsheet size={12} className="text-teal-400 flex-shrink-0" />;
  }
}

function BoxBadge({ entry }: { entry: InventoryBoxEntry }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-[11px] rounded-full flex-shrink-0 mr-2">
      <BoxIcon boxType={entry.boxType} />
      <span className="break-words max-w-[100px]">{entry.boxName}</span>
    </span>
  );
}

function NavigateButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className="w-5 h-5 flex items-center justify-center rounded hover:bg-teal-100 text-gray-400 hover:text-teal-600 transition-colors"
      title="Go to item"
    >
      <ExternalLink size={12} />
    </button>
  );
}

function navigateToEntry(
  entry: InventoryBoxEntry,
  onNavigateToBox?: InventoryListViewProps['onNavigateToBox'],
  onNavigateToItem?: InventoryListViewProps['onNavigateToItem'],
  onNavigateToLocation?: InventoryListViewProps['onNavigateToLocation'],
) {
  if (entry.boxType === 'freezer' || entry.boxType === 'structured_freezer') {
    if (onNavigateToBox && entry.boxId) {
      const boxType = entry.boxType as BoxType;
      onNavigateToBox(
        entry.locationId,
        entry.boxId,
        entry.boxName,
        entry.boxAccentColor,
        boxType,
        entry.firstCellId ?? undefined,
      );
    }
  } else if (entry.boxType === 'item_sheet') {
    if (onNavigateToItem && entry.folderId && entry.itemId) {
      onNavigateToItem(
        entry.locationId,
        entry.sublocationId,
        entry.positionId,
        entry.folderId,
        entry.itemId,
      );
    }
  } else {
    if (onNavigateToLocation) {
      onNavigateToLocation(entry.locationId);
    }
  }
}

export default InventoryListView;
