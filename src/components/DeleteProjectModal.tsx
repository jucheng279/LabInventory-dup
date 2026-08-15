import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import ModalFrame from './ModalFrame';
import type { Project } from '../types/database';

interface DeleteProjectModalProps {
  project: Project;
  onClose: () => void;
  onDelete: () => void;
}

const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({ project, onClose, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalFrame onClose={onClose} maxWidth="max-w-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Delete Project</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
          <X size={18} className="text-gray-400" />
        </button>
      </div>

      <div className="px-6 py-5">
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <span className="font-semibold text-gray-900">"{project.name}"</span>? This will remove the project and all its experiments. Items and boxes in your inventory will not be affected.
        </p>
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
        <button onClick={handleDelete} disabled={isDeleting} className="px-5 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-sm disabled:opacity-50 transition-all">
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </ModalFrame>
  );
};

export default DeleteProjectModal;
