import { supabase } from '../lib/supabase';
import type { Project, ProjectWithStats, CreateProjectData, UpdateProjectData } from '../types/database';

export type { Project, ProjectWithStats, CreateProjectData, UpdateProjectData };

export const projectService = {
  async getAllProjects(): Promise<ProjectWithStats[]> {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;
    if (!projects || projects.length === 0) return [];

    const projectIds = projects.map(p => p.id);

    const { data: experiments } = await supabase
      .from('experiments')
      .select('id, project_id')
      .in('project_id', projectIds);

    const { data: boxLinks } = await supabase
      .from('project_box_links')
      .select('id, project_id')
      .in('project_id', projectIds);

    const { data: itemLinks } = await supabase
      .from('project_item_links')
      .select('id, project_id')
      .in('project_id', projectIds);

    return projects.map(p => ({
      ...p,
      experiment_count: (experiments || []).filter(e => e.project_id === p.id).length,
      box_count: (boxLinks || []).filter(l => l.project_id === p.id).length,
      item_count: (itemLinks || []).filter(l => l.project_id === p.id).length,
    }));
  },

  async getProjectById(projectId: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createProject(data: CreateProjectData): Promise<Project> {
    const { data: existing } = await supabase
      .from('projects')
      .select('display_order')
      .eq('workspace_id', data.workspace_id)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;

    const { data: project, error } = await supabase
      .from('projects')
      .insert({ ...data, display_order: nextOrder })
      .select()
      .single();

    if (error) throw error;
    return project;
  },

  async updateProject(projectId: string, data: UpdateProjectData): Promise<Project> {
    const { data: project, error } = await supabase
      .from('projects')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    return project;
  },

  async deleteProject(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;
  },

  async reorderProjects(workspaceId: string, projectIds: string[]): Promise<void> {
    const updates = projectIds.map((id, index) => ({
      id,
      workspace_id: workspaceId,
      display_order: index,
    }));

    const { error } = await supabase
      .from('projects')
      .upsert(updates, { onConflict: 'id' });

    if (error) throw error;
  },
};
