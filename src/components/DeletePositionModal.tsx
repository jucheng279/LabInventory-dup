import React, { useState } from 'react';
import { X, AlertTriangle, Package, FlaskConical } from 'lucide-react';
import { PositionWithStats } from '../services/positionService';
import { getLocationIconId } from '../config/locationTypes';
import SvgIcon from './SvgIcon';
import ModalFrame from './ModalFrame';

interface DeletePositionModalProps {
  position: PositionWithStats;
  onClose: () => void;
  onDelete: (positionId: string) => void;
}

const DeletePositionModal: React.FC<DeletePositionModalProps> = ({
  position,
  onClose,
  onDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(position.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasContents = position.box_count > 0 || position.item_count > 0;
  const accentColor = position.accent_color || '#6b7280';

  return (
    <ModalFrame onClose={onClose}>
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 rounded-xl">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Delete Position</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <SvgIcon iconId={position.icon_id || getLocationIconId(position.location_type)} size={18} color={accentColor} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{position.name}</p>
            {position.description && (
              <p className="text-sm text-gray-500 truncate">{position.description}</p>
            )}
          </div>
        </div>

        {hasContents && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  This position contains:
                </p>
                <div className="mt-2 flex items-center gap-4 text-sm text-amber-700">
                  {position.box_count > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Package size={14} />
                      {position.box_count} {position.box_count === 1 ? 'box' : 'boxes'}
                    </span>
                  )}
                  {position.item_count > 0 && (
                    <span className="flex items-center gap-1.5">
                      <FlaskConical size={14} />
                      {position.item_count} {position.item_count === 1 ? 'item' : 'items'}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-amber-700">
                  Deleting this position will permanently remove all boxes and items inside.
                </p>
              </div>
            </div>
          </div>
        )}

        {!hasContents && (
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this position? This action cannot be undone.
          </p>
        )}

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
            onClick={handleDelete}
            disabled={isDeleting}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${
              isDeleting
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/20'
            }`}
          >
            {isDeleting ? 'Deleting...' : 'Delete Position'}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
};

export default DeletePositionModal;
