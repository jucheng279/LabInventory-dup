import React, { useEffect } from 'react';
import { X, Clock, Loader as Loader2 } from 'lucide-react';
import Portal from './Portal';
import { HistoryContent, UndoRedoButtons } from './ChangeHistory';
import { useBoxHistory } from '../hooks/useBoxData';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useAuth } from '../contexts/AuthContext';

interface SlideHistoryModalProps {
  boxId: string;
  boxName: string;
  accentColor: string;
  locationId?: string;
  onClose: () => void;
  readOnly?: boolean;
}

const SlideHistoryModal: React.FC<SlideHistoryModalProps> = ({
  boxId,
  boxName,
  accentColor,
  locationId,
  onClose,
  readOnly = false,
}) => {
  const { entries, isLoading, isLoadingMore, hasMore, loadMore } = useBoxHistory(boxId);
  const { teamMember } = useAuth();
  const { undo, redo, canUndoFromEntries, canRedoFromEntries, isUndoing, isRedoing, isReverting } = useUndoRedo(boxId, locationId);

  const canUndo = canUndoFromEntries(entries);
  const canRedo = canRedoFromEntries(entries);

  const handleUndoLatest = async () => {
    await undo();
  };

  const handleRedoLatest = async () => {
    await redo();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex items-center justify-between px-6 py-4 border-b border-gray-100"
            style={{ background: `linear-gradient(135deg, ${accentColor}08 0%, ${accentColor}14 100%)` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="p-2 rounded-xl flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}40 100%)` }}
              >
                <Clock className="h-5 w-5" style={{ color: accentColor }} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate">Change History</h2>
                <p className="text-xs text-gray-500 truncate">{boxName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!readOnly && (
                <UndoRedoButtons
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={handleUndoLatest}
                  onRedo={handleRedoLatest}
                  isUndoing={isUndoing}
                  isRedoing={isRedoing}
                  isReverting={isReverting}
                />
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
                aria-label="Close history"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-4 py-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
              </div>
            ) : (
              <HistoryContent
                entries={entries}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                loadMore={loadMore}
                scrollClassName="max-h-[60vh]"
                boxId={boxId}
                locationId={locationId}
                readOnly={readOnly}
              />
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default SlideHistoryModal;
