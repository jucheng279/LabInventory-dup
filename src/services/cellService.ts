import { getClient } from '../lib/supabase';
import { historyService } from './historyService';
import type { CellData, LocationCellRecord, HistoryActionContext, CellStateMap } from '../types/database';

export type { CellData, LocationCellRecord } from '../types/database';

function buildCellStateMap(cellIds: string[], currentCellData: Record<string, CellData>): CellStateMap {
  const map: CellStateMap = {};
  for (const cellId of cellIds) {
    const cell = currentCellData[cellId];
    if (cell) {
      map[cellId] = {
        name: cell.name,
        information: cell.information ?? '',
        date: cell.date ?? null,
        color: cell.color ?? null,
        is_crossed: cell.is_crossed ?? false,
        date_type: cell.date_type ?? 'date',
      };
    }
  }
  return map;
}

async function fetchCurrentCellStates(boxId: string, cellIds: string[]): Promise<Record<string, CellData>> {
  if (cellIds.length === 0) return {};
  const { data, error } = await getClient()
    .from('cells')
    .select('*')
    .eq('box_id', boxId)
    .in('cell_id', cellIds);

  if (error) {
    console.error('Error fetching current cell states for snapshot:', error);
    return {};
  }

  const cellData: Record<string, CellData> = {};
  data?.forEach((record: LocationCellRecord) => {
    cellData[record.cell_id] = {
      name: record.name,
      information: record.information,
      date: record.date,
      color: record.color,
      is_crossed: record.is_crossed,
      date_type: (record.date_type === 'expiration' ? 'expiration' : record.date_type === 'none' ? 'none' : 'date') as 'date' | 'expiration' | 'none',
    };
  });
  return cellData;
}

