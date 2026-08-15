import React from 'react';
import { X, Check, Tag } from 'lucide-react';
import Portal from './Portal';
import SvgIcon from './SvgIcon';
import type { InventoryItemTypeRecord } from '../types/database';

interface AssignItemTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemTypes: InventoryItemTypeRecord[];
  currentTypeId: string | null;
  onAssign: (typeId: string | null) => void;
  isAssigning?: boolean;
  itemName: string;
}

const AssignItemTypeModal: React.FC<AssignItemTypeModalProps> = ({
  isOpen,
  onClose,
  itemTypes,
  currentTypeId,
  onAssign,
  isAssigning,
  itemName,
}) => {
  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">Assign Item Type</h2>
              <p className="text-xs text-gray-500 truncate mt-0.5">{itemName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          <div className="py-2 max-h-64 overflow-y-auto">
            <button
              onClick={() => onAssign(null)}
              disabled={isAssigning}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                currentTypeId === null
                  ? 'bg-blue-50 text-blue-700'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Tag size={14} className="text-gray-400" />
              </div>
              <span className="text-sm font-medium flex-1">Unassigned</span>
              {currentTypeId === null && (
                <Check size={16} className="text-blue-500 flex-shrink-0" />
              )}
            </button>

            {itemTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => onAssign(type.id)}
                disabled={isAssigning}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                  currentTypeId === type.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <SvgIcon iconId={type.icon_id} size={16} tintColor="#3b82f6" />
                </div>
                <span className="text-sm font-medium flex-1 truncate">{type.name}</span>
                {currentTypeId === type.id && (
                  <Check size={16} className="text-blue-500 flex-shrink-0" />
                )}
              </button>
            ))}

            {itemTypes.length === 0 && (
              <div className="px-5 py-6 text-center">
                <p className="text-sm text-gray-500">No item types created yet.</p>
                <p className="text-xs text-gray-400 mt-1">Create one using the + button in the inventory list header.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default AssignItemTypeModal;
