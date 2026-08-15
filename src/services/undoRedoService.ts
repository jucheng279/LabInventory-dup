import { getClient } from '../lib/supabase';
import type { CellStateMap, HistoryEntry } from '../types/database';

export const undoRedoService = {
  async restoreCells(
    boxId: string,
    stateMap: CellStateMap,
    affectedCellIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    const cellsToUpsert: Array<{
      cell_id: string;
      box_id: string;
      name: string;
      information: string;
      date: string | null;
      color: string | null;
      is_crossed: boolean;
      date_type: string;
    }> = [];
    const cellsToDelete: string[] = [];

    const currentStatesResult = await getClient()
      .from('cells')
      .select('cell_id')
      .eq('box_id', boxId)
      .in('cell_id', affectedCellIds);

    if (currentStatesResult.error) {
      return { success: false, error: 'Failed to fetch current cell states' };
    }

    const existingCellIds = new Set(currentStatesResult.data?.map(r => r.cell_id) || []);

    for (const cellId of affectedCellIds) {
      const prev = stateMap[cellId];
      if (prev) {
        cellsToUpsert.push({
          cell_id: cellId,
          box_id: boxId,
          name: prev.name,
          information: prev.information,
          date: prev.date,
          color: prev.color,
          is_crossed: prev.is_crossed,
          date_type: prev.date_type,
        });
      } else {
        if (existingCellIds.has(cellId)) {
          cellsToDelete.push(cellId);
        }
      }
    }

    if (cellsToUpsert.length > 0) {
      const { error } = await getClient()
        .from('cells')
        .upsert(cellsToUpsert, { onConflict: 'box_id,cell_id' });
      if (error) return { success: false, error: 'Failed to restore cells' };
    }

    if (cellsToDelete.length > 0) {
      const { error } = await getClient()
        .from('cells')
        .delete()
        .eq('box_id', boxId)
        .in('cell_id', cellsToDelete);
      if (error) return { success: false, error: 'Failed to remove cells' };
    }

    return { success: true };
  },

  async captureCurrentCellState(
    boxId: string,
    cellIds: string[]
  ): Promise<CellStateMap> {
    const { data } = await getClient()
      .from('cells')
      .select('*')
      .eq('box_id', boxId)
      .in('cell_id', cellIds);

    const stateMap: CellStateMap = {};
    data?.forEach((record) => {
      stateMap[record.cell_id] = {
        name: record.name,
        information: record.information ?? '',
        date: record.date ?? null,
        color: record.color ?? null,
        is_crossed: record.is_crossed ?? false,
        date_type: record.date_type ?? 'date',
      };
    });
    return stateMap;
  },

  async undoLatest(
    boxId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: entries, error } = await getClient()
      .from('box_history')
      .select('id, affected_cells, previous_cell_data, related_box_id, action_type, batch_id, created_at')
      .eq('box_id', boxId)
      .eq('is_undone', false)
      .order('created_at', { ascending: false });

    if (error || !entries || entries.length === 0) {
      return { success: false, error: 'No action available to undo' };
    }

    const topLevel = entries.filter(e => e.batch_id === null);
    if (topLevel.length === 0) {
      return { success: false, error: 'No action available to undo' };
    }

    const entry = topLevel[0];

    const hasBatchAbove = entries.some(e => e.batch_id !== null && new Date(e.created_at) > new Date(entry.created_at));
    if (hasBatchAbove) {
      return { success: false, error: 'Action is sealed below a revert' };
    }

    if (entry.previous_cell_data === null || entry.previous_cell_data === undefined) {
      return { success: false, error: 'No previous state available' };
    }

    if (entry.related_box_id) {
      return { success: false, error: 'Cannot undo cross-box operations' };
    }

    const currentState = await this.captureCurrentCellState(boxId, entry.affected_cells);

    const restoreResult = await this.restoreCells(boxId, entry.previous_cell_data, entry.affected_cells);
    if (!restoreResult.success) {
      return restoreResult;
    }

    const { error: updateError } = await getClient()
      .from('box_history')
      .update({ is_undone: true, redo_cell_data: currentState })
      .eq('id', entry.id);

    if (updateError) {
      return { success: false, error: 'Failed to mark entry as undone' };
    }

    return { success: true };
  },

  async redoLatest(
    boxId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: entries, error } = await getClient()
      .from('box_history')
      .select('id, affected_cells, redo_cell_data, is_undone, batch_id')
      .eq('box_id', boxId)
      .is('batch_id', null)
      .order('created_at', { ascending: false });

    if (error || !entries) {
      return { success: false, error: 'Failed to fetch history' };
    }

    const target = entries.find(e => e.is_undone && e.redo_cell_data !== null && e.redo_cell_data !== undefined);

    if (!target) {
      return { success: false, error: 'No action available to redo' };
    }

    const restoreResult = await this.restoreCells(boxId, target.redo_cell_data, target.affected_cells);
    if (!restoreResult.success) {
      return restoreResult;
    }

    const { error: updateError } = await getClient()
      .from('box_history')
      .update({ is_undone: false })
      .eq('id', target.id);

    if (updateError) {
      return { success: false, error: 'Failed to mark entry as redone' };
    }

    return { success: true };
  },

  async revertToEntry(
    targetEntryId: string,
    boxId: string,
    teamMemberId: string
  ): Promise<{ success: boolean; revertedCount: number; error?: string }> {
    const { data: allEntries, error } = await getClient()
      .from('box_history')
      .select('id, affected_cells, previous_cell_data, related_box_id, is_undone, batch_id, created_at')
      .eq('box_id', boxId)
      .order('created_at', { ascending: false });

    if (error || !allEntries) {
      return { success: false, revertedCount: 0, error: 'Failed to fetch history' };
    }

    const targetIdx = allEntries.findIndex(e => e.id === targetEntryId);
    if (targetIdx === -1) {
      return { success: false, revertedCount: 0, error: 'Target entry not found' };
    }

    const targetEntry = allEntries[targetIdx];

    const entriesToGroup = allEntries.slice(0, targetIdx).filter(e => e.batch_id === null);

    if (entriesToGroup.length === 0) {
      return { success: false, revertedCount: 0, error: 'No actions to revert' };
    }

    const { data: existingGroups } = await getClient()
      .from('revert_groups')
      .select('id, created_at')
      .eq('box_id', boxId)
      .is('parent_group_id', null)
      .order('created_at', { ascending: false });

    const topLevelGroupsAboveTarget = (existingGroups || []).filter(
      g => new Date(g.created_at) > new Date(targetEntry.created_at)
    );

    const { data: newGroup, error: groupError } = await getClient()
      .from('revert_groups')
      .insert({ box_id: boxId, team_member_id: teamMemberId })
      .select('id')
      .maybeSingle();

    if (groupError || !newGroup) {
      return { success: false, revertedCount: 0, error: 'Failed to create revert group' };
    }

    const newGroupId = newGroup.id;

    const entryIds = entriesToGroup.map(e => e.id);
    if (entryIds.length > 0) {
      const { error: batchError } = await getClient()
        .from('box_history')
        .update({ batch_id: newGroupId })
        .in('id', entryIds);

      if (batchError) {
        return { success: false, revertedCount: 0, error: 'Failed to group entries' };
      }
    }

    if (topLevelGroupsAboveTarget.length > 0) {
      const groupIds = topLevelGroupsAboveTarget.map(g => g.id);
      const { error: nestError } = await getClient()
        .from('revert_groups')
        .update({ parent_group_id: newGroupId })
        .in('id', groupIds);

      if (nestError) {
        return { success: false, revertedCount: entryIds.length, error: 'Failed to nest existing groups' };
      }
    }

    const nonUndoneEntries = entriesToGroup.filter(
      e => !e.is_undone && e.previous_cell_data && Object.keys(e.previous_cell_data).length > 0 && !e.related_box_id
    );

    for (const entry of nonUndoneEntries) {
      const result = await this.restoreCells(boxId, entry.previous_cell_data, entry.affected_cells);
      if (!result.success) {
        return { success: false, revertedCount: entryIds.length, error: result.error };
      }
    }

    return { success: true, revertedCount: entriesToGroup.length + topLevelGroupsAboveTarget.length };
  },

  async restoreLatestRevert(
    boxId: string
  ): Promise<{ success: boolean; restoredCount: number; error?: string }> {
    const { data: groups, error: groupsError } = await getClient()
      .from('revert_groups')
      .select('id, created_at')
      .eq('box_id', boxId)
      .is('parent_group_id', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (groupsError || !groups || groups.length === 0) {
      return { success: false, restoredCount: 0, error: 'No revert group to restore' };
    }

    const groupToRestore = groups[0];

    const { data: newerNonBatched } = await getClient()
      .from('box_history')
      .select('id')
      .eq('box_id', boxId)
      .is('batch_id', null)
      .eq('is_undone', false)
      .gt('created_at', groupToRestore.created_at)
      .limit(1);

    if (newerNonBatched && newerNonBatched.length > 0) {
      return { success: false, restoredCount: 0, error: 'Revert group is sealed by newer actions' };
    }

    const { data: entriesInGroup, error: entriesError } = await getClient()
      .from('box_history')
      .select('id, affected_cells, redo_cell_data, is_undone, previous_cell_data, related_box_id')
      .eq('box_id', boxId)
      .eq('batch_id', groupToRestore.id)
      .order('created_at', { ascending: true });

    if (entriesError) {
      return { success: false, restoredCount: 0, error: 'Failed to fetch group entries' };
    }

    const nonUndoneEntries = (entriesInGroup || []).filter(
      e => !e.is_undone && !e.related_box_id
    );

    for (const entry of nonUndoneEntries) {
      if (entry.redo_cell_data && Object.keys(entry.redo_cell_data).length > 0) {
        const result = await this.restoreCells(boxId, entry.redo_cell_data, entry.affected_cells);
        if (!result.success) {
          return { success: false, restoredCount: 0, error: result.error };
        }
      } else {
        const currentState = await this.captureCurrentCellState(boxId, entry.affected_cells);
        if (entry.previous_cell_data) {
          await getClient()
            .from('box_history')
            .update({ redo_cell_data: currentState })
            .eq('id', entry.id);
        }
      }
    }

    const entryCount = (entriesInGroup || []).length;
    if (entryCount > 0) {
      const { error: unbatchError } = await getClient()
        .from('box_history')
        .update({ batch_id: null })
        .eq('batch_id', groupToRestore.id);

      if (unbatchError) {
        return { success: false, restoredCount: 0, error: 'Failed to unbatch entries' };
      }
    }

    const { error: unnestError } = await getClient()
      .from('revert_groups')
      .update({ parent_group_id: null })
      .eq('parent_group_id', groupToRestore.id);

    if (unnestError) {
      return { success: false, restoredCount: entryCount, error: 'Failed to unnest child groups' };
    }

    const { error: deleteError } = await getClient()
      .from('revert_groups')
      .delete()
      .eq('id', groupToRestore.id);

    if (deleteError) {
      return { success: false, restoredCount: entryCount, error: 'Failed to delete group record' };
    }

    return { success: true, restoredCount: entryCount };
  },
};
