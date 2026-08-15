import { supabase } from '../lib/supabase';
import type { ItemType, InventoryItem, CreateItemData, UpdateItemData, DisplayMode } from '../types/database';

export type { ItemType, InventoryItem, CreateItemData, UpdateItemData, DisplayMode } from '../types/database';

export const ITEM_TYPES: ItemType[] = ['Antibody', 'Cell', 'Medium', 'Kits', 'Chemicals'];

export const itemService = {
  async getAllItems(locationId?: string): Promise<InventoryItem[]> {
    let query = supabase
      .from('inventory_items')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching inventory items:', error);
      throw error;
    }

    return data || [];
  },

  async getItemById(itemId: string): Promise<InventoryItem | null> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', itemId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching inventory item:', error);
      throw error;
    }

    return data;
  },

  async getItemsByFolder(folderId: string): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('folder_id', folderId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching items by folder:', error);
      throw error;
    }

    return data || [];
  },

  async getStandaloneItems(locationId: string, sublocationId?: string | null, positionId?: string | null): Promise<InventoryItem[]> {
    let query = supabase
      .from('inventory_items')
      .select('*')
      .eq('location_id', locationId)
      .is('folder_id', null)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

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

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching standalone items:', error);
      throw error;
    }

    return data || [];
  },

  async createItem(itemData: CreateItemData): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        location_id: itemData.location_id,
        sublocation_id: itemData.sublocation_id || null,
        position_id: itemData.position_id || null,
        folder_id: itemData.folder_id || null,
        name: itemData.name,
        note: itemData.note || '',
        stock_number: itemData.stock_number || 0,
        stock_threshold: itemData.stock_threshold ?? null,
        unit: itemData.unit || '',
        non_counted: itemData.non_counted || false,
        item_type: itemData.item_type,
        accent_color: itemData.accent_color || null,
        icon_id: itemData.icon_id || null,
        freeze_thaw_cycles: itemData.freeze_thaw_cycles || 0,
        display_mode: itemData.display_mode || 'stock',
        date: itemData.date || null,
        date_type: itemData.date_type || 'none',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating inventory item:', error);
      throw error;
    }

    return data;
  },

  async updateItem(itemId: string, itemData: UpdateItemData): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from('inventory_items')
      .update({
        ...itemData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Error updating inventory item:', error);
      throw error;
    }

    return data;
  },

  async adjustStock(itemId: string, delta: number): Promise<InventoryItem> {
    const { data, error } = await supabase
      .rpc('adjust_stock', { p_item_id: itemId, p_delta: delta });

    if (error) {
      console.error('Error adjusting stock:', error);
      throw error;
    }

    return data;
  },

  async adjustFreezeThawCycles(itemId: string, delta: number): Promise<InventoryItem> {
    const { data, error } = await supabase
      .rpc('adjust_freeze_thaw_cycles', { p_item_id: itemId, p_delta: delta });

    if (error) {
      console.error('Error adjusting freeze-thaw cycles:', error);
      throw error;
    }

    return data;
  },

  async deleteItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error deleting inventory item:', error);
      throw error;
    }
  },

  async moveItemToLocation(itemId: string, targetLocationId: string, targetSublocationId?: string | null, targetPositionId?: string | null, targetFolderId?: string | null): Promise<InventoryItem> {
    const updateData: Record<string, unknown> = {
      location_id: targetLocationId,
      sublocation_id: targetSublocationId ?? null,
      position_id: targetPositionId ?? null,
      updated_at: new Date().toISOString(),
    };

    if (targetFolderId) {
      updateData.folder_id = targetFolderId;
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Error moving inventory item:', error);
      throw error;
    }

    return data;
  },

  async reorderItems(_locationId: string, itemIds: string[]): Promise<void> {
    const results = await Promise.all(
      itemIds.map((id, index) =>
        supabase
          .from('inventory_items')
          .update({ display_order: index })
          .eq('id', id)
      )
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error('Error reordering items:', failed.error);
      throw failed.error;
    }
  },

  async moveItemToSublocation(itemId: string, sublocationId: string | null): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from('inventory_items')
      .update({
        sublocation_id: sublocationId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Error moving item to sublocation:', error);
      throw error;
    }

    return data;
  }
};
