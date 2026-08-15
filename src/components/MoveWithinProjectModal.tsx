import React, { useState, useEffect } from 'react';
import { X, FolderKanban } from 'lucide-react';
import Portal from './Portal';
import SvgIcon from './SvgIcon';
import { useExperiments } from '../hooks/useExperimentData';
import type { ExperimentWithStats } from '../types/database';

interface MoveWithinProjectModalProps {
  projectId: string;
  projectName: string;
  currentExperimentId: string | null;
  itemType: 'box' | 'item';
  itemName: string;
  onClose: () => void;
  onConfirm: (targetExperimentId: string | null) => void;
}

const MoveWithinProjectModal: React.FC<MoveWithinProjectModalProps> = ({
  projectId,
  projectName,
  currentExperimentId,
  itemType,
  itemName,
  onClose,
  onConfirm,
}) => {
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null | 'root'>('root');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: experiments = [] } = useExperiments(projectId);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    const target = selectedExperimentId === 'root' ? null : selectedExperimentId;
    if (target === currentExperimentId) return;
    setIsSubmitting(true);
    try {
      await onConfirm(target);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCurrentRoot = currentExperimentId === null;
  const canConfirm = selectedExperimentId !== (currentExperimentId ?? 'root');

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden animate-scale-in">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <FolderKanban size={18} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Move within Project</h2>
                <p className="text-xs text-gray-500 truncate max-w-[180px]">{itemName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X size={18} className="text-gray-400" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
            <div
              onClick={() => setSelectedExperimentId('root')}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${selectedExperimentId === 'root' ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'} ${isCurrentRoot ? 'opacity-50' : ''}`}
            >
              <FolderKanban size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-800">{projectName}</span>
              <span className="text-[10px] text-gray-400 ml-auto">Project root</span>
              {isCurrentRoot && <span className="text-[10px] text-blue-500 ml-1">Current</span>}
            </div>

            {experiments.map(exp => {
              const isCurrent = currentExperimentId === exp.id;
              const isSelected = selectedExperimentId === exp.id;
              const expColor = exp.accent_color || '#0ea5e9';
              return (
                <div
                  key={exp.id}
                  onClick={() => setSelectedExperimentId(exp.id)}
                  className={`flex items-center gap-2 px-3 py-2 ml-4 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'} ${isCurrent ? 'opacity-50' : ''}`}
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `${expColor}15` }}>
                    <SvgIcon iconId={exp.icon_id || 'folder1'} size={12} color={expColor} />
                  </div>
                  <span className="text-xs text-gray-700 truncate">{exp.name}</span>
                  {isCurrent && <span className="text-[10px] text-blue-500 ml-auto">Current</span>}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleConfirm} disabled={!canConfirm || isSubmitting} className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {isSubmitting ? 'Moving...' : 'Move'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default MoveWithinProjectModal;
