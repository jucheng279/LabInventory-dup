import { supabase } from '../lib/supabase';

export interface WorkspaceOverviewStats {
  location_count: number;
  sublocation_count: number;
  position_count: number;
  box_count: number;
  folder_count: number;
  item_count: number;
  expiring_soon_count: number;
  low_stock_count: number;
}

export const overviewService = {
  async getWorkspaceOverviewStats(): Promise<WorkspaceOverviewStats> {
    const { data, error } = await supabase.rpc('get_workspace_overview_stats');

    if (error) {
      console.error('Error fetching workspace overview stats:', error);
      throw error;
    }

    const defaults: WorkspaceOverviewStats = {
      location_count: 0,
      sublocation_count: 0,
      position_count: 0,
      box_count: 0,
      folder_count: 0,
      item_count: 0,
      expiring_soon_count: 0,
      low_stock_count: 0,
    };

    if (!data) return defaults;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return defaults;

    return {
      location_count: row.location_count ?? 0,
      sublocation_count: row.sublocation_count ?? 0,
      position_count: row.position_count ?? 0,
      box_count: row.box_count ?? 0,
      folder_count: row.folder_count ?? 0,
      item_count: row.item_count ?? 0,
      expiring_soon_count: row.expiring_soon_count ?? 0,
      low_stock_count: row.low_stock_count ?? 0,
    };
  },
};
