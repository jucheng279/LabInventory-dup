import { supabase } from '../lib/supabase';
import type { SavedSearchFilter, SlideHeaderInfo, ItemFolderHeaderInfo, FreezerHeaderInfo } from '../types/search';

interface RpcSavedFilterRow {
  id: string;
  workspace_id: string;
  team_member_id: string;
  filter_text: string;
  created_at: string;
}

function mapRow(row: RpcSavedFilterRow): SavedSearchFilter {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    teamMemberId: row.team_member_id,
    filterText: row.filter_text,
    createdAt: row.created_at,
  };
}

export const searchFilterService = {
  async getSavedFilters(workspaceId: string, teamMemberId: string): Promise<SavedSearchFilter[]> {
    const { data, error } = await supabase
      .from('saved_search_filters')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('team_member_id', teamMemberId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching saved filters:', error);
      return [];
    }

    return (data || []).map(mapRow);
  },

  async createFilter(workspaceId: string, teamMemberId: string, filterText: string): Promise<SavedSearchFilter | null> {
    const { data, error } = await supabase
      .from('saved_search_filters')
      .insert({ workspace_id: workspaceId, team_member_id: teamMemberId, filter_text: filterText })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating saved filter:', error);
      return null;
    }

    return data ? mapRow(data) : null;
  },

  async deleteFilter(filterId: string): Promise<boolean> {
    const { error } = await supabase
      .from('saved_search_filters')
      .delete()
      .eq('id', filterId);

    if (error) {
      console.error('Error deleting saved filter:', error);
      return false;
    }

    return true;
  },

  async getWorkspaceSlideHeaders(): Promise<SlideHeaderInfo[]> {
    const { data, error } = await supabase.rpc('get_workspace_slide_headers');

    if (error) {
      console.error('Error fetching workspace slide headers:', error);
      return [];
    }

    return (data || []).map((row: { header_text: string; header_type: string }) => ({
      headerText: row.header_text,
      headerType: row.header_type as SlideHeaderInfo['headerType'],
    }));
  },

  async getWorkspaceItemFolderHeaders(): Promise<ItemFolderHeaderInfo[]> {
    const { data, error } = await supabase.rpc('get_workspace_item_folder_headers');

    if (error) {
      console.error('Error fetching workspace item folder headers:', error);
      return [];
    }

    return (data || []).map((row: { header_text: string; header_type: string }) => ({
      headerText: row.header_text,
      headerType: row.header_type as ItemFolderHeaderInfo['headerType'],
    }));
  },

  async getWorkspaceItemFolderNames(): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_workspace_item_folder_names');

    if (error) {
      console.error('Error fetching workspace item folder names:', error);
      return [];
    }

    return (data || []).map((row: { folder_name: string }) => row.folder_name);
  },

  async getWorkspaceFreezerBoxHeaders(): Promise<FreezerHeaderInfo[]> {
    const { data, error } = await supabase.rpc('get_workspace_freezer_box_headers');

    if (error) {
      console.error('Error fetching workspace freezer box headers:', error);
      return [];
    }

    return (data || []).map((row: { header_text: string; header_type: string }) => ({
      headerText: row.header_text,
      headerType: row.header_type as FreezerHeaderInfo['headerType'],
    }));
  },
};
