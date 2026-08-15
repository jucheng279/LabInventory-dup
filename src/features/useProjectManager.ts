import { useState } from 'react';
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '../hooks/useProjectData';
import { useUpsertProjectPrivacy } from '../hooks/useProjectPrivacy';
import { useTeamMembers } from '../hooks/useTeam';
import type { ProjectWithStats, ExperimentWithStats } from '../types/database';
import { ViewState } from './types';

interface UseProjectManagerParams {
  setViewState: (vs: ViewState) => void;
  setMobileMenuOpen: (open: boolean) => void;
}

export function useProjectManager({ setViewState, setMobileMenuOpen }: UseProjectManagerParams) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [selectedExperimentName, setSelectedExperimentName] = useState<string | null>(null);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithStats | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectWithStats | null>(null);

  const { data: projects = [] } = useProjects();
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const upsertProjectPrivacyMutation = useUpsertProjectPrivacy();
  const { data: teamMembers = [] } = useTeamMembers();

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  const handleSelectProject = (project: ProjectWithStats) => {
    setSelectedProjectId(project.id);
    setSelectedExperimentId(null);
    setSelectedExperimentName(null);
    setViewState({ view: 'project' });
    setMobileMenuOpen(false);
  };

  const handleSelectExperiment = (project: ProjectWithStats, experiment: ExperimentWithStats) => {
    setSelectedProjectId(project.id);
    setSelectedExperimentId(experiment.id);
    setSelectedExperimentName(experiment.name);
    setViewState({ view: 'project' });
    setMobileMenuOpen(false);
  };

  const handleCreateProject = async (data: { name: string; icon_id: string | null; accent_color: string | null }) => {
    const newProject = await createProjectMutation.mutateAsync(data);
    setShowCreateProjectModal(false);
    setSelectedProjectId(newProject.id);
    setSelectedExperimentId(null);
    setSelectedExperimentName(null);
    setViewState({ view: 'project' });
  };

  const handleUpdateProject = async (data: { name: string; icon_id: string | null; accent_color: string | null }) => {
    if (!editingProject) return;
    await updateProjectMutation.mutateAsync({ projectId: editingProject.id, data });
    setEditingProject(null);
  };

  const handleDeleteProject = async () => {
    if (!deletingProject) return;
    await deleteProjectMutation.mutateAsync(deletingProject.id);
    if (selectedProjectId === deletingProject.id) {
      setSelectedProjectId(null);
      setSelectedExperimentId(null);
      setSelectedExperimentName(null);
      setViewState({ view: 'workspace' });
    }
    setDeletingProject(null);
  };

  return {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    selectedExperimentId,
    setSelectedExperimentId,
    selectedExperimentName,
    setSelectedExperimentName,
    showCreateProjectModal,
    setShowCreateProjectModal,
    editingProject,
    setEditingProject,
    deletingProject,
    setDeletingProject,
    selectedProject,
    teamMembers,
    handleSelectProject,
    handleSelectExperiment,
    handleCreateProject,
    handleUpdateProject,
    handleDeleteProject,
  };
}
