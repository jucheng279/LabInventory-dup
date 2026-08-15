import { getClient } from '../lib/supabase';
import type { BoxType, LocationBox, LocationBoxWithStats, CreateBoxData, UpdateBoxData } from '../types/database';
import { presetOptionService } from './presetOptionService';

export type { BoxType, LocationBox, LocationBoxWithStats, CreateBoxData, UpdateBoxData } from '../types/database';

export const boxService = {
  async getAllBoxes(locationId?: string): Promise<LocationBox[]> {
    let query = getClient()
      .from('boxes')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching fridge boxes:', error);
      throw error;
    }

    return data || [];
  },

  async getAllBoxesWithStats(locationId?: string): Promise<LocationBoxWithStats[]> {
    let query = getClient()
      .from('boxes_with_stats')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching boxes with stats:', error);
      throw error;
    }

    return (data || []).map(box => ({
      id: box.id,
      location_id: box.location_id,
      sublocation_id: box.sublocation_id || null,
      position_id: box.position_id || null,
      name: box.name,
      description: box.description,
      accent_color: box.accent_color,
      rows: box.rows,
      columns: box.columns,
      name_font_divisor: box.name_font_divisor ?? 10,
      info_font_divisor: box.info_font_divisor ?? 12,
      slide_font_divisor: box.slide_font_divisor ?? 10,
      constrain_grid_height: box.constrain_grid_height ?? true,
      box_type: box.box_type ?? 'freezer',
      display_order: box.display_order ?? 0,
      icon_id: box.icon_id || null,
      created_at: box.created_at,
      updated_at: box.updated_at,
      occupiedCells: Number(box.occupied_cells),
      totalCells: Number(box.total_cells),
      utilizationPercent: Number(box.utilization_percent),
    }));
  },

  async getBoxById(boxId: string): Promise<LocationBox | null> {
    const { data, error } = await getClient()
      .from('boxes')
      .select('*')
      .eq('id', boxId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching fridge box:', error);
      throw error;
    }

    return data;
  },

  async createBox(boxData: CreateBoxData): Promise<LocationBox> {
    const { data, error } = await getClient()
      .from('boxes')
      .insert({
        location_id: boxData.location_id,
        sublocation_id: boxData.sublocation_id || null,
        position_id: boxData.position_id || null,
        name: boxData.name,
        description: boxData.description || '',
        accent_color: boxData.accent_color || null,
        rows: boxData.rows || 8,
        columns: boxData.columns || 12,
        box_type: boxData.box_type || 'freezer',
        icon_id: boxData.icon_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating fridge box:', error);
      throw error;
    }

    return data;
  },

  async updateBox(boxId: string, boxData: UpdateBoxData): Promise<LocationBox> {
    const { data, error } = await getClient()
      .from('boxes')
      .update(boxData)
      .eq('id', boxId)
      .select()
      .single();

    if (error) {
      console.error('Error updating fridge box:', error);
      throw error;
    }

    return data;
  },

  async deleteBox(boxId: string): Promise<void> {
    const { error } = await getClient()
      .from('boxes')
      .delete()
      .eq('id', boxId);

    if (error) {
      console.error('Error deleting fridge box:', error);
      throw error;
    }
  },

  async moveBoxToLocation(boxId: string, targetLocationId: string, targetSublocationId?: string | null, targetPositionId?: string | null): Promise<LocationBox> {
    const { data, error } = await getClient()
      .from('boxes')
      .update({
        location_id: targetLocationId,
        sublocation_id: targetSublocationId ?? null,
        position_id: targetPositionId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', boxId)
      .select()
      .single();

    if (error) {
      console.error('Error moving fridge box:', error);
      throw error;
    }

    return data;
  },

  async reorderBoxes(_locationId: string, boxIds: string[]): Promise<void> {
    const results = await Promise.all(
      boxIds.map((id, index) =>
        getClient()
          .from('boxes')
          .update({ display_order: index })
          .eq('id', id)
      )
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error('Error reordering boxes:', failed.error);
      throw failed.error;
    }
  },

  async moveBoxToSublocation(boxId: string, sublocationId: string | null): Promise<FridgeBox> {
    const { data, error } = await getClient()
      .from('boxes')
      .update({
        sublocation_id: sublocationId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', boxId)
      .select()
      .single();

    if (error) {
      console.error('Error moving box to sublocation:', error);
      throw error;
    }

    return data;
  },

  async duplicateBox(sourceBoxId: string, withData: boolean): Promise<LocationBox> {
    const sourceBox = await this.getBoxById(sourceBoxId);
    if (!sourceBox) throw new Error('Source box not found');

    const newBox = await this.createBox({
      location_id: sourceBox.location_id,
      sublocation_id: sourceBox.sublocation_id,
      position_id: sourceBox.position_id,
      name: `${sourceBox.name} (Copy)`,
      description: sourceBox.description,
      accent_color: sourceBox.accent_color,
      rows: sourceBox.rows,
      columns: sourceBox.columns,
      box_type: sourceBox.box_type,
      icon_id: sourceBox.icon_id,
    });

    await getClient()
      .from('boxes')
      .update({
        name_font_divisor: sourceBox.name_font_divisor,
        info_font_divisor: sourceBox.info_font_divisor,
        slide_font_divisor: sourceBox.slide_font_divisor,
        constrain_grid_height: sourceBox.constrain_grid_height,
      })
      .eq('id', newBox.id);

    if (sourceBox.box_type === 'slide' || sourceBox.box_type === 'structured_freezer') {
      const { data: sourceHeaders } = await getClient()
        .from('slide_box_headers')
        .select('*')
        .eq('box_id', sourceBoxId)
        .order('display_order', { ascending: true });

      const headerIdMap: Record<string, string> = {};

      if (sourceHeaders && sourceHeaders.length > 0) {
        const newHeaderRows = sourceHeaders.map((h) => ({
          box_id: newBox.id,
          header_text: h.header_text,
          header_type: h.header_type,
          display_order: h.display_order,
        }));

        const { data: newHeaders } = await getClient()
          .from('slide_box_headers')
          .insert(newHeaderRows)
          .select();

        if (newHeaders) {
          for (let i = 0; i < sourceHeaders.length; i++) {
            headerIdMap[sourceHeaders[i].id] = newHeaders[i].id;
          }
          for (const srcHeader of sourceHeaders) {
            if (srcHeader.header_type === 'preset' && headerIdMap[srcHeader.id]) {
              await presetOptionService.duplicateOptions(srcHeader.id, headerIdMap[srcHeader.id], 'slide_box');
            }
          }
        }
      }

      if (withData) {
        await this.duplicateCellData(sourceBoxId, newBox.id, headerIdMap);
      }
    } else if (withData) {
      await this.duplicateCellData(sourceBoxId, newBox.id, {});
    }

    return newBox;
  },

  async duplicateCellData(
    sourceBoxId: string,
    newBoxId: string,
    headerIdMap: Record<string, string>
  ): Promise<void> {
    const { data: sourceCells } = await getClient()
      .from('cells')
      .select('*')
      .eq('box_id', sourceBoxId);

    if (!sourceCells || sourceCells.length === 0) return;

    const newCellRows = sourceCells.map((cell) => ({
      box_id: newBoxId,
      cell_id: cell.cell_id,
      name: cell.name,
      information: cell.information,
      date: cell.date,
      color: cell.color,
      is_crossed: cell.is_crossed,
      date_type: cell.date_type,
      slide_image_url: null,
    }));

    const { data: newCells } = await getClient()
      .from('cells')
      .insert(newCellRows)
      .select();

    if (!newCells || Object.keys(headerIdMap).length === 0) return;

    const oldCellIdToNewId: Record<string, string> = {};
    for (const oldCell of sourceCells) {
      const matched = newCells.find((nc) => nc.cell_id === oldCell.cell_id);
      if (matched) oldCellIdToNewId[oldCell.id] = matched.id;
    }

    const oldCellUuids = sourceCells.map((c) => c.id);

    const { data: sourceValues } = await getClient()
      .from('slide_cell_values')
      .select('*')
      .in('cell_id', oldCellUuids);

    if (!sourceValues || sourceValues.length === 0) return;

    const newValueRows = sourceValues
      .filter((v) => oldCellIdToNewId[v.cell_id] && headerIdMap[v.header_id])
      .map((v) => ({
        cell_id: oldCellIdToNewId[v.cell_id],
        header_id: headerIdMap[v.header_id],
        value: v.value,
      }));

    if (newValueRows.length > 0) {
      await getClient()
        .from('slide_cell_values')
        .insert(newValueRows);
    }
  },
};
