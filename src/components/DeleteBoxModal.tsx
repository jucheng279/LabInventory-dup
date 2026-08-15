import React, { useState } from 'react';
import { X, AlertTriangle, Package } from 'lucide-react';
import { LocationBoxWithStats } from '../services/boxService';
import ModalFrame from './ModalFrame';

interface DeleteBoxModalProps {
  box: LocationBoxWithStats;
  onClose: () => void;
  onDelete: (boxId: string) => void;
}

const DeleteBoxModal: React.FC<DeleteBoxModalProps> = ({ box, onClose, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await onDelete(box.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalFrame onClose={onClose}>
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-50">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Delete Box</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-4">
          <div
            className="p-2.5 rounded-xl"
            style={{ backgroundColor: `${box.accent_color || '#3b82f6'}15` }}
          >
            <Package size={24} style={{ color: box.accent_color || '#3b82f6' }} />
          </div>
          <div>
            <div className="font-medium text-gray-900">{box.name}</div>
            <div className="text-sm text-gray-500">
              {box.occupiedCells} cells with data
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm text-gray-600">
          <p>
            Are you sure you want to delete this box? This action cannot be undone.
          </p>
          {box.occupiedCells > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <p>
                <strong>{box.occupiedCells} cells</strong> containing reagent data will be permanently deleted along with this box.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${
              isDeleting
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20'
            }`}
          >
            {isDeleting ? 'Deleting...' : 'Delete Box'}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
};

export default DeleteBoxModal;
