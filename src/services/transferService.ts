import { supabase } from '../lib/supabase';

export const transferService = {
  async transferLocationToLocation(
    sourceLocationId: string,
    targetLocationId: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc('transfer_location_to_location', {
      p_source_location_id: sourceLocationId,
      p_target_location_id: targetLocationId,
    });
    if (error) {
      console.error('Error transferring location to location:', error);
      throw error;
    }
    return data as number;
  },

  async transferLocationToSublocation(
    sourceLocationId: string,
    targetSublocationId: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc('transfer_location_to_sublocation', {
      p_source_location_id: sourceLocationId,
      p_target_sublocation_id: targetSublocationId,
    });
    if (error) {
      console.error('Error transferring location to sublocation:', error);
      throw error;
    }
    return data as number;
  },

  async transferSublocationToLocation(
    sourceSublocationId: string,
    targetLocationId: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc('transfer_sublocation_to_location', {
      p_source_sublocation_id: sourceSublocationId,
      p_target_location_id: targetLocationId,
    });
    if (error) {
      console.error('Error transferring sublocation to location:', error);
      throw error;
    }
    return data as number;
  },

  async transferSublocationToSublocation(
    sourceSublocationId: string,
    targetSublocationId: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc('transfer_sublocation_to_sublocation', {
      p_source_sublocation_id: sourceSublocationId,
      p_target_sublocation_id: targetSublocationId,
    });
    if (error) {
      console.error('Error transferring sublocation to sublocation:', error);
      throw error;
    }
    return data as number;
  },

  async transferPositionToLocation(
    sourcePositionId: string,
    targetLocationId: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc('transfer_position_to_location', {
      p_source_position_id: sourcePositionId,
      p_target_location_id: targetLocationId,
    });
    if (error) {
      console.error('Error transferring position to location:', error);
      throw error;
    }
    return data as number;
  },

  async transferPositionToSublocation(
    sourcePositionId: string,
    targetSublocationId: string
  ): Promise<number> {
    const { data, error } = await supabase.rpc('transfer_position_to_sublocation', {
      p_source_position_id: sourcePositionId,
      p_target_sublocation_id: targetSublocationId,
    });
    if (error) {
      console.error('Error transferring position to sublocation:', error);
      throw error;
    }
    return data as number;
  },
};
