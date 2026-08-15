import React, { useState, useEffect } from 'react';
import { X, Table2, Plus, Link2, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ItemFolder, ItemFolderHeader, GridItemLinkType } from '../types/database';
import type { FolderHeaderInput } from '../services/itemFolderHeaderService';
import { itemFolderService } from '../services/itemFolderService';
import { itemFolderHeaderService } from '../services/itemFolderHeaderService';
import CreateItemFolderModal from './CreateItemFolderModal';
import Portal from './Portal';

interface SelectFolderForLinkModalProps {
  locationId: string;
  sublocationId: string | null;
  positionId: string | null;
  reagentName: string;
  reagentInfo: string | null;
  linkType: GridItemLinkType;
  autoHeaders?: FolderHeaderInput[];
  onSelect: (folderId: string) => void;
  onClose: () => void;
}

function isFolderCompatible(folderHeaders: ItemFolderHeader[], requiredHeaders: FolderHeaderInput[]): boolean {
  const remaining = [...folderHeaders];
  for (const req of requiredHeaders) {
    const idx = remaining.findIndex(
      h => h.header_text === req.name && h.header_type === req.type,
    );
    if (idx === -1) return false;
    remaining.splice(idx, 1);
  }
  return true;
}

const SelectFolderForLinkModal: React.FC<SelectFolderForLinkModalProps> = ({
  locationId,
  sublocationId,
  positionId,
  reagentName,
  reagentInfo,
  linkType,
  autoHeaders,
  onSelect,
  onClose,
}) => {
  const [folders, setFolders] = useState<ItemFolder[]>([]);
  const [folderHeadersMap, setFolderHeadersMap] = useState<Record<string, ItemFolderHeader[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  const fetchFolders = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('item_folders')
        .select('*')
        .eq('location_id', locationId)
        .order('display_order', { ascending: true });

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

      const { data, error } = await query;
      if (error) throw error;
      const folderList = data || [];
      setFolders(folderList);

      if (autoHeaders && autoHeaders.length > 0 && folderList.length > 0) {
        const folderIds = folderList.map(f => f.id);
        const { data: allHeaders, error: hError } = await supabase
          .from('item_folder_headers')
          .select('*')
          .in('folder_id', folderIds)
          .order('display_order', { ascending: true });
        if (hError) throw hError;

        const map: Record<string, ItemFolderHeader[]> = {};
        for (const h of (allHeaders || [])) {
          if (!map[h.folder_id]) map[h.folder_id] = [];
          map[h.folder_id].push(h);
        }
        setFolderHeadersMap(map);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, [locationId, sublocationId, positionId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleCreateFolder = async (
    data: { name: string; description: string; accent_color: string | null; icon_id?: string | null },
    headers: FolderHeaderInput[],
  ) => {
    const folder = await itemFolderService.createFolder({
      ...data,
      location_id: locationId,
      sublocation_id: sublocationId,
      position_id: positionId,
    });
    if (headers.length > 0) {
      await itemFolderHeaderService.createHeaders(folder.id, headers);
    }
    setShowCreateFolder(false);
    onSelect(folder.id);
  };

  if (showCreateFolder) {
    return (
      <CreateItemFolderModal
        onClose={() => setShowCreateFolder(false)}
        onCreate={handleCreateFolder}
        lockedHeaders={autoHeaders}
      />
    );
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50">
                <Link2 size={20} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add as Item</h2>
                <p className="text-sm text-gray-500 truncate max-w-[250px]">
                  {reagentName}
                  {linkType === 'name_info' && reagentInfo ? ` - ${reagentInfo}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="p-5">
            <p className="text-sm text-gray-600 mb-4">
              Select a sheet to add this reagent as an inventory item:
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {folders.map((folder) => {
                  const color = folder.accent_color || '#3b82f6';
                  const compatible = !autoHeaders || autoHeaders.length === 0 || isFolderCompatible(folderHeadersMap[folder.id] || [], autoHeaders);

                  return (
                    <button
                      key={folder.id}
                      onClick={() => compatible && onSelect(folder.id)}
                      disabled={!compatible}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                        compatible
                          ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer'
                          : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: compatible ? `${color}15` : '#f3f4f6' }}
                      >
                        <Table2 size={20} style={{ color: compatible ? color : '#9ca3af' }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium truncate ${compatible ? 'text-gray-900' : 'text-gray-400'}`}>{folder.name}</p>
                        {!compatible ? (
                          <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                            <Lock size={10} className="flex-shrink-0" />
                            Missing required headers
                          </p>
                        ) : folder.description ? (
                          <p className="text-sm text-gray-500 truncate">{folder.description}</p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}

                <button
                  onClick={() => setShowCreateFolder(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/30 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Plus size={20} className="text-gray-500" />
                  </div>
                  <p className="font-medium text-gray-600">Create New Sheet</p>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default SelectFolderForLinkModal;
