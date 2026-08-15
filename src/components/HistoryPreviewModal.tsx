import React from 'react';
import { X, Eye, RotateCcw } from 'lucide-react';
import LocationGrid from './LocationGrid';
import Portal from './Portal';
import type { CellData } from '../services/locationCellService';

interface HistoryPreviewModalProps {
  previewCellData: Record<string, CellData>;
  rows: number;
  columns: number;
  actionsCount: number;
  onClose: () => void;
  onRevert?: () => void;
}

const HistoryPreviewModal: React.FC<HistoryPreviewModalProps> = ({
  previewCellData,
  rows,
  columns,
  actionsCount,
  onClose,
  onRevert,
}) => {
  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50/50 to-sky-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-100">
                <Eye className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">State Preview</h2>
                <p className="text-xs text-gray-500">
                  {actionsCount} {actionsCount === 1 ? 'action' : 'actions'} would be undone
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onRevert && (
                <button
                  onClick={onRevert}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Revert
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="aspect-square max-h-[60vh] mx-auto">
              <LocationGrid
                selectedCells={new Set()}
                onCellSelection={() => {}}
                cellData={previewCellData}
                rows={rows}
                columns={columns}
              />
            </div>
          </div>

          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              This is a read-only preview of the box state after reverting
            </p>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default HistoryPreviewModal;
