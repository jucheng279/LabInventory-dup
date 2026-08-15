import React, { useState, useEffect } from 'react';
import { X, Package, Layers, Grid3x3 } from 'lucide-react';
import { BoxType } from '../services/boxService';
import Portal from './Portal';

interface BoxTypeSelectionModalProps {
  onClose: () => void;
  onSelect: (type: BoxType) => void;
}

const BOX_TYPES: { type: BoxType; label: string; description: string; icon: typeof Package }[] = [
  {
    type: 'freezer',
    label: 'Freezer Box',
    description: 'Grid storage for tubes and vials',
    icon: Package,
  },
  {
    type: 'structured_freezer',
    label: 'Freezer Box (Structured)',
    description: 'Grid storage with header-based info',
    icon: Grid3x3,
  },
  {
    type: 'slide',
    label: 'Slide Box',
    description: 'Column-based storage for slides',
    icon: Layers,
  },
];

const BoxTypeSelectionModal: React.FC<BoxTypeSelectionModalProps> = ({ onClose, onSelect }) => {
  const [selected, setSelected] = useState<BoxType>('freezer');

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          onClick={onClose}
        />

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Choose Box Type</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            {BOX_TYPES.map((item) => {
              const Icon = item.icon;
              const isSelected = selected === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setSelected(item.type)}
                  data-tutorial-id={item.type === 'freezer' ? 'box-type-freezer' : item.type === 'slide' ? 'box-type-slide' : undefined}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 text-left ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/60'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      isSelected ? 'bg-blue-100' : 'bg-gray-100'
                    }`}
                  >
                    <Icon
                      size={20}
                      className={`transition-colors ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                      {item.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                      {item.description}
                    </p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      isSelected ? 'border-blue-500' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-5 pb-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSelect(selected)}
              data-tutorial-id="box-type-continue-btn"
              className="flex-1 py-2.5 px-4 rounded-xl font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md shadow-blue-500/20"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default BoxTypeSelectionModal;
