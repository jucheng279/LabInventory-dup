import { getClient } from '../lib/supabase';
import type { HistoryActionType, CellDataSnapshot, CellStateMap, HistoryEntry, GetHistoryOptions, HistoryActionContext, RevertGroup } from '../types/database';

export type { HistoryActionType, CellDataSnapshot, CellStateMap, HistoryEntry, GetHistoryOptions, HistoryActionContext, RevertGroup } from '../types/database';

export const historyService = {
  async getBoxHistory({
    boxId,
    limit = 20,
    offset = 0,
  }: GetHistoryOptions): Promise<{ entries: HistoryEntry[]; hasMore: boolean }> {
    const { data, error, count } = await getClient()
      .from('box_history')
      .select(
        `
        id,
        box_id,
        team_member_id,
        action_type,
        affected_cells,
        source_cells,
        target_cells,
        cell_data,
        previous_cell_data,
        redo_cell_data,
        related_box_id,
        related_box_name,
        batch_id,
        is_undone,
        created_at,
        team_member:team_members(display_name, email)
      `,
        { count: 'exact' }
      )
      .eq('box_id', boxId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching box history:', error);
      throw error;
    }

    const entries = (data || []).map((entry) => ({
      ...entry,
      team_member: entry.team_member as HistoryEntry['team_member'],
    }));

    const totalCount = count ?? 0;
    const hasMore = offset + entries.length < totalCount;

    return { entries, hasMore };
  },

  async getRevertGroups(boxId: string): Promise<RevertGroup[]> {
    const { data, error } = await getClient()
      .from('revert_groups')
      .select('id, box_id, parent_group_id, team_member_id, created_at, team_member:team_members(display_name, email)')
      .eq('box_id', boxId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching revert groups:', error);
      throw error;
    }

    return (data || []).map(g => ({
      ...g,
      team_member: g.team_member as RevertGroup['team_member'],
    }));
  },

  async logHistoryEntry(
    boxId: string,
    teamMemberId: string,
    actionType: HistoryActionType,
    affectedCells: string[],
    cellData?: CellDataSnapshot,
    sourceCells?: string[],
    targetCells?: string[],
    relatedBoxId?: string,
    relatedBoxName?: string,
    previousCellData?: CellStateMap,
    batchId?: string
  ): Promise<void> {
    if (affectedCells.length === 0) return;

    const { error } = await getClient().from('box_history').insert({
      box_id: boxId,
      team_member_id: teamMemberId,
      action_type: actionType,
      affected_cells: affectedCells,
      cell_data: cellData ?? null,
      source_cells: sourceCells ?? null,
      target_cells: targetCells ?? null,
      related_box_id: relatedBoxId ?? null,
      related_box_name: relatedBoxName ?? null,
      previous_cell_data: previousCellData ?? null,
      batch_id: batchId ?? null,
    });

    if (error) {
      console.error('Error logging history entry:', error);
      throw error;
    }

    if (!batchId) {
      await getClient()
        .from('box_history')
        .update({ redo_cell_data: null })
        .eq('box_id', boxId)
        .eq('is_undone', true)
        .not('redo_cell_data', 'is', null);
    }
  },

  async logCrossBoxHistory(
    teamMemberId: string,
    actionType: HistoryActionType,
    sourceBoxId: string,
    sourceBoxName: string,
    targetBoxId: string,
    targetBoxName: string,
    sourceCells: string[],
    targetCells: string[]
  ): Promise<void> {
    const allCells = [...new Set([...sourceCells, ...targetCells])];
    if (allCells.length === 0) return;

    const rows = [
      {
        box_id: targetBoxId,
        team_member_id: teamMemberId,
        action_type: actionType,
        affected_cells: [...new Set([...sourceCells, ...targetCells])],
        cell_data: null,
        source_cells: sourceCells,
        target_cells: targetCells,
        related_box_id: sourceBoxId,
        related_box_name: sourceBoxName,
      },
      {
        box_id: sourceBoxId,
        team_member_id: teamMemberId,
        action_type: actionType,
        affected_cells: sourceCells,
        cell_data: null,
        source_cells: sourceCells,
        target_cells: targetCells,
        related_box_id: targetBoxId,
        related_box_name: targetBoxName,
      },
    ];

    const { error } = await getClient().from('box_history').insert(rows);
    if (error) {
      console.error('Error logging cross-box history:', error);
      throw error;
    }
  },
};
