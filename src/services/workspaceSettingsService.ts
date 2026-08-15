import { supabase } from '../lib/supabase';

export interface WorkspaceSettings {
  live_sync_enabled: boolean;
  auto_open_first_folder: boolean;
  auto_open_first_item_folder: boolean;
  colorful_icons_enabled: boolean;
  auto_expand_all_locations: boolean;
  hierarchical_navigation: boolean;
  rotate_wide_grid_mobile: boolean;
}

const SETTINGS_COLUMNS = 'live_sync_enabled, auto_open_first_folder, auto_open_first_item_folder, colorful_icons_enabled, auto_expand_all_locations, hierarchical_navigation, rotate_wide_grid_mobile';

export async function getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings> {
  const { data, error } = await supabase
    .from('workspaces')
    .select(SETTINGS_COLUMNS)
    .eq('id', workspaceId)
    .maybeSingle();

  if (error) throw error;

  return {
    live_sync_enabled: data?.live_sync_enabled ?? true,
    auto_open_first_folder: data?.auto_open_first_folder ?? false,
    auto_open_first_item_folder: data?.auto_open_first_item_folder ?? true,
    colorful_icons_enabled: data?.colorful_icons_enabled ?? true,
    auto_expand_all_locations: data?.auto_expand_all_locations ?? true,
    hierarchical_navigation: data?.hierarchical_navigation ?? true,
    rotate_wide_grid_mobile: data?.rotate_wide_grid_mobile ?? false,
  };
}

export async function updateWorkspaceSettings(
  workspaceId: string,
  settings: Partial<WorkspaceSettings>
): Promise<WorkspaceSettings> {
  const { data, error } = await supabase
    .from('workspaces')
    .update(settings)
    .eq('id', workspaceId)
    .select(SETTINGS_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}
