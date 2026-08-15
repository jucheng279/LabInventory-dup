import React from 'react';
import { ArrowRight, X } from 'lucide-react';
import Portal from './Portal';
import SvgIcon from './SvgIcon';
import type { TreeNode, TreeNodeType } from '../utils/treeLayoutUtils';
import { getDefaultIconForContext } from '../config/iconRegistry';

export interface DragDropConfirmData {
  sourceNode: TreeNode;
  targetNode: TreeNode;
}

interface DragDropConfirmModalProps {
  data: DragDropConfirmData;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const typeLabels: Record<TreeNodeType, string> = {
  location: 'Location',
  sublocation: 'Sub-location',
  position: 'Position',
  box: 'Box',
  folder: 'Sheet',
};

function getResultDescription(source: TreeNode, target: TreeNode): string {
  if (source.type === 'box' || source.type === 'folder') {
    const label = source.type === 'box' ? 'box' : 'sheet';
    if (target.type === 'location') return `This ${label} will be moved directly under "${target.name}".`;
    if (target.type === 'sublocation') return `This ${label} will be moved into sub-location "${target.name}".`;
    if (target.type === 'position') return `This ${label} will be moved into position "${target.name}".`;
    return `This ${label} will be moved.`;
  }

  if (source.type === 'location') {
    if (target.type === 'location') return `"${source.name}" will become a sub-location under "${target.name}".`;
    if (target.type === 'sublocation') return `"${source.name}" will become a position under "${target.name}".`;
  }
  if (source.type === 'sublocation') {
    if (target.type === 'location') return `"${source.name}" will become a sub-location under "${target.name}".`;
    if (target.type === 'sublocation') return `"${source.name}" will become a position under "${target.name}".`;
  }
  if (source.type === 'position') {
    if (target.type === 'location') return `"${source.name}" will become a sub-location under "${target.name}".`;
    if (target.type === 'sublocation') return `"${source.name}" will become a position under "${target.name}".`;
  }

  return 'This item will be moved.';
}

function getIconForNode(node: TreeNode): string | null {
  if (node.iconId) return node.iconId;
  switch (node.type) {
    case 'location':
    case 'sublocation':
    case 'position':
      return getDefaultIconForContext('location');
    case 'box':
      return getDefaultIconForContext('box');
    case 'folder':
      return getDefaultIconForContext('folder');
    default:
      return getDefaultIconForContext('location');
  }
}

const DragDropConfirmModal: React.FC<DragDropConfirmModalProps> = ({
  data,
  onConfirm,
  onCancel,
  isProcessing,
}) => {
  const { sourceNode, targetNode } = data;

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          onClick={onCancel}
        />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Confirm Move</h2>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: sourceNode.accentColor ? `${sourceNode.accentColor}20` : '#f3f4f6' }}
                >
                  <SvgIcon iconId={getIconForNode(sourceNode)} size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 uppercase font-medium tracking-wide">{typeLabels[sourceNode.type]}</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{sourceNode.name}</p>
                </div>
              </div>

              <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />

              <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2.5 bg-blue-50 rounded-xl border border-blue-100">
                <div
                  className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: targetNode.accentColor ? `${targetNode.accentColor}20` : '#dbeafe' }}
                >
                  <SvgIcon iconId={getIconForNode(targetNode)} size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-blue-500 uppercase font-medium tracking-wide">{typeLabels[targetNode.type]}</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{targetNode.name}</p>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              {getResultDescription(sourceNode, targetNode)}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Moving...
                </>
              ) : (
                'Confirm'
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default DragDropConfirmModal;