export const cellService = {
  async getAllCells(boxId: string): Promise<Record<string, CellData>> {
    const { data, error } = await getClient()
      .from('cells')
      .select('*')
      .eq('box_id', boxId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching fridge cells:', error);
      throw error;
    }

    const cellData: Record<string, CellData> = {};
    data?.forEach((record: LocationCellRecord) => {
      cellData[record.cell_id] = {
        name: record.name,
        information: record.information,
        date: record.date,
        color: record.color,
        is_crossed: record.is_crossed,
        date_type: (record.date_type === 'expiration' ? 'expiration' : record.date_type === 'none' ? 'none' : 'date') as 'date' | 'expiration' | 'none',
        slide_image_url: record.slide_image_url,
      };
    });

    return cellData;
  },

  async upsertCell(boxId: string, cellId: string, data: CellData): Promise<void> {
    const { error } = await getClient()
      .from('cells')
      .upsert(
        {
          box_id: boxId,
          cell_id: cellId,
          name: data.name,
          information: data.information,
          date: data.date || null,
          color: data.color || null,
          is_crossed: false,
          date_type: data.date_type || 'date'
        },
        {
          onConflict: 'box_id,cell_id'
        }
      );

    if (error) {
      console.error('Error upserting fridge cell:', error);
      throw error;
    }
  },

  async upsertMultipleCells(
    boxId: string,
    cells: Array<{ cellId: string; data: CellData }>,
    teamMemberId?: string,
    actionContext?: HistoryActionContext
  ): Promise<void> {
    const cellIds = cells.map(c => c.cellId);
    let previousCellData: CellStateMap | undefined;
    if (teamMemberId && cells.length > 0) {
      const allIds = actionContext
        ? [...new Set([...actionContext.sourceCells, ...actionContext.targetCells])]
        : cellIds;
      const currentStates = await fetchCurrentCellStates(boxId, allIds);
      previousCellData = buildCellStateMap(allIds, currentStates);
    }

    const records = cells.map(({ cellId, data }) => ({
      box_id: boxId,
      cell_id: cellId,
      name: data.name,
      information: data.information,
      date: data.date || null,
      color: data.color || null,
      is_crossed: false,
      date_type: data.date_type || 'date',
      slide_image_url: data.slide_image_url || null,
    }));

    const { error } = await getClient()
      .from('cells')
      .upsert(records, {
        onConflict: 'box_id,cell_id'
      });

    if (error) {
      console.error('Error upserting multiple fridge cells:', error);
      throw error;
    }

    if (teamMemberId && cells.length > 0) {
      if (actionContext) {
        const allCells = [...new Set([...actionContext.sourceCells, ...actionContext.targetCells])];
        await historyService.logHistoryEntry(
          boxId,
          teamMemberId,
          actionContext.actionType,
          allCells,
          undefined,
          actionContext.sourceCells,
          actionContext.targetCells,
          actionContext.relatedBoxId,
          actionContext.relatedBoxName,
          previousCellData
        );
      } else {
        const firstCell = cells[0].data;
        await historyService.logHistoryEntry(
          boxId,
          teamMemberId,
          'edit',
          cellIds,
          { name: firstCell.name, information: firstCell.information, date: firstCell.date, date_type: firstCell.date_type || 'date' },
          undefined,
          undefined,
          undefined,
          undefined,
          previousCellData
        );
      }
    }
  },

  async deleteCell(boxId: string, cellId: string): Promise<void> {
    const { error } = await getClient()
      .from('cells')
      .delete()
      .eq('box_id', boxId)
      .eq('cell_id', cellId);

    if (error) {
      console.error('Error deleting fridge cell:', error);
      throw error;
    }
  },

  async deleteMultipleCells(
    boxId: string,
    cellIds: string[],
    teamMemberId?: string,
    skipHistory?: boolean
  ): Promise<void> {
    let previousCellData: CellStateMap | undefined;
    if (teamMemberId && cellIds.length > 0 && !skipHistory) {
      const currentStates = await fetchCurrentCellStates(boxId, cellIds);
      previousCellData = buildCellStateMap(cellIds, currentStates);
    }

    const { error } = await getClient()
      .from('cells')
      .delete()
      .eq('box_id', boxId)
      .in('cell_id', cellIds);

    if (error) {
      console.error('Error deleting multiple fridge cells:', error);
      throw error;
    }

    if (teamMemberId && cellIds.length > 0 && !skipHistory) {
      await historyService.logHistoryEntry(boxId, teamMemberId, 'clear', cellIds, undefined, undefined, undefined, undefined, undefined, previousCellData);
    }
  },

  async deleteOutOfBoundsCells(boxId: string, newRows: number, newColumns: number): Promise<void> {
    const validRowLabels = 'ABCDEFGHIJKLMNOPQRST'.slice(0, newRows).split('');
    const validCellIds = new Set<string>();

    for (const row of validRowLabels) {
      for (let col = 1; col <= newColumns; col++) {
        validCellIds.add(`${row}${col}`);
      }
    }

    const { data: existingCells, error: fetchError } = await getClient()
      .from('cells')
      .select('cell_id')
      .eq('box_id', boxId);

    if (fetchError) {
      console.error('Error fetching cells for cleanup:', fetchError);
      throw fetchError;
    }

    const cellsToDelete = existingCells
      ?.filter(cell => !validCellIds.has(cell.cell_id))
      .map(cell => cell.cell_id) || [];

    if (cellsToDelete.length > 0) {
      const { error: deleteError } = await getClient()
        .from('cells')
        .delete()
        .eq('box_id', boxId)
        .in('cell_id', cellsToDelete);

      if (deleteError) {
        console.error('Error deleting out-of-bounds cells:', deleteError);
        throw deleteError;
      }
    }
  },

  async updateSlideImageUrl(
    boxId: string,
    cellId: string,
    slideImageUrl: string | null
  ): Promise<void> {
    const { error } = await getClient()
      .from('cells')
      .update({ slide_image_url: slideImageUrl })
      .eq('box_id', boxId)
      .eq('cell_id', cellId);

    if (error) {
      console.error('Error updating slide image URL:', error);
      throw error;
    }
  },

  async crossMultipleCells(
    boxId: string,
    cellIds: string[],
    teamMemberId?: string
  ): Promise<void> {
    let previousCellData: CellStateMap | undefined;
    if (teamMemberId && cellIds.length > 0) {
      const currentStates = await fetchCurrentCellStates(boxId, cellIds);
      previousCellData = buildCellStateMap(cellIds, currentStates);
    }

    const { error } = await getClient()
      .from('cells')
      .update({ is_crossed: true })
      .eq('box_id', boxId)
      .in('cell_id', cellIds);

    if (error) {
      console.error('Error crossing fridge cells:', error);
      throw error;
    }

    if (teamMemberId && cellIds.length > 0) {
      await historyService.logHistoryEntry(boxId, teamMemberId, 'cross', cellIds, undefined, undefined, undefined, undefined, undefined, previousCellData);
    }
  }
};
