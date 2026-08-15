import React, { useEffect } from 'react';
import { X, AlertTriangle, Move, ClipboardPaste } from 'lucide-react';
import Portal from './Portal';

interface PasteConfirmModalProps {
  operation: 'paste' | 'swap';
  conflictCells: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

const PasteConfirmModal: React.FC<PasteConfirmModalProps> = ({
  operation,
  conflictCells,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  const isPaste = operation === 'paste';
  const Icon = isPaste ? ClipboardPaste : Move;
  const title = isPaste ? 'Overwrite Cells' : 'Move & Swap Cells';
  const actionLabel = isPaste ? 'Overwrite' : 'Move';

  const sortedCells = [...conflictCells].sort((a, b) => {
    const rowA = a[0], rowB = b[0];
    if (rowA !== rowB) return rowA.localeCompare(rowB);
    return parseInt(a.slice(1)) - parseInt(b.slice(1));
  });

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          onClick={onCancel}
        />

        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            </div>
            <button
              onClick={onCancel}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="p-5">
            <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl mb-4">
              <Icon size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                {isPaste ? (
                  <p>
                    The following wells already contain data and will be{' '}
                    <strong>overwritten</strong>:
                  </p>
                ) : (
                  <p>
                    The following wells contain data that will be{' '}
                    <strong>swapped</strong> back to the source positions:
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-5 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded-xl">
              {sortedCells.map(cellId => (
                <span
                  key={cellId}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-sm font-mono font-medium text-gray-700"
                >
                  {cellId}
                </span>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 px-4 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 px-4 rounded-xl font-medium text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 transition-all"
              >
                {actionLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default PasteConfirmModal;
