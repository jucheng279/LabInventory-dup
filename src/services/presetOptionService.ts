import { supabase } from '../lib/supabase';
import type { PresetOption } from '../types/database';

type HeaderSource = 'slide_box' | 'item_folder';

export interface PresetOptionInput {
  option_label: string;
  display_order: number;
}

export const presetOptionService = {
  async getOptionsForHeaders(headerIds: string[], source: HeaderSource): Promise<Record<string, PresetOption[]>> {
    if (headerIds.length === 0) return {};

    const { data, error } = await supabase
      .from('header_preset_options')
      .select('*')
      .in('header_id', headerIds)
      .eq('header_source', source)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching preset options:', error);
      throw error;
    }

    const map: Record<string, PresetOption[]> = {};
    for (const opt of data || []) {
      if (!map[opt.header_id]) map[opt.header_id] = [];
      map[opt.header_id].push(opt as PresetOption);
    }
    return map;
  },

  async replaceOptions(headerId: string, source: HeaderSource, options: PresetOptionInput[]): Promise<PresetOption[]> {
    const { error: delError } = await supabase
      .from('header_preset_options')
      .delete()
      .eq('header_id', headerId)
      .eq('header_source', source);

    if (delError) {
      console.error('Error deleting old preset options:', delError);
      throw delError;
    }

    if (options.length === 0) return [];

    const rows = options.map((o, i) => ({
      header_id: headerId,
      header_source: source,
      option_label: o.option_label,
      display_order: i,
    }));

    const { data, error } = await supabase
      .from('header_preset_options')
      .insert(rows)
      .select();

    if (error) {
      console.error('Error inserting preset options:', error);
      throw error;
    }

    return (data || []) as PresetOption[];
  },

  async deleteOptionsForHeaders(headerIds: string[], source: HeaderSource): Promise<void> {
    if (headerIds.length === 0) return;

    const { error } = await supabase
      .from('header_preset_options')
      .delete()
      .in('header_id', headerIds)
      .eq('header_source', source);

    if (error) {
      console.error('Error deleting preset options:', error);
      throw error;
    }
  },

  async duplicateOptions(sourceHeaderId: string, targetHeaderId: string, source: HeaderSource): Promise<void> {
    const { data: existing, error: fetchError } = await supabase
      .from('header_preset_options')
      .select('*')
      .eq('header_id', sourceHeaderId)
      .eq('header_source', source)
      .order('display_order', { ascending: true });

    if (fetchError) {
      console.error('Error fetching options for duplication:', fetchError);
      throw fetchError;
    }

    if (!existing || existing.length === 0) return;

    const rows = existing.map((o: PresetOption) => ({
      header_id: targetHeaderId,
      header_source: source,
      option_label: o.option_label,
      display_order: o.display_order,
    }));

    const { error } = await supabase
      .from('header_preset_options')
      .insert(rows);

    if (error) {
      console.error('Error duplicating preset options:', error);
      throw error;
    }
  },
};
