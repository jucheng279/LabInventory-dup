import React, { useState } from 'react';
import { X, AlertTriangle, Package, FlaskConical } from 'lucide-react';
import { LocationWithStats } from '../services/locationManagerService';
import { getLocationIconId } from '../config/locationTypes';
import SvgIcon from './SvgIcon';
import ModalFrame from './ModalFrame';

interface DeleteLocationModalProps {
  location: LocationWithStats;
  onClose: () => void;
  onDelete: (locationId: string) => void;
}

const DeleteLocationModal: React.FC<DeleteLocationModalProps> = ({ location, onClose, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const hasContent = location.boxCount > 0 || location.itemCount > 0;
  const requiresConfirmation = hasContent;
  const isConfirmed = !requiresConfirmation || confirmText.toLowerCase() === 'delete';

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    try {
      await onDelete(location.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalFrame onClose={onClose}>
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-100">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Delete Location</h2>
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
            style={{ backgroundColor: `${location.accent_color || '#3b82f6'}15` }}
          >
            <SvgIcon
              iconId={location.icon_id || getLocationIconId(location.location_type)}
              size={24}
              color={location.accent_color || '#3b82f6'}
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{location.name}</h3>
            {location.description && (
              <p className="text-sm text-gray-500">{location.description}</p>
            )}
          </div>
        </div>

        {hasContent ? (
          <>
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    This action cannot be undone
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    Deleting this location will permanently remove:
                  </p>
                </div>
              </div>

              <div className="mt-3 ml-8 space-y-2">
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <Package size={16} />
                  <span>
                    <strong>{location.boxCount}</strong> storage box{location.boxCount !== 1 ? 'es' : ''} and all their contents
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-red-700">
                  <FlaskConical size={16} />
                  <span>
                    <strong>{location.itemCount}</strong> inventory item{location.itemCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="confirmDelete" className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">delete</span> to confirm
              </label>
              <input
                type="text"
                id="confirmDelete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="delete"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                autoComplete="off"
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this location? This action cannot be undone.
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
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${
              !isConfirmed || isDeleting
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-md shadow-red-500/20'
            }`}
          >
            {isDeleting ? 'Deleting...' : 'Delete Location'}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
};

export default DeleteLocationModal;
