/**
 * Box-Item Link Service
 *
 * This service manages bidirectional links between freezer box grid cells
 * and inventory items. Two distinct linking frameworks exist:
 *
 * FRAMEWORK 1 — Normal Freezer Box <-> Standalone Item
 *   Cell fields: name, information (free-text), date, date_type
 *   Item fields: name, note, date, date_type
 *   linked_info stores the item's plain-text note.
 *   linked_date/linked_date_type store the item's date.
 *
 * FRAMEWORK 2 — Structured Freezer Box <-> Sheet Item (item in a folder with headers)
 *   Cell fields: name + custom column values (stored in slide_cell_values via headers)
 *   Item fields: name + custom column values (stored in item_custom_values via folder headers)
 *   linked_info stores a "|||"-separated fingerprint of column values (variant info).
 *   linked_date is always null; date is not used in this framework.
 *
 * These two frameworks CANNOT cross-link: a standalone item cannot link to a
 * structured box, and a sheet item cannot link to a normal freezer box. This is
 * enforced by the SelectItemForGridModal's "mode" prop.
 */
import { getClient } from '../lib/supabase';
import type { BoxGridItemLink, GridItemLinkType, SlideValuesMap } from '../types/database';

export const boxItemLinkService = {
  async getLinksForBox(boxId: string): Promise<BoxGridItemLink[]> {
    const { data, error } = await getClient()
      .from('box_grid_item_links')
      .select('*')
      .eq('box_id', boxId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getLinkForItem(itemId: string): Promise<BoxGridItemLink | null> {
    const { data, error } = await getClient()
      .from('box_grid_item_links')
      .select('*')
      .eq('item_id', itemId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getLinksForItems(itemIds: string[]): Promise<BoxGridItemLink[]> {
    if (itemIds.length === 0) return [];
    const { data, error } = await getClient()
      .from('box_grid_item_links')
      .select('*, boxes!box_id(name)')
      .in('item_id', itemIds);

    if (error) throw error;
    return (data || []).map((row: Record<string, unknown>) => {
      const { boxes, ...rest } = row;
      const boxData = boxes as { name: string } | null;
      return { ...rest, box_name: boxData?.name ?? undefined } as BoxGridItemLink;
    });
  },

  async createLink(
    boxId: string,
    itemId: string,
    linkType: GridItemLinkType,
    linkedName: string,
    linkedInfo: string | null,
    linkedDate: string | null = null,
    linkedDateType: string = 'none',
  ): Promise<BoxGridItemLink> {
    const { data, error } = await getClient()
      .from('box_grid_item_links')
      .insert({
        box_id: boxId,
        item_id: itemId,
        link_type: linkType,
        linked_name: linkedName,
        linked_info: linkedInfo,
        linked_date: linkedDate,
        linked_date_type: linkedDateType,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteLink(linkId: string): Promise<void> {
    const { error } = await getClient()
      .from('box_grid_item_links')
      .delete()
      .eq('id', linkId);

    if (error) throw error;
  },

  async updateLinkTracking(
    linkId: string,
    newName: string,
    newInfo: string | null,
    newDate: string | null = null,
    newDateType: string = 'none',
  ): Promise<void> {
    const { error } = await getClient()
      .from('box_grid_item_links')
      .update({
        linked_name: newName,
        linked_info: newInfo,
        linked_date: newDate,
        linked_date_type: newDateType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', linkId);

    if (error) throw error;
  },

  async syncStock(linkId: string): Promise<void> {
    const { error } = await getClient().rpc('sync_linked_item_stock', {
      p_link_id: linkId,
    });
    if (error) throw error;
  },

  async syncAllForBox(boxId: string): Promise<void> {
    const { error } = await getClient().rpc('sync_all_links_for_box', {
      p_box_id: boxId,
    });
    if (error) throw error;
  },

  async getFirstLinkedCellId(
    boxId: string,
    linkedName: string,
    linkedInfo: string | null,
    linkType: GridItemLinkType,
    linkedDate: string | null = null,
    linkedDateType: string = 'none',
  ): Promise<string | null> {
    let query = getClient()
      .from('cells')
      .select('cell_id')
      .eq('box_id', boxId)
      .eq('is_crossed', false);

    if (linkType === 'info') {
      query = query.eq('information', linkedInfo || '');
      query = query.eq('date', linkedDate || '');
      query = query.eq('date_type', linkedDateType);
    } else {
      query = query.eq('name', linkedName);
      if (linkType === 'name_info') {
        query = query.eq('information', linkedInfo || '');
        query = query.eq('date', linkedDate || '');
        query = query.eq('date_type', linkedDateType);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return null;

    data.sort((a, b) => {
      const parseCell = (cid: string) => {
        const row = cid.charCodeAt(0);
        const col = parseInt(cid.slice(1), 10);
        return { row, col };
      };
      const pa = parseCell(a.cell_id);
      const pb = parseCell(b.cell_id);
      if (pa.row !== pb.row) return pa.row - pb.row;
      return pa.col - pb.col;
    });

    return data[0].cell_id;
  },

  async getLinkedCellCount(
    boxId: string,
    linkedName: string,
    linkedInfo: string | null,
    linkType: GridItemLinkType,
    linkedDate: string | null = null,
    linkedDateType: string = 'none',
  ): Promise<number> {
    let query = getClient()
      .from('cells')
      .select('id', { count: 'exact', head: true })
      .eq('box_id', boxId)
      .eq('is_crossed', false);

    if (linkType === 'info') {
      query = query.eq('information', linkedInfo || '');
      query = query.eq('date', linkedDate || '');
      query = query.eq('date_type', linkedDateType);
    } else {
      query = query.eq('name', linkedName);
      if (linkType === 'name_info') {
        query = query.eq('information', linkedInfo || '');
        query = query.eq('date', linkedDate || '');
        query = query.eq('date_type', linkedDateType);
      }
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  },

  async crossLastLinkedCell(
    boxId: string,
    linkedName: string,
    linkedInfo: string | null,
    linkType: GridItemLinkType,
    linkedDate: string | null = null,
    linkedDateType: string = 'none',
  ): Promise<string | null> {
    let query = getClient()
      .from('cells')
      .select('id, cell_id')
      .eq('box_id', boxId)
      .eq('is_crossed', false);

    if (linkType === 'info') {
      query = query.eq('information', linkedInfo || '');
      query = query.eq('date', linkedDate || '');
      query = query.eq('date_type', linkedDateType);
    } else {
      query = query.eq('name', linkedName);
      if (linkType === 'name_info') {
        query = query.eq('information', linkedInfo || '');
        query = query.eq('date', linkedDate || '');
        query = query.eq('date_type', linkedDateType);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return null;

    // Sort by grid position in reverse order (last cell first)
    data.sort((a, b) => {
      const parseCell = (cid: string) => {
        const row = cid.charCodeAt(0);
        const col = parseInt(cid.slice(1), 10);
        return { row, col };
      };
      const pa = parseCell(a.cell_id);
      const pb = parseCell(b.cell_id);
      if (pb.row !== pa.row) return pb.row - pa.row;
      return pb.col - pa.col;
    });

    const lastCell = data[0];

    const { error: crossError } = await getClient()
      .from('cells')
      .update({ is_crossed: true, updated_at: new Date().toISOString() })
      .eq('id', lastCell.id);

    if (crossError) throw crossError;

    return lastCell.cell_id;
  },

  async updateLinkedCellNames(
    boxId: string,
    oldName: string,
    newName: string,
    oldInfo: string | null,
    newInfo: string | null,
    linkType: GridItemLinkType,
    oldDate: string | null = null,
    oldDateType: string = 'none',
    newDate: string | null = null,
    newDateType: string = 'none',
  ): Promise<void> {
    let query = getClient()
      .from('cells')
      .select('id')
      .eq('box_id', boxId)
      .eq('name', oldName);

    if (linkType === 'name_info') {
      query = query.eq('information', oldInfo || '');
      query = query.eq('date', oldDate || '');
      query = query.eq('date_type', oldDateType);
    }

    const { data: cells, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!cells || cells.length === 0) return;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (newName !== oldName) {
      updateData.name = newName;
    }
    if (linkType === 'name_info' && newInfo !== oldInfo) {
      updateData.information = newInfo || '';
    }
    if (linkType === 'name_info') {
      if (newDate !== oldDate) {
        updateData.date = newDate || '';
      }
      if (newDateType !== oldDateType) {
        updateData.date_type = newDateType;
      }
    }

    if (Object.keys(updateData).length <= 1) return;

    const cellIds = cells.map(c => c.id);
    const { error: updateError } = await getClient()
      .from('cells')
      .update(updateData)
      .in('id', cellIds);

    if (updateError) throw updateError;
  },

  async populateCellNamesForStructuredLink(
    boxId: string,
    effectiveName: string,
    cellData: Record<string, { name?: string; is_crossed?: boolean }>,
    slideValues: SlideValuesMap,
    sortedHeaderOrders: number[],
  ): Promise<string[]> {
    const cellIdsToUpdate: string[] = [];
    for (const [cellId, cell] of Object.entries(cellData)) {
      if (cell.is_crossed) continue;
      if (cell.name && cell.name.trim().length > 0) continue;
      const vals = slideValues[cellId];
      if (!vals) continue;
      const computed = sortedHeaderOrders
        .map(order => (vals[order] ?? '').trim())
        .filter(Boolean)
        .join(' / ') || '';
      if (computed === effectiveName) {
        cellIdsToUpdate.push(cellId);
      }
    }
    if (cellIdsToUpdate.length === 0) return [];

    const { data: rows, error: fetchError } = await getClient()
      .from('cells')
      .select('id, cell_id')
      .eq('box_id', boxId)
      .in('cell_id', cellIdsToUpdate);
    if (fetchError) throw fetchError;
    if (!rows || rows.length === 0) return [];

    const ids = rows.map(r => r.id);
    const { error: updateError } = await getClient()
      .from('cells')
      .update({ name: effectiveName, updated_at: new Date().toISOString() })
      .in('id', ids);
    if (updateError) throw updateError;

    return cellIdsToUpdate;
  },

  async populateStructuredVariantInfo(
    boxId: string,
    linkedName: string,
    variantInfo: string,
    cellData: Record<string, { name?: string; information?: string; is_crossed?: boolean }>,
    slideValues: SlideValuesMap,
    sortedHeaderOrders: number[],
  ): Promise<void> {
    const cellIdsToUpdate: string[] = [];
    for (const [cellId, cell] of Object.entries(cellData)) {
      if (cell.is_crossed) continue;
      if ((cell.name || '').trim() !== linkedName.trim()) continue;
      const vals = slideValues[cellId] || {};
      const computed = sortedHeaderOrders.map(order => (vals[order] ?? '').trim()).join('|||');
      if (computed === variantInfo) {
        cellIdsToUpdate.push(cellId);
      }
    }
    if (cellIdsToUpdate.length === 0) return;

    const { data: rows, error: fetchError } = await getClient()
      .from('cells')
      .select('id, cell_id')
      .eq('box_id', boxId)
      .in('cell_id', cellIdsToUpdate);
    if (fetchError) throw fetchError;
    if (!rows || rows.length === 0) return;

    const ids = rows.map(r => r.id);
    const { error: updateError } = await getClient()
      .from('cells')
      .update({ information: variantInfo, updated_at: new Date().toISOString() })
      .in('id', ids);
    if (updateError) throw updateError;
  },

  async updateLinkedCellHeaderValues(
    boxId: string,
    linkedName: string,
    linkedInfo: string | null,
    linkType: GridItemLinkType,
    headerMapping: Array<{ slideHeaderId: string; value: string }>,
  ): Promise<void> {
    let query = getClient()
      .from('cells')
      .select('id, cell_id')
      .eq('box_id', boxId);

    if (linkType === 'info') {
      query = query.eq('information', linkedInfo || '');
    } else {
      query = query.eq('name', linkedName);
      if (linkType === 'name_info') {
        query = query.eq('information', linkedInfo || '');
      }
    }

    const { data: cells, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!cells || cells.length === 0) return;

    const cellUuids = cells.map(c => c.id);

    const records: Array<{ cell_id: string; header_id: string; value: string }> = [];
    for (const cellUuid of cellUuids) {
      for (const { slideHeaderId, value } of headerMapping) {
        records.push({
          cell_id: cellUuid,
          header_id: slideHeaderId,
          value,
        });
      }
    }

    if (records.length === 0) return;

    const { error: upsertError } = await getClient()
      .from('slide_cell_values')
      .upsert(records, { onConflict: 'cell_id,header_id' });
    if (upsertError) throw upsertError;
  },

  async populateStructuredVariantInfoByHeaders(
    boxId: string,
    variantInfo: string,
    cellData: Record<string, { name?: string; information?: string; is_crossed?: boolean }>,
    slideValues: SlideValuesMap,
    sortedHeaderOrders: number[],
  ): Promise<void> {
    const cellIdsToUpdate: string[] = [];
    for (const [cellId, cell] of Object.entries(cellData)) {
      if (cell.is_crossed) continue;
      const vals = slideValues[cellId] || {};
      const computed = sortedHeaderOrders.map(order => (vals[order] ?? '').trim()).join('|||');
      if (computed === variantInfo) {
        cellIdsToUpdate.push(cellId);
      }
    }
    if (cellIdsToUpdate.length === 0) return;

    const { data: rows, error: fetchError } = await getClient()
      .from('cells')
      .select('id, cell_id')
      .eq('box_id', boxId)
      .in('cell_id', cellIdsToUpdate);
    if (fetchError) throw fetchError;
    if (!rows || rows.length === 0) return;

    const ids = rows.map(r => r.id);
    const { error: updateError } = await getClient()
      .from('cells')
      .update({ information: variantInfo, updated_at: new Date().toISOString() })
      .in('id', ids);
    if (updateError) throw updateError;
  },

  async writeNameToInfoMatchingCells(
    boxId: string,
    variantInfo: string,
    name: string,
  ): Promise<void> {
    const { data: cells, error: fetchError } = await getClient()
      .from('cells')
      .select('id')
      .eq('box_id', boxId)
      .eq('information', variantInfo)
      .eq('is_crossed', false);
    if (fetchError) throw fetchError;
    if (!cells || cells.length === 0) return;

    const ids = cells.map(c => c.id);
    const { error: updateError } = await getClient()
      .from('cells')
      .update({ name, updated_at: new Date().toISOString() })
      .in('id', ids);
    if (updateError) throw updateError;
  },

  async updateInfoOnMatchingCells(
    boxId: string,
    oldInfo: string,
    newInfo: string,
  ): Promise<void> {
    const { data: cells, error: fetchError } = await getClient()
      .from('cells')
      .select('id')
      .eq('box_id', boxId)
      .eq('information', oldInfo)
      .eq('is_crossed', false);
    if (fetchError) throw fetchError;
    if (!cells || cells.length === 0) return;

    const ids = cells.map(c => c.id);
    const { error: updateError } = await getClient()
      .from('cells')
      .update({ information: newInfo, updated_at: new Date().toISOString() })
      .in('id', ids);
    if (updateError) throw updateError;
  },
};
