import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronDown, FolderKanban } from 'lucide-react';
import Portal from './Portal';
import SvgIcon from './SvgIcon';
import { useProjects } from '../hooks/useProjectData';
import { useExperiments } from '../hooks/useExperimentData';
import { useBatchProjectAccess, canEditProject } from '../hooks/useProjectPrivacy';
import type { ProjectWithStats } from '../types/database';

interface AddToProjectModalProps {
  itemType: 'box' | 'item';
  itemName: string;
  onClose: () => void;
  onConfirm: (projectId: string, experimentId: string | null) => void;
}

const ProjectExperimentTree: React.FC<{
  project: ProjectWithStats;
  selectedProjectId: string | null;
  selectedExperimentId: string | null;
  onSelectProject: (id: string) => void;
  onSelectExperiment: (projectId: string, expId: string) => void;
}> = ({ project, selectedProjectId, selectedExperimentId, onSelectProject, onSelectExperiment }) => {
  const [expanded, setExpanded] = useState(false);
  const { data: experiments = [] } = useExperiments(expanded ? project.id : null);

  const isProjectSelected = selectedProjectId === project.id && !selectedExperimentId;
  const color = project.accent_color || '#3b82f6';

  return (
    <div>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ${isProjectSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="p-0.5 hover:bg-gray-200 rounded transition-colors"
        >
          {expanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
        </button>
        <div
          className="flex items-center gap-2 flex-1 min-w-0"
          onClick={() => onSelectProject(project.id)}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
            <SvgIcon iconId={project.icon_id || 'folder1'} size={16} color={color} />
          </div>
          <span className="text-sm font-medium text-gray-800 truncate">{project.name}</span>
        </div>
        {isProjectSelected && <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />}
      </div>

      {expanded && experiments.length > 0 && (
        <div className="ml-7 mt-0.5 space-y-0.5">
          {experiments.map(exp => {
            const isExpSelected = selectedExperimentId === exp.id;
            const expColor = exp.accent_color || '#0ea5e9';
            return (
              <div
                key={exp.id}
                onClick={() => onSelectExperiment(project.id, exp.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${isExpSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}
              >
                <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${expColor}15` }}>
                  <SvgIcon iconId={exp.icon_id || 'folder1'} size={12} color={expColor} />
                </div>
                <span className="text-xs text-gray-700 truncate">{exp.name}</span>
                {isExpSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 ml-auto" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AddToProjectModal: React.FC<AddToProjectModalProps> = ({ itemType, itemName, onClose, onConfirm }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: projects = [], isLoading } = useProjects();
  const projectIds = projects.map(p => p.id);
  const { data: accessMap = {} } = useBatchProjectAccess(projectIds);

  const editableProjects = projects.filter(p => canEditProject(accessMap[p.id]));

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleConfirm = async () => {
    if (!selectedProjectId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm(selectedProjectId, selectedExperimentId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <FolderKanban size={18} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add to Project</h2>
                <p className="text-xs text-gray-500 truncate max-w-[200px]">{itemType === 'box' ? 'Box' : 'Item'}: {itemName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X size={18} className="text-gray-400" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : editableProjects.length === 0 ? (
              <div className="text-center py-8">
                <FolderKanban size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No projects available</p>
                <p className="text-xs text-gray-400 mt-1">Create a project first</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 mb-3">Select a project or experiment</p>
                {editableProjects.map(project => (
                  <ProjectExperimentTree
                    key={project.id}
                    project={project}
                    selectedProjectId={selectedProjectId}
                    selectedExperimentId={selectedExperimentId}
                    onSelectProject={(id) => { setSelectedProjectId(id); setSelectedExperimentId(null); }}
                    onSelectExperiment={(pId, eId) => { setSelectedProjectId(pId); setSelectedExperimentId(eId); }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleConfirm} disabled={!selectedProjectId || isSubmitting} className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {isSubmitting ? 'Adding...' : 'Add to Project'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default AddToProjectModal;
