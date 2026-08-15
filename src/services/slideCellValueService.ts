import { supabase } from '../lib/supabase';
import type { SlideValuesMap } from '../types/database';

export type { SlideCellValue, SlideValuesMap } from '../types/database';

export const slideCellValueService = {
  async getValuesForBox(boxId: string): Promise<SlideValuesMap> {
    const { data: cells, error: cellsError } = await supabase
      .from('cells')
      .select('id, cell_id')
      .eq('box_id', boxId);

    if (cellsError) {
      console.error('Error fetching fridge cells for slide values:', cellsError);
      throw cellsError;
    }

    if (!cells || cells.length === 0) return {};

    const cellUuidToTextId: Record<string, string> = {};
    const cellUuids: string[] = [];
    for (const cell of cells) {
      cellUuidToTextId[cell.id] = cell.cell_id;
      cellUuids.push(cell.id);
    }

    const { data: headers, error: headersError } = await supabase
      .from('slide_box_headers')
      .select('id, display_order')
      .eq('box_id', boxId);

    if (headersError) {
      console.error('Error fetching headers for slide values:', headersError);
      throw headersError;
    }

    const headerIdToOrder: Record<string, number> = {};
    if (headers) {
      for (const h of headers) {
        headerIdToOrder[h.id] = h.display_order;
      }
    }

    const { data: values, error: valuesError } = await supabase
      .from('slide_cell_values')
      .select('*')
      .in('cell_id', cellUuids);

    if (valuesError) {
      console.error('Error fetching slide cell values:', valuesError);
      throw valuesError;
    }

    const result: SlideValuesMap = {};
    if (values) {
      for (const val of values) {
        const textCellId = cellUuidToTextId[val.cell_id];
        if (!textCellId) continue;
        const displayOrder = headerIdToOrder[val.header_id];
        if (displayOrder === undefined) continue;

        if (!result[textCellId]) {
          result[textCellId] = {};
        }
        result[textCellId][displayOrder] = val.value;
      }
    }

    return result;
  },

  async upsertValuesForCell(
    boxId: string,
    cellTextId: string,
    headerValues: Array<{ headerId: string; value: string }>
  ): Promise<void> {
    const { data: cell, error: cellError } = await supabase
      .from('cells')
      .select('id')
      .eq('box_id', boxId)
      .eq('cell_id', cellTextId)
      .maybeSingle();

    if (cellError) {
      console.error('Error finding cell for slide value upsert:', cellError);
      throw cellError;
    }

    if (!cell) return;

    const records = headerValues.map(({ headerId, value }) => ({
      cell_id: cell.id,
      header_id: headerId,
      value,
    }));

    const { error } = await supabase
      .from('slide_cell_values')
      .upsert(records, { onConflict: 'cell_id,header_id' });

    if (error) {
      console.error('Error upserting slide cell values:', error);
      throw error;
    }
  },

  async upsertMultipleCellValues(
    boxId: string,
    entries: Array<{ cellTextId: string; headerValues: Array<{ headerId: string; value: string }> }>
  ): Promise<void> {
    const cellTextIds = entries.map(e => e.cellTextId);

    const { data: cells, error: cellsError } = await supabase
      .from('cells')
      .select('id, cell_id')
      .eq('box_id', boxId)
      .in('cell_id', cellTextIds);

    if (cellsError) {
      console.error('Error fetching cells for batch slide value upsert:', cellsError);
      throw cellsError;
    }

    if (!cells || cells.length === 0) return;

    const textIdToUuid: Record<string, string> = {};
    for (const c of cells) {
      textIdToUuid[c.cell_id] = c.id;
    }

    const records: Array<{ cell_id: string; header_id: string; value: string }> = [];
    for (const entry of entries) {
      const cellUuid = textIdToUuid[entry.cellTextId];
      if (!cellUuid) continue;
      for (const { headerId, value } of entry.headerValues) {
        records.push({ cell_id: cellUuid, header_id: headerId, value });
      }
    }

    if (records.length === 0) return;

    const { error } = await supabase
      .from('slide_cell_values')
      .upsert(records, { onConflict: 'cell_id,header_id' });

    if (error) {
      console.error('Error batch upserting slide cell values:', error);
      throw error;
    }
  },
};
