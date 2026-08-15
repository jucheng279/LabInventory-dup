import { supabase } from '../lib/supabase';
import type { ProjectBoxLink, ProjectItemLink } from '../types/database';
import type { LocationBoxWithStats } from './boxService';
import type { InventoryItem } from './itemService';

export type { ProjectBoxLink, ProjectItemLink };

export interface ProjectBoxLinkWithBox extends ProjectBoxLink {
  box: LocationBoxWithStats | null;
}

export interface ProjectItemLinkWithItem extends ProjectItemLink {
  item: InventoryItem | null;
}

function mapBoxWithStats(box: any): LocationBoxWithStats {
  return {
    id: box.id,
    location_id: box.location_id,
    sublocation_id: box.sublocation_id || null,
    position_id: box.position_id || null,
    name: box.name,
    description: box.description,
    accent_color: box.accent_color,
    rows: box.rows,
    columns: box.columns,
    name_font_divisor: box.name_font_divisor ?? 10,
    info_font_divisor: box.info_font_divisor ?? 12,
    slide_font_divisor: box.slide_font_divisor ?? 10,
    constrain_grid_height: box.constrain_grid_height ?? true,
    box_type: box.box_type ?? 'freezer',
    display_order: box.display_order ?? 0,
    icon_id: box.icon_id || null,
    created_at: box.created_at,
    updated_at: box.updated_at,
    occupiedCells: Number(box.occupied_cells) || 0,
    totalCells: Number(box.total_cells) || 0,
    utilizationPercent: Number(box.utilization_percent) || 0,
  };
}

export const projectLinkService = {
  async getProjectBoxLinks(projectId: string, experimentId?: string | null): Promise<ProjectBoxLinkWithBox[]> {
    let query = supabase
      .from('project_box_links')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true });

    if (experimentId) {
      query = query.eq('experiment_id', experimentId);
    } else if (experimentId === null) {
      query = query.is('experiment_id', null);
    }

    const { data: links, error } = await query;
    if (error) throw error;
    if (!links || links.length === 0) return [];

    const boxIds = links.map(l => l.box_id);
    const { data: boxes } = await supabase
      .from('boxes_with_stats')
      .select('*')
      .in('id', boxIds);

    return links.map(link => {
      const rawBox = (boxes || []).find(b => b.id === link.box_id);
      return { ...link, box: rawBox ? mapBoxWithStats(rawBox) : null };
    });
  },

  async getProjectItemLinks(projectId: string, experimentId?: string | null): Promise<ProjectItemLinkWithItem[]> {
    let query = supabase
      .from('project_item_links')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true });

    if (experimentId) {
      query = query.eq('experiment_id', experimentId);
    } else if (experimentId === null) {
      query = query.is('experiment_id', null);
    }

    const { data: links, error } = await query;
    if (error) throw error;
    if (!links || links.length === 0) return [];

    const itemIds = links.map(l => l.item_id);
    const { data: items } = await supabase
      .from('inventory_items')
      .select('*')
      .in('id', itemIds);

    return links.map(link => ({
      ...link,
      item: (items || []).find(i => i.id === link.item_id) || null,
    }));
  },

  async getAllLinksForProject(projectId: string): Promise<{ boxLinks: ProjectBoxLinkWithBox[]; itemLinks: ProjectItemLinkWithItem[] }> {
    const [boxLinks, itemLinks] = await Promise.all([
      this.getProjectBoxLinks(projectId),
      this.getProjectItemLinks(projectId),
    ]);
    return { boxLinks, itemLinks };
  },

  async addBoxToProject(projectId: string, experimentId: string | null, boxId: string): Promise<ProjectBoxLink> {
    const { data: existing } = await supabase
      .from('project_box_links')
      .select('display_order')
      .eq('project_id', projectId)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;

    const { data, error } = await supabase
      .from('project_box_links')
      .insert({
        project_id: projectId,
        experiment_id: experimentId,
        box_id: boxId,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async addItemToProject(projectId: string, experimentId: string | null, itemId: string): Promise<ProjectItemLink> {
    const { data: existing } = await supabase
      .from('project_item_links')
      .select('display_order')
      .eq('project_id', projectId)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;

    const { data, error } = await supabase
      .from('project_item_links')
      .insert({
        project_id: projectId,
        experiment_id: experimentId,
        item_id: itemId,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeBoxFromProject(linkId: string): Promise<void> {
    const { error } = await supabase
      .from('project_box_links')
      .delete()
      .eq('id', linkId);

    if (error) throw error;
  },

  async removeItemFromProject(linkId: string): Promise<void> {
    const { error } = await supabase
      .from('project_item_links')
      .delete()
      .eq('id', linkId);

    if (error) throw error;
  },

  async moveBoxLink(linkId: string, targetProjectId: string, targetExperimentId: string | null): Promise<void> {
    const { error } = await supabase
      .from('project_box_links')
      .update({ project_id: targetProjectId, experiment_id: targetExperimentId })
      .eq('id', linkId);

    if (error) throw error;
  },

  async moveItemLink(linkId: string, targetProjectId: string, targetExperimentId: string | null): Promise<void> {
    const { error } = await supabase
      .from('project_item_links')
      .update({ project_id: targetProjectId, experiment_id: targetExperimentId })
      .eq('id', linkId);

    if (error) throw error;
  },
};
