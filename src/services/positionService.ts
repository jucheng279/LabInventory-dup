import { supabase } from '../lib/supabase';
import type { Position, PositionWithStats, CreatePositionData, UpdatePositionData } from '../types/database';

export type { Position, PositionWithStats, CreatePositionData, UpdatePositionData } from '../types/database';

export const positionService = {
  async getAllPositionsWithStats(): Promise<PositionWithStats[]> {
    const { data, error } = await supabase
      .from('positions_with_stats')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching all positions:', error);
      throw error;
    }

    return (data || []).map(p => ({
      id: p.id,
      sublocation_id: p.sublocation_id,
      name: p.name,
      accent_color: p.accent_color,
      display_order: p.display_order,
      location_type: p.location_type || 'general',
      icon_id: p.icon_id || null,
      created_at: p.created_at,
      updated_at: p.updated_at,
      box_count: Number(p.box_count),
      item_count: Number(p.item_count),
    }));
  },

  async getPositionsForSublocation(sublocationId: string): Promise<PositionWithStats[]> {
    const { data, error } = await supabase
      .from('positions_with_stats')
      .select('*')
      .eq('sublocation_id', sublocationId)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching positions:', error);
      throw error;
    }

    return (data || []).map(p => ({
      id: p.id,
      sublocation_id: p.sublocation_id,
      name: p.name,
      accent_color: p.accent_color,
      display_order: p.display_order,
      location_type: p.location_type || 'general',
      icon_id: p.icon_id || null,
      created_at: p.created_at,
      updated_at: p.updated_at,
      box_count: Number(p.box_count),
      item_count: Number(p.item_count),
    }));
  },

  async createPosition(data: CreatePositionData): Promise<Position> {
    const { data: maxOrderResult } = await supabase
      .from('sublocation_positions')
      .select('display_order')
      .eq('sublocation_id', data.sublocation_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxOrderResult?.display_order ?? -1) + 1;

    const { data: newPosition, error } = await supabase
      .from('sublocation_positions')
      .insert({
        sublocation_id: data.sublocation_id,
        name: data.name,
        accent_color: data.accent_color || null,
        display_order: nextOrder,
        location_type: data.location_type || 'general',
        icon_id: data.icon_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating position:', error);
      throw error;
    }

    return newPosition;
  },

  async updatePosition(positionId: string, data: UpdatePositionData): Promise<Position> {
    const { data: updated, error } = await supabase
      .from('sublocation_positions')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', positionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating position:', error);
      throw error;
    }

    return updated;
  },

  async deletePosition(positionId: string): Promise<void> {
    const { error } = await supabase
      .from('sublocation_positions')
      .delete()
      .eq('id', positionId);

    if (error) {
      console.error('Error deleting position:', error);
      throw error;
    }
  },

  async reorderPositions(sublocationId: string, positionIds: string[]): Promise<void> {
    const updates = positionIds.map((id, index) =>
      supabase
        .from('sublocation_positions')
        .update({ display_order: index })
        .eq('id', id)
        .eq('sublocation_id', sublocationId)
    );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error('Error reordering positions:', failed.error);
      throw failed.error;
    }
  },
};
