import { getClient } from '../lib/supabase';
import type { Location, LocationWithStats, CreateLocationData, UpdateLocationData } from '../types/database';

export type { Location, LocationWithStats, CreateLocationData, UpdateLocationData } from '../types/database';

export const locationManagerService = {
  async getAllLocations(): Promise<Location[]> {
    const { data, error } = await getClient()
      .from('locations')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching locations:', error);
      throw error;
    }

    return data || [];
  },

  async getAllLocationsWithStats(): Promise<LocationWithStats[]> {
    const { data, error } = await getClient()
      .from('locations_with_stats')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching locations with stats:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      accent_color: row.accent_color,
      display_order: row.display_order,
      workspace_id: row.workspace_id,
      show_storage_boxes: row.show_storage_boxes ?? true,
      show_inventory_items: row.show_inventory_items ?? true,
      location_type: row.location_type || 'fridge',
      icon_id: row.icon_id || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      boxCount: Number(row.box_count),
      itemCount: Number(row.item_count),
    }));
  },

  async getLocationById(locationId: string): Promise<Location | null> {
    const { data, error } = await getClient()
      .from('locations')
      .select('*')
      .eq('id', locationId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching location:', error);
      throw error;
    }

    return data;
  },

  async createLocation(locationData: CreateLocationData): Promise<Location> {
    const { data: maxOrder } = await getClient()
      .from('locations')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxOrder?.display_order ?? -1) + 1;

    const { data, error } = await getClient()
      .from('locations')
      .insert({
        name: locationData.name,
        accent_color: locationData.accent_color || null,
        workspace_id: locationData.workspace_id,
        display_order: nextOrder,
        show_storage_boxes: locationData.show_storage_boxes ?? true,
        show_inventory_items: locationData.show_inventory_items ?? true,
        location_type: locationData.location_type || 'fridge',
        icon_id: locationData.icon_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating location:', error);
      throw error;
    }

    return data;
  },

  async updateLocation(locationId: string, locationData: UpdateLocationData): Promise<Location> {
    const { data, error } = await getClient()
      .from('locations')
      .update({
        ...locationData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', locationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating location:', error);
      throw error;
    }

    return data;
  },

  async deleteLocation(locationId: string): Promise<void> {
    const { error } = await getClient()
      .from('locations')
      .delete()
      .eq('id', locationId);

    if (error) {
      console.error('Error deleting location:', error);
      throw error;
    }
  },

  async updateLocationOrder(locationIds: string[]): Promise<void> {
    const now = new Date().toISOString();

    const results = await Promise.all(
      locationIds.map((id, index) =>
        getClient()
          .from('locations')
          .update({ display_order: index, updated_at: now })
          .eq('id', id)
      )
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error('Error updating location order:', failed.error);
      throw failed.error;
    }
  },

};
