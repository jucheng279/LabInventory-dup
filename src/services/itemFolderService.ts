import { supabase } from '../lib/supabase';
import type { ItemSheet, ItemSheetWithStats, CreateItemSheetData, UpdateItemSheetData } from '../types/database';

export type { ItemSheet, ItemSheetWithStats, CreateItemSheetData, UpdateItemSheetData } from '../types/database';
export type { ItemFolder, ItemFolderWithStats, CreateItemFolderData, UpdateItemFolderData } from '../types/database';

export const itemSheetService = {
  async getAllSheets(locationId: string): Promise<ItemSheet[]> {
    const { data, error } = await supabase
      .from('item_folders')
      .select('*')
      .eq('location_id', locationId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching item sheets:', error);
      throw error;
    }

    return data || [];
  },

  async getSheetsWithStats(locationId: string): Promise<ItemSheetWithStats[]> {
    const { data: sheets, error: sheetsError } = await supabase
      .from('item_folders')
      .select('*')
      .eq('location_id', locationId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (sheetsError) {
      console.error('Error fetching item sheets:', sheetsError);
      throw sheetsError;
    }

    if (!sheets || sheets.length === 0) return [];

    const sheetIds = sheets.map((s) => s.id);
    const { data: counts, error: countsError } = await supabase
      .from('inventory_items')
      .select('folder_id')
      .in('folder_id', sheetIds);

    if (countsError) {
      console.error('Error fetching item counts:', countsError);
      throw countsError;
    }

    const countMap: Record<string, number> = {};
    (counts || []).forEach((row) => {
      countMap[row.folder_id] = (countMap[row.folder_id] || 0) + 1;
    });

    return sheets.map((sheet) => ({
      ...sheet,
      item_count: countMap[sheet.id] || 0,
    }));
  },

  async getSheetById(sheetId: string): Promise<ItemSheet | null> {
    const { data, error } = await supabase
      .from('item_folders')
      .select('*')
      .eq('id', sheetId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching item sheet:', error);
      throw error;
    }

    return data;
  },

  async createSheet(sheetData: CreateItemSheetData): Promise<ItemSheet> {
    const { data, error } = await supabase
      .from('item_folders')
      .insert({
        location_id: sheetData.location_id,
        sublocation_id: sheetData.sublocation_id || null,
        position_id: sheetData.position_id || null,
        name: sheetData.name,
        description: sheetData.description || '',
        accent_color: sheetData.accent_color || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating item sheet:', error);
      throw error;
    }

    return data;
  },

  async updateSheet(sheetId: string, sheetData: UpdateItemSheetData): Promise<ItemSheet> {
    const { data, error } = await supabase
      .from('item_folders')
      .update({
        ...sheetData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sheetId)
      .select()
      .single();

    if (error) {
      console.error('Error updating item sheet:', error);
      throw error;
    }

    return data;
  },

  async deleteSheet(sheetId: string): Promise<void> {
    const { error } = await supabase
      .from('item_folders')
      .delete()
      .eq('id', sheetId);

    if (error) {
      console.error('Error deleting item sheet:', error);
      throw error;
    }
  },

  async moveSheet(
    sheetId: string,
    targetLocationId: string,
    targetSublocationId?: string | null,
    targetPositionId?: string | null,
  ): Promise<ItemSheet> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('item_folders')
      .update({
        location_id: targetLocationId,
        sublocation_id: targetSublocationId ?? null,
        position_id: targetPositionId ?? null,
        updated_at: now,
      })
      .eq('id', sheetId)
      .select()
      .single();

    if (error) {
      console.error('Error moving item sheet:', error);
      throw error;
    }

    const { error: itemsError } = await supabase
      .from('inventory_items')
      .update({
        location_id: targetLocationId,
        sublocation_id: targetSublocationId ?? null,
        position_id: targetPositionId ?? null,
        updated_at: now,
      })
      .eq('folder_id', sheetId);

    if (itemsError) {
      console.error('Error moving sheet items:', itemsError);
      throw itemsError;
    }

    return data;
  },

  async reorderSheets(_locationId: string, sheetIds: string[]): Promise<void> {
    const results = await Promise.all(
      sheetIds.map((id, index) =>
        supabase
          .from('item_folders')
          .update({ display_order: index })
          .eq('id', id)
      )
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error('Error reordering sheets:', failed.error);
      throw failed.error;
    }
  },
};

export const itemFolderService = {
  getAllFolders: itemSheetService.getAllSheets,
  getFoldersWithStats: itemSheetService.getSheetsWithStats,
  getFolderById: itemSheetService.getSheetById,
  createFolder: itemSheetService.createSheet,
  updateFolder: itemSheetService.updateSheet,
  deleteFolder: itemSheetService.deleteSheet,
  findOrCreateGeneralFolder: async (locationId: string, sublocationId?: string | null, positionId?: string | null) => {
    let query = supabase
      .from('item_folders')
      .select('*')
      .eq('location_id', locationId);

    if (sublocationId) {
      query = query.eq('sublocation_id', sublocationId);
    } else {
      query = query.is('sublocation_id', null);
    }

    if (positionId) {
      query = query.eq('position_id', positionId);
    } else {
      query = query.is('position_id', null);
    }

    const { data: existing, error: findError } = await query
      .order('display_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error('Error finding general folder:', findError);
      throw findError;
    }

    if (existing) return existing;

    const { data: created, error: createError } = await supabase
      .from('item_folders')
      .insert({
        location_id: locationId,
        sublocation_id: sublocationId || null,
        position_id: positionId || null,
        name: 'General',
        description: '',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating general folder:', createError);
      throw createError;
    }

    return created;
  },
  moveFolder: itemSheetService.moveSheet,
  reorderFolders: itemSheetService.reorderSheets,
};
