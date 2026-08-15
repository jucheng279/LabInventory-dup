import { supabase } from '../lib/supabase';
import type { ItemCustomValue, ItemCustomValuesMap } from '../types/database';

export type { ItemCustomValue, ItemCustomValuesMap } from '../types/database';

export const itemCustomValueService = {
  async getValuesByFolder(folderId: string): Promise<ItemCustomValuesMap> {
    const { data: items, error: itemsError } = await supabase
      .from('inventory_items')
      .select('id')
      .eq('folder_id', folderId);

    if (itemsError) {
      console.error('Error fetching folder items:', itemsError);
      throw itemsError;
    }

    if (!items || items.length === 0) return {};

    const itemIds = items.map((i) => i.id);
    const { data, error } = await supabase
      .from('item_custom_values')
      .select('*')
      .in('item_id', itemIds);

    if (error) {
      console.error('Error fetching item custom values:', error);
      throw error;
    }

    const map: ItemCustomValuesMap = {};
    (data || []).forEach((val: ItemCustomValue) => {
      if (!map[val.item_id]) map[val.item_id] = {};
      map[val.item_id][val.header_id] = val.value;
    });

    return map;
  },

  async getValuesByItem(itemId: string): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from('item_custom_values')
      .select('*')
      .eq('item_id', itemId);

    if (error) {
      console.error('Error fetching item custom values:', error);
      throw error;
    }

    const map: Record<string, string> = {};
    (data || []).forEach((val: ItemCustomValue) => {
      map[val.header_id] = val.value;
    });

    return map;
  },

  async upsertValues(itemId: string, values: { header_id: string; value: string }[]): Promise<void> {
    if (values.length === 0) return;

    const rows = values.map((v) => ({
      item_id: itemId,
      header_id: v.header_id,
      value: v.value,
    }));

    const { error } = await supabase
      .from('item_custom_values')
      .upsert(rows, { onConflict: 'item_id,header_id' });

    if (error) {
      console.error('Error upserting item custom values:', error);
      throw error;
    }
  },

  async deleteValuesByItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from('item_custom_values')
      .delete()
      .eq('item_id', itemId);

    if (error) {
      console.error('Error deleting item custom values:', error);
      throw error;
    }
  },
};
