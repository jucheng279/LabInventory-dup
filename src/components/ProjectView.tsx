import React, { useState } from 'react';
import { Menu, ChevronRight, FlaskConical, MoveVertical as MoreVertical, Trash2, ArrowRightLeft, Package, Pencil } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import SvgIcon from './SvgIcon';
import DnaLoader from './DnaLoader';
import LocationCard from './LocationCard';
import BoxCard from './BoxCard';
import ItemCard from './ItemCard';
import Toast from './Toast';
import CreateExperimentModal from './CreateExperimentModal';
import EditExperimentModal from './EditExperimentModal';
import DeleteExperimentModal from './DeleteExperimentModal';
import MoveWithinProjectModal from './MoveWithinProjectModal';
import EditItemModal from './EditItemModal';
import ItemDetailModal from './ItemDetailModal';
import EditBoxModal from './EditBoxModal';
import DeleteItemModal from './DeleteItemModal';
import Portal from './Portal';
import { useExperiments, useCreateExperiment, useUpdateExperiment, useDeleteExperiment } from '../hooks/useExperimentData';
import { useProjectBoxLinks, useProjectItemLinks, useRemoveBoxFromProject, useRemoveItemFromProject, useMoveBoxLink, useMoveItemLink } from '../hooks/useProjectLinks';
import { useProjectAccess, canEditProject } from '../hooks/useProjectPrivacy';
import { useAuth } from '../contexts/AuthContext';
import { itemService } from '../services/itemService';
import { boxService } from '../services/boxService';
import type { Project, ExperimentWithStats } from '../types/database';
import type { InventoryItem } from '../services/itemService';
import type { LocationBoxWithStats } from '../services/boxService';
import type { BoxType } from '../types/database';
import type { ProjectBoxLinkWithBox, ProjectItemLinkWithItem } from '../services/projectLinkService';

interface ProjectViewProps {
  project: Project;
  experimentId: string | null;
  experimentName: string | null;
  onOpenBox: (boxId: string, boxName: string, boxAccentColor?: string | null, boxType?: BoxType) => void;
  onMobileMenuToggle: () => void;
  onSelectExperiment: (experiment: ExperimentWithStats) => void;
  onClearExperiment: () => void;
  onEditProject: () => void;
  onDeleteProject: () => void;
}

interface ToastState { message: string; type: 'success' | 'error'; }

