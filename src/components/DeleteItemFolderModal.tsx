import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { ItemFolderWithStats } from '../types/database';
import ModalFrame from './ModalFrame';

interface DeleteItemFolderModalProps {
  folder: ItemFolderWithStats;
  onClose: () => void;
  onDelete: (folderId: string) => void;
}

const DeleteItemFolderModal: React.FC<DeleteItemFolderModalProps> = ({ folder, onClose, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(folder.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalFrame onClose={onClose} maxWidth="max-w-sm">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-50">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Delete Sheet</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <span className="font-semibold text-gray-900">"{folder.name}"</span>?
        </p>

        {folder.item_count > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-sm text-red-700 font-medium">
              This will permanently delete {folder.item_count} {folder.item_count === 1 ? 'item' : 'items'} inside this sheet.
            </p>
          </div>
        )}

        <p className="text-xs text-gray-500">
          This action cannot be undone.
        </p>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${
              isDeleting
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20'
            }`}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
};

export default DeleteItemFolderModal;
