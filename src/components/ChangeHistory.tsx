import React, { useState, useCallback, useMemo } from 'react';
import { Clock, CreditCard as Edit3, X, Trash2, ChevronDown, ChevronUp, Loader as Loader2, CalendarClock, Scissors, Copy, MoveRight, ArrowLeftRight, ArrowRightLeft, Undo2, Redo2, RotateCcw, Eye } from 'lucide-react';
import { useBoxHistory, useRevertGroups } from '../hooks/useBoxData';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useAuth } from '../contexts/AuthContext';
import { HistoryEntry, HistoryActionType } from '../services/historyService';
import { getExpirationColor } from '../utils/cellDataUtils';
import CollapsibleSection from './CollapsibleSection';
import HistoryPreviewModal from './HistoryPreviewModal';
import type { CellData } from '../services/locationCellService';
import type { RevertGroup } from '../types/database';

interface ChangeHistoryProps {
  boxId: string;
  locationId?: string;
  cellData?: Record<string, CellData>;
  rows?: number;
  columns?: number;
  readOnly?: boolean;
}

function computePreviewState(
  currentCellData: Record<string, CellData>,
  entries: HistoryEntry[],
  targetIndex: number
): Record<string, CellData> {
  const result = { ...currentCellData };
  for (let i = 0; i < targetIndex; i++) {
    const entry = entries[i];
    if (!entry.previous_cell_data || Object.keys(entry.previous_cell_data).length === 0) continue;
    if (entry.related_box_id) continue;
    for (const cellId of entry.affected_cells) {
      const prev = entry.previous_cell_data[cellId];
      if (prev) {
        result[cellId] = {
          name: prev.name,
          information: prev.information,
          date: prev.date,
          color: prev.color,
          is_crossed: prev.is_crossed,
          date_type: prev.date_type as CellData['date_type'],
        };
      } else {
        delete result[cellId];
      }
    }
  }
  return result;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

const DIRECTIONAL_ACTIONS = new Set<HistoryActionType>(['cut', 'copy', 'move', 'swap']);

function getActionConfig(actionType: HistoryActionType) {
  switch (actionType) {
    case 'edit':
      return { icon: Edit3, verb: 'edited', colorClass: 'text-blue-600', bgClass: 'bg-blue-50' };
    case 'cross':
      return { icon: X, verb: 'crossed', colorClass: 'text-amber-600', bgClass: 'bg-amber-50' };
    case 'clear':
      return { icon: Trash2, verb: 'cleared', colorClass: 'text-red-600', bgClass: 'bg-red-50' };
    case 'cut':
      return { icon: Scissors, verb: 'cut', colorClass: 'text-orange-600', bgClass: 'bg-orange-50' };
    case 'copy':
      return { icon: Copy, verb: 'copied', colorClass: 'text-teal-600', bgClass: 'bg-teal-50' };
    case 'move':
      return { icon: MoveRight, verb: 'moved', colorClass: 'text-sky-600', bgClass: 'bg-sky-50' };
    case 'swap':
      return { icon: ArrowLeftRight, verb: 'swapped', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50' };
    case 'undo':
      return { icon: Undo2, verb: 'undid', colorClass: 'text-purple-600', bgClass: 'bg-purple-50' };
    case 'revert':
      return { icon: RotateCcw, verb: 'reverted', colorClass: 'text-amber-600', bgClass: 'bg-amber-50' };
    case 'redo':
      return { icon: Redo2, verb: 'redid', colorClass: 'text-green-600', bgClass: 'bg-green-50' };
  }
}

function getDirectionalPreposition(actionType: HistoryActionType): string {
  return actionType === 'swap' ? 'with' : 'to';
}


const VISIBLE_CELLS_LIMIT = 3;

interface CellListProps {
  cells: string[];
}

const CellList: React.FC<CellListProps> = ({ cells }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const visibleCells = cells.slice(0, VISIBLE_CELLS_LIMIT);
  const hiddenCount = cells.length - VISIBLE_CELLS_LIMIT;
  const hasMore = hiddenCount > 0;

  if (isExpanded) {
    return (
      <div className="flex flex-wrap gap-1">
        {cells.map((cell, index) => (
          <span
            key={index}
            className="text-gray-700 font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap"
          >
            {cell}
          </span>
        ))}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
        >
          less
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 max-w-[200px]">
      <div className="flex items-center gap-1 overflow-hidden">
        {visibleCells.map((cell, index) => (
          <span
            key={index}
            className="text-gray-700 font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0"
          >
            {cell}
          </span>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium whitespace-nowrap flex-shrink-0"
        >
          +{hiddenCount} more
        </button>
      )}
    </div>
  );
};

interface HistoryEntryRowProps {
  entry: HistoryEntry;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRevert?: (entryId: string) => void;
  onPreview?: (entryId: string) => void;
  isUndoing: boolean;
  isRedoing: boolean;
  isReverting: boolean;
  isFirstRevertable: boolean;
  isFirstRedoable: boolean;
  hasPreview: boolean;
}

const HistoryEntryRow: React.FC<HistoryEntryRowProps> = ({ entry, canUndo, canRedo, onUndo, onRedo, onRevert, onPreview, isUndoing, isRedoing, isReverting, isFirstRevertable, isFirstRedoable, hasPreview }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const actionConfig = getActionConfig(entry.action_type);
  const ActionIcon = actionConfig.icon;

  const userName = entry.team_member?.display_name || entry.team_member?.email || 'Unknown user';
  const hasDetails = entry.action_type === 'edit' && entry.cell_data;
  const isDirectional = DIRECTIONAL_ACTIONS.has(entry.action_type) && entry.source_cells && entry.target_cells;
  const isCrossBox = !!entry.related_box_name;

  return (
    <div className={`border-b border-gray-100 last:border-b-0 ${entry.is_undone ? 'opacity-50' : ''}`}>
      <div
        className={`flex items-start gap-3 py-3 px-2 ${hasDetails ? 'cursor-pointer hover:bg-gray-50' : ''}`}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        <div className={`p-1.5 rounded-lg ${actionConfig.bgClass} flex-shrink-0 mt-0.5`}>
          <ActionIcon className={`h-3.5 w-3.5 ${actionConfig.colorClass}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className={`flex items-start flex-wrap gap-x-1.5 gap-y-1 text-sm ${entry.is_undone ? 'line-through' : ''}`}>
            <span className="font-medium text-gray-900 truncate max-w-[140px]">{userName}</span>
            <span className={`font-medium ${actionConfig.colorClass}`}>{actionConfig.verb}</span>
            {isDirectional ? (
              <>
                <CellList cells={entry.source_cells!} />
                <span className="text-gray-400 text-xs font-medium self-center">
                  {getDirectionalPreposition(entry.action_type)}
                </span>
                <CellList cells={entry.target_cells!} />
              </>
            ) : (
              <CellList cells={entry.affected_cells} />
            )}
          </div>

          {isCrossBox && (
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <ArrowRightLeft className="h-3 w-3 text-gray-400" />
              <span>
                {entry.action_type === 'copy' ? 'from/to' : entry.action_type === 'cut' ? 'from/to' : 'with'}{' '}
                <span className="font-medium text-gray-700">{entry.related_box_name}</span>
              </span>
            </div>
          )}

          <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            <span>{formatRelativeTime(entry.created_at)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {hasPreview && onPreview && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview(entry.id);
              }}
              className="p-1 rounded-md text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
              title="Preview state at this point"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}
          {canUndo && isFirstRevertable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUndo();
              }}
              disabled={isUndoing || isReverting || isRedoing}
              className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
              title="Undo this action"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
          )}
          {!isFirstRevertable && onRevert && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRevert(entry.id);
              }}
              disabled={isUndoing || isReverting || isRedoing}
              className="p-1 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
              title="Revert to before this action"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {canRedo && isFirstRedoable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRedo();
              }}
              disabled={isUndoing || isReverting || isRedoing}
              className="p-1 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
              title="Redo this action"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          )}
          {hasDetails && (
            <button className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {isExpanded && entry.cell_data && (
        <div className="px-2 pb-3">
          <div className="ml-9 bg-gray-50 rounded-lg p-3 text-sm">
            <div className="grid gap-2">
              {entry.cell_data.name && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Name</span>
                  <p className="text-gray-900 font-medium">{entry.cell_data.name}</p>
                </div>
              )}
              {entry.cell_data.information && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Information</span>
                  <p className="text-gray-700 whitespace-pre-wrap">{entry.cell_data.information}</p>
                </div>
              )}
              {entry.cell_data.date && (
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide flex items-center gap-1">
                    {entry.cell_data.date_type === 'expiration' ? (
                      <>
                        <CalendarClock className="h-3 w-3" />
                        Expiration Date
                      </>
                    ) : (
                      'Date'
                    )}
                  </span>
                  <p className={entry.cell_data.date_type === 'expiration' ? getExpirationColor(entry.cell_data.date) : 'text-gray-700'}>
                    {new Date(entry.cell_data.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface RevertConfirmModalProps {
  entryCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const RevertConfirmModal: React.FC<RevertConfirmModalProps> = ({ entryCount, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4 w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-50 rounded-xl">
            <RotateCcw className="h-5 w-5 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Revert Changes</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          This will undo {entryCount} {entryCount === 1 ? 'action' : 'actions'} to restore the box to its previous state. This cannot be easily reversed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors"
          >
            Revert
          </button>
        </div>
      </div>
    </div>
  );
};

interface UndoRedoButtonsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isUndoing: boolean;
  isRedoing: boolean;
  isReverting: boolean;
}

export const UndoRedoButtons: React.FC<UndoRedoButtonsProps> = ({ canUndo, canRedo, onUndo, onRedo, isUndoing, isRedoing, isReverting }) => {
  const disabled = isUndoing || isRedoing || isReverting;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onUndo}
        disabled={!canUndo || disabled}
        className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Undo last action"
      >
        {isUndoing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo || disabled}
        className="p-1.5 rounded-lg text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Redo last undo"
      >
        {isRedoing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Redo2 className="h-4 w-4" />}
      </button>
    </div>
  );
};

interface HistoryContentProps {
  entries: HistoryEntry[];
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  scrollClassName?: string;
  boxId: string;
  locationId?: string;
  cellData?: Record<string, CellData>;
  rows?: number;
  columns?: number;
  readOnly?: boolean;
}

export const HistoryContent: React.FC<HistoryContentProps> = ({
  entries,
  hasMore,
  isLoadingMore,
  loadMore,
  scrollClassName = 'max-h-64',
  boxId,
  locationId,
  cellData,
  rows,
  columns,
  readOnly = false,
}) => {
  const { teamMember } = useAuth();
  const { undo, redo, restoreLatestRevert, revertToEntry, canUndoEntry, canRedoEntry, isUndoing, isRedoing, isReverting, isRestoring } = useUndoRedo(boxId, locationId);
  const [revertTarget, setRevertTarget] = useState<{ id: string; count: number } | null>(null);
  const [previewTargetId, setPreviewTargetId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const canPreview = !!(cellData && rows && columns);

  const previewState = useMemo(() => {
    if (!previewTargetId || !cellData) return null;
    const idx = entries.findIndex(e => e.id === previewTargetId);
    if (idx === -1) return null;
    return {
      cellData: computePreviewState(cellData, entries, idx),
      actionsCount: entries.slice(0, idx + 1).filter(e => e.previous_cell_data && Object.keys(e.previous_cell_data).length > 0 && !e.related_box_id).length,
    };
  }, [previewTargetId, cellData, entries]);

  const handlePreview = useCallback((entryId: string) => {
    setPreviewTargetId(entryId);
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleUndo = useCallback(async () => {
    const result = await undo();
    if (result.success) {
      showToast('Action undone successfully', 'success');
    } else {
      showToast(result.error || 'Failed to undo', 'error');
    }
  }, [undo, showToast]);

  const handleRedo = useCallback(async () => {
    const result = await redo();
    if (result.success) {
      showToast('Action redone successfully', 'success');
    } else {
      showToast(result.error || 'Failed to redo', 'error');
    }
  }, [redo, showToast]);

  const handleRevertRequest = useCallback((entryId: string) => {
    const idx = entries.findIndex(e => e.id === entryId);
    if (idx === -1) return;
    const entriesToRevert = entries.slice(0, idx + 1).filter(e => canUndoEntry(e));
    if (entriesToRevert.length === 0) return;
    setRevertTarget({ id: entryId, count: entriesToRevert.length });
  }, [entries, canUndoEntry]);

  const handleRevertConfirm = useCallback(async () => {
    if (!revertTarget || !teamMember?.id) return;
    const result = await revertToEntry(revertTarget.id, teamMember.id);
    setRevertTarget(null);
    if (result.success) {
      showToast(`Reverted ${result.revertedCount} ${result.revertedCount === 1 ? 'action' : 'actions'}`, 'success');
    } else {
      showToast(result.error || 'Failed to revert', 'error');
    }
  }, [revertTarget, revertToEntry, teamMember, showToast]);

  const firstRevertableId = entries.find(e => canUndoEntry(e))?.id;
  const firstRedoableId = entries.find(e => canRedoEntry(e))?.id;

  const { groups: revertGroups } = useRevertGroups(boxId);

  type TreeNode = { type: 'single'; entry: HistoryEntry } | BatchNode;
  type BatchNode = { type: 'batch'; batchId: string; group: RevertGroup | null; entries: HistoryEntry[]; children: TreeNode[] };

  const groupedEntries = useMemo((): TreeNode[] => {
    const groupMap = new Map<string, RevertGroup>();
    for (const g of revertGroups) groupMap.set(g.id, g);

    const topLevelGroupIds = new Set(
      revertGroups.filter(g => g.parent_group_id === null).map(g => g.id)
    );

    const childGroupsByParent = new Map<string, RevertGroup[]>();
    for (const g of revertGroups) {
      if (g.parent_group_id) {
        const children = childGroupsByParent.get(g.parent_group_id) || [];
        children.push(g);
        childGroupsByParent.set(g.parent_group_id, children);
      }
    }

    function buildBatchNode(groupId: string, allEntries: HistoryEntry[]): BatchNode {
      const directEntries = allEntries.filter(e => e.batch_id === groupId);
      const childGroups = (childGroupsByParent.get(groupId) || [])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const combinedItems: Array<{ ts: number; node: TreeNode }> = [];

      for (const entry of directEntries) {
        combinedItems.push({
          ts: new Date(entry.created_at).getTime(),
          node: { type: 'single', entry },
        });
      }

      for (const cg of childGroups) {
        const childNode = buildBatchNode(cg.id, allEntries);
        const childTs = new Date(cg.created_at).getTime();
        combinedItems.push({ ts: childTs, node: childNode });
      }

      combinedItems.sort((a, b) => b.ts - a.ts);

      return {
        type: 'batch',
        batchId: groupId,
        group: groupMap.get(groupId) || null,
        entries: directEntries,
        children: combinedItems.map(item => item.node),
      };
    }

    const topLevelNodes: TreeNode[] = [];
    const seenBatches = new Set<string>();

    for (const entry of entries) {
      if (entry.batch_id) {
        if (seenBatches.has(entry.batch_id)) continue;
        if (!topLevelGroupIds.has(entry.batch_id)) continue;
        seenBatches.add(entry.batch_id);
        topLevelNodes.push(buildBatchNode(entry.batch_id, entries));
      } else {
        topLevelNodes.push({ type: 'single', entry });
      }
    }

    return topLevelNodes;
  }, [entries, revertGroups]);

  const firstBatchId = useMemo(() => {
    const firstBatch = groupedEntries.find(g => g.type === 'batch') as BatchNode | undefined;
    return firstBatch?.batchId || null;
  }, [groupedEntries]);

  function findSealIndex(nodes: TreeNode[]): number {
    let seenFreshAction = false;
    for (let i = 0; i < nodes.length; i++) {
      const g = nodes[i];
      if (g.type === 'batch') {
        if (seenFreshAction) return i;
        seenFreshAction = true;
      } else {
        if (g.entry.is_undone) {
          if (seenFreshAction) return i;
        } else {
          seenFreshAction = true;
        }
      }
    }
    return -1;
  }

  const sealAfterIndex = useMemo(() => findSealIndex(groupedEntries), [groupedEntries]);

  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const toggleBatch = useCallback((batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }, []);

  const renderSealLine = () => (
    <div className="py-8 px-4">
      <div className="border-t-2 border-gray-300/80 mx-24" />
    </div>
  );

  const renderBatchNode = (node: BatchNode, depth: number, isTopLevelFirst: boolean, showSealBefore: boolean, isSealed?: boolean): React.ReactNode => {
    const isExpanded = expandedBatches.has(node.batchId);
    const group = node.group;
    const memberName = group?.team_member?.display_name || group?.team_member?.email || node.entries[0]?.team_member?.display_name || node.entries[0]?.team_member?.email || 'Unknown';
    const groupTime = group ? new Date(group.created_at) : node.entries[0] ? new Date(node.entries[0].created_at) : new Date();
    const time = groupTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = groupTime.toLocaleDateString();
    const allDirectEntries = node.entries;
    const totalEntries = allDirectEntries.length;
    const totalCells = new Set(allDirectEntries.flatMap(e => e.affected_cells)).size;

    const childBatchCount = node.children.filter(c => c.type === 'batch').length;
    const displayCount = totalEntries + childBatchCount;

    return (
      <React.Fragment key={node.batchId}>
        {showSealBefore && renderSealLine()}
        <div className={depth === 0 ? 'bg-amber-50/30' : ''}>
          <div
            className="flex items-center gap-2 px-2 py-3 cursor-pointer hover:bg-amber-50/60 transition-colors"
            onClick={() => toggleBatch(node.batchId)}
          >
            <div className="p-1.5 rounded-lg bg-amber-100">
              <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1 text-sm">
                <span className="font-medium text-gray-900 truncate">{memberName}</span>
                <span className="font-medium text-amber-600">reverted</span>
                <span className="text-gray-600">
                  {displayCount} {displayCount === 1 ? 'action' : 'actions'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-gray-400">{date} {time}</span>
                <span className="text-xs text-gray-400">&middot;</span>
                <span className="text-xs text-gray-400">{totalCells} {totalCells === 1 ? 'cell' : 'cells'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isTopLevelFirst && depth === 0 && !isSealed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    restoreLatestRevert().then(result => {
                      if (result.success) showToast('Revert group restored', 'success');
                      else showToast(result.error || 'Failed to restore', 'error');
                    });
                  }}
                  disabled={isRestoring || isUndoing || isRedoing}
                  className="p-1 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors"
                  title="Restore this revert group"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </button>
              )}
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              )}
            </div>
          </div>
          {isExpanded && (
            <div className="border-l-2 border-gray-200 ml-5 pl-1">
              {renderChildren(node.children, depth + 1, node.batchId)}
            </div>
          )}
        </div>
      </React.Fragment>
    );
  };

  const renderChildren = (children: TreeNode[], depth: number, _parentBatchId: string): React.ReactNode => {
    const localSealIndex = sealAfterIndex === -1 ? findSealIndex(children) : -1;
    const nodes: React.ReactNode[] = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const showSealHere = localSealIndex === i;

      if (child.type === 'single') {
        nodes.push(
          <React.Fragment key={child.entry.id}>
            {showSealHere && renderSealLine()}
            <HistoryEntryRow
              entry={child.entry}
              canUndo={false}
              canRedo={false}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onRevert={undefined}
              onPreview={canPreview ? handlePreview : undefined}
              isUndoing={isUndoing}
              isRedoing={isRedoing}
              isReverting={isReverting}
              isFirstRevertable={false}
              isFirstRedoable={false}
              hasPreview={canPreview && !!(child.entry.previous_cell_data && Object.keys(child.entry.previous_cell_data).length > 0 && !child.entry.related_box_id)}
            />
          </React.Fragment>
        );
      } else {
        nodes.push(renderBatchNode(child, depth, false, showSealHere));
      }
    }

    return nodes;
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No changes recorded yet</p>
        <p className="text-gray-400 text-xs mt-1">Modify cells to see history</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className={`overflow-y-auto ${scrollClassName}`}>
        <div className="divide-y divide-gray-100">
          {groupedEntries.map((group, groupIndex) => {
            const isSealed = sealAfterIndex !== -1 && groupIndex >= sealAfterIndex;

            const showSealLine = sealAfterIndex === groupIndex;

            if (group.type === 'single') {
              const entry = group.entry;
              const blocked = isSealed;
              const canRevert = !entry.is_undone && !entry.related_box_id && !!entry.previous_cell_data && Object.keys(entry.previous_cell_data).length > 0;
              return (
                <React.Fragment key={entry.id}>
                  {showSealLine && renderSealLine()}
                  <HistoryEntryRow
                    entry={entry}
                    canUndo={!readOnly && !blocked && canUndoEntry(entry)}
                    canRedo={!readOnly && !blocked && canRedoEntry(entry)}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onRevert={!readOnly && canRevert ? handleRevertRequest : undefined}
                    onPreview={canPreview ? handlePreview : undefined}
                    isUndoing={isUndoing}
                    isRedoing={isRedoing}
                    isReverting={isReverting}
                    isFirstRevertable={!readOnly && !blocked && entry.id === firstRevertableId}
                    isFirstRedoable={!readOnly && !blocked && entry.id === firstRedoableId}
                    hasPreview={canPreview && !!(entry.previous_cell_data && Object.keys(entry.previous_cell_data).length > 0 && !entry.related_box_id)}
                  />
                </React.Fragment>
              );
            }

            const isFirstBatch = group.batchId === firstBatchId;
            const batchIsSealed = sealAfterIndex !== -1 && groupIndex >= sealAfterIndex;
            return renderBatchNode(group, 0, isFirstBatch, showSealLine, batchIsSealed);
          })}
        </div>
      </div>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={isLoadingMore}
          className="mt-4 flex-shrink-0 w-full py-2 px-4 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoadingMore ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            'Load more'
          )}
        </button>
      )}

      {revertTarget && (
        <RevertConfirmModal
          entryCount={revertTarget.count}
          onConfirm={handleRevertConfirm}
          onCancel={() => setRevertTarget(null)}
        />
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {previewState && rows && columns && (
        <HistoryPreviewModal
          previewCellData={previewState.cellData}
          rows={rows}
          columns={columns}
          actionsCount={previewState.actionsCount}
          onClose={() => setPreviewTargetId(null)}
          onRevert={() => {
            setPreviewTargetId(null);
            if (previewTargetId) handleRevertRequest(previewTargetId);
          }}
        />
      )}

    </div>
  );
};

const ChangeHistory: React.FC<ChangeHistoryProps> = ({ boxId, locationId, cellData, rows, columns, readOnly = false }) => {
  const { entries, isLoading, isLoadingMore, hasMore, loadMore } = useBoxHistory(boxId);
  const { undo, redo, canUndoFromEntries, canRedoFromEntries, isUndoing, isRedoing, isReverting } = useUndoRedo(boxId, locationId);

  const canUndo = canUndoFromEntries(entries);
  const canRedo = canRedoFromEntries(entries);

  const handleUndoLatest = useCallback(async () => {
    await undo();
  }, [undo]);

  const handleRedoLatest = useCallback(async () => {
    await redo();
  }, [redo]);

  if (isLoading) {
    return (
      <CollapsibleSection title="Change History" defaultOpen={false}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      title="Change History"
      defaultOpen={false}
      headerRight={
        !readOnly ? (
          <UndoRedoButtons
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndoLatest}
            onRedo={handleRedoLatest}
            isUndoing={isUndoing}
            isRedoing={isRedoing}
            isReverting={isReverting}
          />
        ) : undefined
      }
    >
      <HistoryContent
        entries={entries}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        loadMore={loadMore}
        boxId={boxId}
        locationId={locationId}
        cellData={cellData}
        rows={rows}
        columns={columns}
        readOnly={readOnly}
      />
    </CollapsibleSection>
  );
};

export default ChangeHistory;
