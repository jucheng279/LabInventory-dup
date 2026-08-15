import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Portal from './Portal';
import IconHubModal from './IconHubModal';
import SvgIcon from './SvgIcon';

interface ItemTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, iconId: string) => void;
  isSaving?: boolean;
  initialName?: string;
  initialIconId?: string;
  title: string;
}

const ItemTypeModal: React.FC<ItemTypeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  isSaving,
  initialName = '',
  initialIconId = '',
  title,
}) => {
  const [name, setName] = useState(initialName);
  const [iconId, setIconId] = useState(initialIconId);
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setIconId(initialIconId);
    }
  }, [isOpen, initialName, initialIconId]);

  if (!isOpen) return null;

  const canSave = name.trim().length > 0 && iconId.length > 0;

  const handleSave = () => {
    if (!canSave || isSaving) return;
    onSave(name.trim(), iconId);
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Antibodies, Plasmids..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Icon</label>
              <button
                onClick={() => setShowIconPicker(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all"
              >
                {iconId ? (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <SvgIcon iconId={iconId} size={20} tintColor="#3b82f6" />
                    </div>
                    <span className="text-sm text-gray-700 flex-1 text-left truncate">
                      {iconId.split('/').pop()?.replace('.svg', '') || iconId}
                    </span>
                    <span className="text-xs text-blue-500 font-medium">Change</span>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                      <span className="text-gray-400 text-lg">?</span>
                    </div>
                    <span className="text-sm text-gray-400 flex-1 text-left">Choose an icon...</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <IconHubModal
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelect={(id) => {
          setIconId(id);
          setShowIconPicker(false);
        }}
        selectedIconId={iconId || null}
      />
    </Portal>
  );
};

export default ItemTypeModal;
