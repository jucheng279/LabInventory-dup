import { supabase } from '../lib/supabase';
import type {
  InventoryItemTypeRecord,
  CreateInventoryItemTypeData,
  UpdateInventoryItemTypeData,
} from '../types/database';

export const inventoryItemTypeService = {
  async getAll(): Promise<InventoryItemTypeRecord[]> {
    const { data, error } = await supabase
      .from('inventory_item_types')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      if (error.code === '42P01') return [];
      throw error;
    }
    return data || [];
  },

  async create(input: CreateInventoryItemTypeData): Promise<InventoryItemTypeRecord> {
    const { data: existing } = await supabase
      .from('inventory_item_types')
      .select('display_order')
      .eq('workspace_id', input.workspace_id)
      .order('display_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;

    const { data, error } = await supabase
      .from('inventory_item_types')
      .insert({ ...input, display_order: nextOrder })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, input: UpdateInventoryItemTypeData): Promise<InventoryItemTypeRecord> {
    const { data, error } = await supabase
      .from('inventory_item_types')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('inventory_item_types')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async reorder(workspaceId: string, typeIds: string[]): Promise<void> {
    const updates = typeIds.map((id, index) => ({
      id,
      workspace_id: workspaceId,
      display_order: index,
    }));

    const { error } = await supabase
      .from('inventory_item_types')
      .upsert(updates, { onConflict: 'id' });

    if (error) throw error;
  },

  async assignItemType(itemId: string, typeId: string | null): Promise<void> {
    const { error } = await supabase
      .from('inventory_items')
      .update({ item_type_id: typeId, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (error) throw error;
  },
};
