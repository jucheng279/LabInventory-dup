import { supabase } from '../lib/supabase';
import type { Experiment, ExperimentWithStats, CreateExperimentData, UpdateExperimentData } from '../types/database';

export type { Experiment, ExperimentWithStats, CreateExperimentData, UpdateExperimentData };

export const experimentService = {
  async getExperimentsForProject(projectId: string): Promise<ExperimentWithStats[]> {
    const { data: experiments, error } = await supabase
      .from('experiments')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    if (!experiments || experiments.length === 0) return [];

    const experimentIds = experiments.map(e => e.id);

    const { data: boxLinks } = await supabase
      .from('project_box_links')
      .select('id, experiment_id')
      .in('experiment_id', experimentIds);

    const { data: itemLinks } = await supabase
      .from('project_item_links')
      .select('id, experiment_id')
      .in('experiment_id', experimentIds);

    return experiments.map(e => ({
      ...e,
      box_count: (boxLinks || []).filter(l => l.experiment_id === e.id).length,
      item_count: (itemLinks || []).filter(l => l.experiment_id === e.id).length,
    }));
  },

  async createExperiment(data: CreateExperimentData): Promise<Experiment> {
    const { data: existing } = await supabase
      .from('experiments')
      .select('display_order')
      .eq('project_id', data.project_id)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;

    const { data: experiment, error } = await supabase
      .from('experiments')
      .insert({ ...data, display_order: nextOrder })
      .select()
      .single();

    if (error) throw error;
    return experiment;
  },

  async updateExperiment(experimentId: string, data: UpdateExperimentData): Promise<Experiment> {
    const { data: experiment, error } = await supabase
      .from('experiments')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', experimentId)
      .select()
      .single();

    if (error) throw error;
    return experiment;
  },

  async deleteExperiment(experimentId: string): Promise<void> {
    const { error } = await supabase
      .from('experiments')
      .delete()
      .eq('id', experimentId);

    if (error) throw error;
  },

  async reorderExperiments(projectId: string, experimentIds: string[]): Promise<void> {
    const updates = experimentIds.map((id, index) => ({
      id,
      project_id: projectId,
      display_order: index,
    }));

    const { error } = await supabase
      .from('experiments')
      .upsert(updates, { onConflict: 'id' });

    if (error) throw error;
  },
};
