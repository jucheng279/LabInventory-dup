import React, { useState, useEffect } from 'react';
import { X, Package, ChevronDown, ChevronRight, Table2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { itemService, InventoryItem } from '../services/itemService';
import { itemFolderHeaderService } from '../services/itemFolderHeaderService';
import type { ItemFolder, ItemFolderHeader, BoxGridItemLink, SlideBoxHeader } from '../types/database';
import Portal from './Portal';
import SvgIcon from './SvgIcon';
import { ITEM_FALLBACK_ICON_ID } from '../config/iconRegistry';

interface FolderWithItems {
  folder: ItemFolder;
  items: InventoryItem[];
  compatible: boolean;
}

interface RequiredHeader {
  header_text: string;
  header_type: string;
}

interface SelectItemForGridModalProps {
  locationId: string;
  sublocationId: string | null;
  positionId: string | null;
  existingLinks: BoxGridItemLink[];
  boxHeaders?: SlideBoxHeader[];
  onSelect: (item: InventoryItem) => void;
  onClose: () => void;
  /** Enforces framework separation:
   *  'standalone' = show only items without a folder (for normal freezer box linking).
   *  'sheet' = show only items in folders with compatible headers (for structured freezer box linking).
   *  These two modes prevent cross-framework linking. */
  mode?: 'standalone' | 'sheet';
}

function isFolderCompatible(folderHeaders: ItemFolderHeader[], requiredHeaders: RequiredHeader[]): boolean {
  const remaining = [...folderHeaders];
  return requiredHeaders.every((req) => {
    const idx = remaining.findIndex((fh) => fh.header_text === req.header_text && fh.header_type === req.header_type);
    if (idx === -1) return false;
    remaining.splice(idx, 1);
    return true;
  });
}

export default function SelectItemForGridModal({
  locationId,
  sublocationId,
  positionId,
  existingLinks,
  boxHeaders,
  onSelect,
  onClose,
  mode = 'standalone',
}: SelectItemForGridModalProps) {
  const [folderGroups, setFolderGroups] = useState<FolderWithItems[]>([]);
  const [standaloneItems, setStandaloneItems] = useState<InventoryItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const linkedItemIds = new Set(existingLinks.map((link) => link.item_id));
  const autoHeaders: RequiredHeader[] = (boxHeaders || []).map((bh) => ({
    header_text: bh.header_text,
    header_type: bh.header_type,
  }));

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      try {
        if (mode === 'standalone') {
          const items = await itemService.getStandaloneItems(locationId, sublocationId, positionId);
          if (!cancelled) {
            setStandaloneItems(items.filter((item) => !linkedItemIds.has(item.id)));
          }
        } else {
          // Fetch item_folders for this location
          let query = supabase
            .from('item_folders')
            .select('*')
            .eq('location_id', locationId);

          if (sublocationId) {
            query = query.eq('sublocation_id', sublocationId);
          } else {
            query = query.is('sublocation_id', null);
          }

          if (positionId) {
            query = query.eq('position_id', positionId);
          } else {
            query = query.is('position_id', null);
          }

          const { data: folders, error } = await query.order('name', { ascending: true });
          if (error) throw error;
          if (cancelled) return;

          const groups: FolderWithItems[] = [];

          for (const folder of folders || []) {
            let compatible = true;

            if (autoHeaders.length > 0) {
              const headers = await itemFolderHeaderService.getHeaders(folder.id);
              compatible = isFolderCompatible(headers, autoHeaders);
            }

            const items = await itemService.getItemsByFolder(folder.id);
            const availableItems = items.filter((item) => !linkedItemIds.has(item.id));

            groups.push({
              folder,
              items: availableItems,
              compatible,
            });
          }

          if (!cancelled) {
            setFolderGroups(groups);
            // Auto-expand if only one group
            if (groups.length === 1) {
              setExpandedFolders(new Set([groups[0].folder.id]));
            }
          }
        }
      } catch (err) {
        console.error('Error fetching items for grid modal:', err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [locationId, sublocationId, positionId, mode]);

  const totalItems =
    mode === 'standalone'
      ? standaloneItems.length
      : folderGroups
          .filter((g) => g.compatible)
          .reduce((sum, g) => sum + g.items.length, 0);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Link Existing Item</h2>
              <p className="text-sm text-gray-500">{totalItems} available</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : totalItems === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Package size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No items available</p>
                <p className="text-xs text-gray-400 mt-1">
                  {mode === 'standalone'
                    ? 'All standalone items are already linked'
                    : 'No compatible items found in sheets'}
                </p>
              </div>
            ) : mode === 'standalone' ? (
              <div className="space-y-0.5">
                {standaloneItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      <SvgIcon iconId={item.icon_id || ITEM_FALLBACK_ICON_ID} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      {item.note && (
                        <p className="text-xs text-gray-500 truncate">{item.note}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {item.stock_number} {item.unit}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-0.5">
                {folderGroups.map((group) => {
                  const isExpanded = expandedFolders.has(group.folder.id);
                  const isCompatible = group.compatible;

                  return (
                    <div key={group.folder.id}>
                      <button
                        onClick={() => isCompatible && toggleFolder(group.folder.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          isCompatible
                            ? 'hover:bg-gray-50 cursor-pointer'
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                        disabled={!isCompatible}
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <Table2 size={16} className="text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {group.folder.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {isCompatible ? (
                          <div className="flex-shrink-0 text-gray-400">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </div>
                        ) : (
                          <div className="flex-shrink-0 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            Incompatible
                          </div>
                        )}
                      </button>

                      {isExpanded && isCompatible && (
                        <div className="ml-4 pl-4 border-l border-gray-100 space-y-0.5 mt-0.5">
                          {group.items.length === 0 ? (
                            <p className="text-xs text-gray-400 py-2 px-3">No available items</p>
                          ) : (
                            group.items.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => onSelect(item)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors"
                              >
                                <div className="flex-shrink-0 w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center">
                                  <SvgIcon iconId={item.icon_id || ITEM_FALLBACK_ICON_ID} size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {item.name}
                                  </p>
                                  {item.note && (
                                    <p className="text-xs text-gray-500 truncate">
                                      {item.note}
                                    </p>
                                  )}
                                </div>
                                <div className="flex-shrink-0 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                  {item.stock_number} {item.unit}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
