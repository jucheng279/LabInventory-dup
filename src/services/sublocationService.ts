import { supabase } from '../lib/supabase';
import type { Sublocation, SublocationWithStats, CreateSublocationData, UpdateSublocationData } from '../types/database';

export type { Sublocation, SublocationWithStats, CreateSublocationData, UpdateSublocationData } from '../types/database';

export const sublocationService = {
  async getAllSublocationsWithStats(): Promise<SublocationWithStats[]> {
    const { data, error } = await supabase
      .from('sublocations_with_stats')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching all sublocations:', error);
      throw error;
    }

    return (data || []).map(s => ({
      id: s.id,
      location_id: s.location_id,
      name: s.name,
      accent_color: s.accent_color,
      display_order: s.display_order,
      location_type: s.location_type || 'general',
      icon_id: s.icon_id || null,
      created_at: s.created_at,
      updated_at: s.updated_at,
      box_count: Number(s.box_count),
      item_count: Number(s.item_count),
    }));
  },

  async getSublocationsForLocation(locationId: string): Promise<SublocationWithStats[]> {
    const { data, error } = await supabase
      .from('sublocations_with_stats')
      .select('*')
      .eq('location_id', locationId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching sublocations:', error);
      throw error;
    }

    return (data || []).map(s => ({
      id: s.id,
      location_id: s.location_id,
      name: s.name,
      accent_color: s.accent_color,
      display_order: s.display_order,
      location_type: s.location_type || 'general',
      icon_id: s.icon_id || null,
      created_at: s.created_at,
      updated_at: s.updated_at,
      box_count: Number(s.box_count),
      item_count: Number(s.item_count),
    }));
  },

  async getSublocationById(sublocationId: string): Promise<Sublocation | null> {
    const { data, error } = await supabase
      .from('sublocations')
      .select('*')
      .eq('id', sublocationId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching sublocation:', error);
      throw error;
    }

    return data;
  },

  async createSublocation(data: CreateSublocationData): Promise<Sublocation> {
    const { data: maxOrderResult } = await supabase
      .from('sublocations')
      .select('display_order')
      .eq('location_id', data.location_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxOrderResult?.display_order ?? -1) + 1;

    const { data: newSublocation, error } = await supabase
      .from('sublocations')
      .insert({
        location_id: data.location_id,
        name: data.name,
        accent_color: data.accent_color || null,
        display_order: nextOrder,
        location_type: data.location_type || 'general',
        icon_id: data.icon_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating sublocation:', error);
      throw error;
    }

    return newSublocation;
  },

  async updateSublocation(sublocationId: string, data: UpdateSublocationData): Promise<Sublocation> {
    const { data: updated, error } = await supabase
      .from('sublocations')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sublocationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating sublocation:', error);
      throw error;
    }

    return updated;
  },

  async deleteSublocation(sublocationId: string): Promise<void> {
    const { error } = await supabase
      .from('sublocations')
      .delete()
      .eq('id', sublocationId);

    if (error) {
      console.error('Error deleting sublocation:', error);
      throw error;
    }
  },

  async reorderSublocations(locationId: string, sublocationIds: string[]): Promise<void> {
    const updates = sublocationIds.map((id, index) =>
      supabase
        .from('sublocations')
        .update({ display_order: index })
        .eq('id', id)
        .eq('location_id', locationId)
    );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error('Error reordering sublocations:', failed.error);
      throw failed.error;
    }
  },
};