const ProjectView: React.FC<ProjectViewProps> = ({
  project,
  experimentId,
  experimentName,
  onOpenBox,
  onMobileMenuToggle,
  onSelectExperiment,
  onClearExperiment,
  onEditProject,
  onDeleteProject,
}) => {
  const { teamMember } = useAuth();
  const { data: accessLevel } = useProjectAccess(project.id);
  const canEdit = canEditProject(accessLevel);

  const { data: experiments = [], isLoading: isExperimentsLoading } = useExperiments(project.id);
  const { data: boxLinks = [], isLoading: isBoxLinksLoading } = useProjectBoxLinks(project.id, experimentId);
  const { data: itemLinks = [], isLoading: isItemLinksLoading } = useProjectItemLinks(project.id, experimentId);

  const createExperimentMutation = useCreateExperiment(project.id);
  const updateExperimentMutation = useUpdateExperiment(project.id);
  const deleteExperimentMutation = useDeleteExperiment(project.id);
  const removeBoxMutation = useRemoveBoxFromProject();
  const removeItemMutation = useRemoveItemFromProject();
  const moveBoxLinkMutation = useMoveBoxLink();
  const moveItemLinkMutation = useMoveItemLink();

  const [showCreateExperiment, setShowCreateExperiment] = useState(false);
  const [editingExperiment, setEditingExperiment] = useState<ExperimentWithStats | null>(null);
  const [deletingExperiment, setDeletingExperiment] = useState<ExperimentWithStats | null>(null);
  const [movingBoxLink, setMovingBoxLink] = useState<ProjectBoxLinkWithBox | null>(null);
  const [movingItemLink, setMovingItemLink] = useState<ProjectItemLinkWithItem | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [editingBox, setEditingBox] = useState<LocationBoxWithStats | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [contextMenu, setContextMenu] = useState<{ type: 'box' | 'item'; link: any; pos: { top: number; right: number } } | null>(null);

  const queryClient = useQueryClient();

  const adjustStockMutation = useMutation({
    mutationFn: ({ itemId, delta }: { itemId: string; delta: number }) =>
      itemService.adjustStock(itemId, delta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-item-links'] });
    },
  });

  const adjustFreezeThawMutation = useMutation({
    mutationFn: ({ itemId, delta }: { itemId: string; delta: number }) =>
      itemService.adjustFreezeThawCycles(itemId, delta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-item-links'] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => itemService.deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-item-links'] });
      setDeletingItem(null);
      setToast({ message: 'Item deleted', type: 'success' });
    },
  });

  const projectColor = project.accent_color || '#3b82f6';
  const isLoading = isExperimentsLoading || isBoxLinksLoading || isItemLinksLoading;

  const handleCreateExperiment = async (data: { name: string; icon_id: string | null; accent_color: string | null }) => {
    try {
      await createExperimentMutation.mutateAsync(data);
      setShowCreateExperiment(false);
      setToast({ message: 'Experiment created', type: 'success' });
    } catch { setToast({ message: 'Failed to create experiment', type: 'error' }); }
  };

  const handleUpdateExperiment = async (data: { name: string; icon_id: string | null; accent_color: string | null }) => {
    if (!editingExperiment) return;
    try {
      await updateExperimentMutation.mutateAsync({ experimentId: editingExperiment.id, data });
      setEditingExperiment(null);
      setToast({ message: 'Experiment updated', type: 'success' });
    } catch { setToast({ message: 'Failed to update experiment', type: 'error' }); }
  };

  const handleDeleteExperiment = async () => {
    if (!deletingExperiment) return;
    try {
      await deleteExperimentMutation.mutateAsync(deletingExperiment.id);
      setDeletingExperiment(null);
      if (experimentId === deletingExperiment.id) onClearExperiment();
      setToast({ message: 'Experiment deleted', type: 'success' });
    } catch { setToast({ message: 'Failed to delete experiment', type: 'error' }); }
  };

  const handleRemoveBox = async (linkId: string) => {
    try {
      await removeBoxMutation.mutateAsync(linkId);
      setContextMenu(null);
      setToast({ message: 'Box removed from project', type: 'success' });
    } catch { setToast({ message: 'Failed to remove box', type: 'error' }); }
  };

  const handleRemoveItem = async (linkId: string) => {
    try {
      await removeItemMutation.mutateAsync(linkId);
      setContextMenu(null);
      setToast({ message: 'Item removed from project', type: 'success' });
    } catch { setToast({ message: 'Failed to remove item', type: 'error' }); }
  };

  const handleMoveBoxLink = async (targetExpId: string | null) => {
    if (!movingBoxLink) return;
    try {
      await moveBoxLinkMutation.mutateAsync({ linkId: movingBoxLink.id, targetProjectId: project.id, targetExperimentId: targetExpId });
      setMovingBoxLink(null);
      setToast({ message: 'Box moved', type: 'success' });
    } catch { setToast({ message: 'Failed to move box', type: 'error' }); }
  };

  const handleMoveItemLink = async (targetExpId: string | null) => {
    if (!movingItemLink) return;
    try {
      await moveItemLinkMutation.mutateAsync({ linkId: movingItemLink.id, targetProjectId: project.id, targetExperimentId: targetExpId });
      setMovingItemLink(null);
      setToast({ message: 'Item moved', type: 'success' });
    } catch { setToast({ message: 'Failed to move item', type: 'error' }); }
  };

  const handleAdjustStock = async (itemId: string, delta: number) => {
    const item = itemLinks.find(l => l.item?.id === itemId)?.item;
    if (item?.non_counted) return;
    try {
      await adjustStockMutation.mutateAsync({ itemId, delta });
    } catch {
      setToast({ message: 'Failed to adjust stock', type: 'error' });
    }
  };

  const handleAdjustFreezeThaw = async (itemId: string, delta: number) => {
    const item = itemLinks.find(l => l.item?.id === itemId)?.item;
    if (item?.non_counted) return;
    try {
      await adjustFreezeThawMutation.mutateAsync({ itemId, delta });
    } catch {
      setToast({ message: 'Failed to adjust freeze-thaw', type: 'error' });
    }
  };

  const showExperimentCards = !experimentId && experiments.length > 0;

  const allCards: { type: 'box' | 'item'; link: ProjectBoxLinkWithBox | ProjectItemLinkWithItem; key: string }[] = [];
  boxLinks.forEach(l => allCards.push({ type: 'box', link: l, key: `box-${l.id}` }));
  itemLinks.forEach(l => allCards.push({ type: 'item', link: l, key: `item-${l.id}` }));
  allCards.sort((a, b) => a.link.display_order - b.link.display_order);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4">
          <button onClick={onMobileMenuToggle} className="lg:hidden p-2 hover:bg-gray-100 rounded-xl">
            <Menu size={20} className="text-gray-600" />
          </button>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${projectColor}15` }}>
              <SvgIcon iconId={project.icon_id || 'folder1'} size={18} color={projectColor} />
            </div>
            <button onClick={onClearExperiment} className="text-sm font-semibold text-gray-800 truncate hover:text-blue-600 transition-colors">
              {project.name}
            </button>
            {experimentId && experimentName && (
              <>
                <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-600 truncate">{experimentName}</span>
              </>
            )}
          </div>

          {canEdit && (
            <div className="flex items-center gap-1.5">
              {!experimentId && (
                <button onClick={() => setShowCreateExperiment(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors" title="Add Experiment">
                  <FlaskConical size={13} />
                  <span className="hidden sm:inline">Experiment</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><DnaLoader /></div>
        ) : (
          <div className="space-y-6">
            {/* Experiment cards (only at project root level) */}
            {showExperimentCards && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Experiments</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                  {experiments.map(exp => (
                    <LocationCard
                      key={exp.id}
                      id={exp.id}
                      name={exp.name}
                      iconId={exp.icon_id}
                      accentColor={exp.accent_color}
                      locationType="general"
                      boxCount={exp.box_count}
                      folderCount={exp.item_count}
                      onClick={() => onSelectExperiment(exp)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Mixed box and item cards */}
            {allCards.length > 0 ? (
              <div>
                {showExperimentCards && (
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Items & Boxes</h3>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                  {allCards.map(({ type, link, key }) => {
                    if (type === 'box') {
                      const boxLink = link as ProjectBoxLinkWithBox;
                      if (!boxLink.box) return null;
                      return (
                        <div key={key} className="relative group">
                          <BoxCard
                            box={boxLink.box}
                            onOpen={() => onOpenBox(boxLink.box!.id, boxLink.box!.name, boxLink.box!.accent_color, boxLink.box!.box_type as BoxType)}
                            onEdit={() => {}}
                            onDelete={() => {}}
                            accessLevel="open"
                          />
                          {canEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = (e.target as HTMLElement).getBoundingClientRect();
                                setContextMenu({ type: 'box', link: boxLink, pos: { top: rect.bottom + 4, right: window.innerWidth - rect.right } });
                              }}
                              className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                              <MoreVertical size={14} className="text-gray-500" />
                            </button>
                          )}
                        </div>
                      );
                    } else {
                      const itemLink = link as ProjectItemLinkWithItem;
                      if (!itemLink.item) return null;
                      return (
                        <div key={key} className="relative group">
                          <ItemCard
                            item={itemLink.item}
                            onAdjustStock={handleAdjustStock}
                            onEdit={setEditingItem}
                            onDelete={setDeletingItem}
                            onMove={() => {}}
                            onAdjustFreezeThaw={handleAdjustFreezeThaw}
                            onView={setViewingItem}
                          />
                          {canEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = (e.target as HTMLElement).getBoundingClientRect();
                                setContextMenu({ type: 'item', link: itemLink, pos: { top: rect.bottom + 4, right: window.innerWidth - rect.right } });
                              }}
                              className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                              <MoreVertical size={14} className="text-gray-500" />
                            </button>
                          )}
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            ) : !showExperimentCards && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <Package size={28} className="text-gray-300" />
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">No items yet</h3>
                <p className="text-xs text-gray-400 max-w-[240px]">
                  Add boxes or items from your inventory using the "Add to Project" option in their menu.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <Portal>
          <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)}>
            <div
              className="absolute bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-44 animate-scale-in"
              style={{ top: contextMenu.pos.top, right: contextMenu.pos.right }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  if (contextMenu.type === 'box') {
                    setEditingBox(contextMenu.link.box);
                  } else {
                    setEditingItem(contextMenu.link.item);
                  }
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                onClick={() => {
                  if (contextMenu.type === 'box') setMovingBoxLink(contextMenu.link);
                  else setMovingItemLink(contextMenu.link);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <ArrowRightLeft size={14} /> Move
              </button>
              <button
                onClick={() => {
                  if (contextMenu.type === 'box') handleRemoveBox(contextMenu.link.id);
                  else handleRemoveItem(contextMenu.link.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} /> Remove from project
              </button>
            </div>
          </div>
        </Portal>
      )}

      {/* Modals */}
      {showCreateExperiment && (
        <CreateExperimentModal projectId={project.id} projectName={project.name} onClose={() => setShowCreateExperiment(false)} onCreate={handleCreateExperiment} />
      )}
      {editingExperiment && (
        <EditExperimentModal experiment={editingExperiment} onClose={() => setEditingExperiment(null)} onSave={handleUpdateExperiment} />
      )}
      {deletingExperiment && (
        <DeleteExperimentModal experiment={deletingExperiment} onClose={() => setDeletingExperiment(null)} onDelete={handleDeleteExperiment} />
      )}
      {movingBoxLink && (
        <MoveWithinProjectModal
          projectId={project.id}
          projectName={project.name}
          currentExperimentId={movingBoxLink.experiment_id}
          itemType="box"
          itemName={movingBoxLink.box?.name || 'Box'}
          onClose={() => setMovingBoxLink(null)}
          onConfirm={handleMoveBoxLink}
        />
      )}
      {movingItemLink && (
        <MoveWithinProjectModal
          projectId={project.id}
          projectName={project.name}
          currentExperimentId={movingItemLink.experiment_id}
          itemType="item"
          itemName={movingItemLink.item?.name || 'Item'}
          onClose={() => setMovingItemLink(null)}
          onConfirm={handleMoveItemLink}
        />
      )}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onUpdate={async (itemId, data) => {
            await itemService.updateItem(itemId, data);
            queryClient.invalidateQueries({ queryKey: ['project-item-links'] });
            setEditingItem(null);
            setToast({ message: 'Item updated', type: 'success' });
          }}
        />
      )}
      {viewingItem && (
        <ItemDetailModal
          item={viewingItem}
          onClose={() => setViewingItem(null)}
          onUpdate={async (itemId, data) => {
            await itemService.updateItem(itemId, data);
            queryClient.invalidateQueries({ queryKey: ['project-item-links'] });
            setViewingItem(null);
            setToast({ message: 'Item updated', type: 'success' });
          }}
          onAdjustStock={handleAdjustStock}
          onAdjustFreezeThaw={handleAdjustFreezeThaw}
        />
      )}
      {editingBox && (
        <EditBoxModal
          box={editingBox}
          onClose={() => setEditingBox(null)}
          onUpdate={async (boxId, data) => {
            await boxService.updateBox(boxId, data);
            queryClient.invalidateQueries({ queryKey: ['project-box-links'] });
            setEditingBox(null);
            setToast({ message: 'Box updated', type: 'success' });
          }}
        />
      )}
      {deletingItem && (
        <DeleteItemModal
          item={deletingItem}
          onClose={() => setDeletingItem(null)}
          onDelete={(itemId) => deleteItemMutation.mutate(itemId)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ProjectView;
