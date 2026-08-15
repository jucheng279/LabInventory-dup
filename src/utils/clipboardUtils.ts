import type { CellData, SlideValuesMap } from '../types/database';
import type { CellPosition, ClipboardEntry, ClipboardData, PasteMapping, PasteResult, SwapMapping, SwapResult, SlideHeaderSnapshot } from '../types/clipboard';

export type { CellPosition, ClipboardEntry, ClipboardData, PasteMapping, PasteResult, SwapMapping, SwapResult, SlideHeaderSnapshot } from '../types/clipboard';

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRST';

export function parseCell(cellId: string, swapAxes?: boolean): CellPosition | null {
  const match = cellId.match(/^([A-T])(\d+)$/);
  if (!match) return null;
  const letterIndex = ROW_LABELS.indexOf(match[1]);
  const numberIndex = parseInt(match[2], 10) - 1;
  if (swapAxes) {
    return { row: numberIndex, col: letterIndex };
  }
  return { row: letterIndex, col: numberIndex };
}

export function toCellId(row: number, col: number, swapAxes?: boolean): string | null {
  if (swapAxes) {
    if (col < 0 || col >= ROW_LABELS.length || row < 0) return null;
    return `${ROW_LABELS[col]}${row + 1}`;
  }
  if (row < 0 || row >= ROW_LABELS.length || col < 0) return null;
  return `${ROW_LABELS[row]}${col + 1}`;
}

export function computeClipboardData(
  selectedCells: Set<string>,
  cellData: Record<string, CellData>,
  operation: 'copy' | 'cut',
  slideValues?: SlideValuesMap,
  swapAxes?: boolean
): ClipboardData | null {
  const positions: Array<{ cellId: string; pos: CellPosition; data: CellData; slideHeaderValues?: SlideHeaderSnapshot }> = [];

  for (const cellId of selectedCells) {
    const pos = parseCell(cellId, swapAxes);
    if (!pos) continue;
    const data = cellData[cellId];
    if (data) {
      const sv = slideValues?.[cellId];
      positions.push({
        cellId,
        pos,
        data: { ...data },
        slideHeaderValues: sv ? { ...sv } : undefined,
      });
    }
  }

  if (positions.length === 0) return null;

  const minRow = Math.min(...positions.map(p => p.pos.row));
  const minCol = Math.min(...positions.map(p => p.pos.col));

  const entries: ClipboardEntry[] = positions.map(p => ({
    rowOffset: p.pos.row - minRow,
    colOffset: p.pos.col - minCol,
    data: p.data,
    slideHeaderValues: p.slideHeaderValues,
  }));

  return {
    entries,
    sourceCellIds: positions.map(p => p.cellId),
    operation,
    swapAxes,
  };
}

export function computePasteTargets(
  clipboard: ClipboardData,
  anchorCellId: string,
  cellData: Record<string, CellData>,
  maxRows: number,
  maxCols: number
): PasteResult {
  const sa = clipboard.swapAxes;
  const anchor = parseCell(anchorCellId, sa);
  if (!anchor) return { mappings: [], conflicts: [], outOfBounds: 0 };

  const mappings: PasteMapping[] = [];
  const conflicts: string[] = [];
  let outOfBounds = 0;

  for (const entry of clipboard.entries) {
    const targetRow = anchor.row + entry.rowOffset;
    const targetCol = anchor.col + entry.colOffset;

    if (targetRow < 0 || targetRow >= maxRows || targetCol < 0 || targetCol >= maxCols) {
      outOfBounds++;
      continue;
    }

    const targetCellId = toCellId(targetRow, targetCol, sa);
    if (!targetCellId) {
      outOfBounds++;
      continue;
    }

    mappings.push({ targetCellId, data: entry.data, slideHeaderValues: entry.slideHeaderValues });

    const existing = cellData[targetCellId];
    if (existing && !clipboard.sourceCellIds.includes(targetCellId)) {
      conflicts.push(targetCellId);
    }
  }

  return { mappings, conflicts, outOfBounds };
}

export function computeSwapTargets(
  clipboard: ClipboardData,
  anchorCellId: string,
  cellData: Record<string, CellData>,
  maxRows: number,
  maxCols: number,
  slideValues?: SlideValuesMap
): SwapResult {
  const sa = clipboard.swapAxes;
  const anchor = parseCell(anchorCellId, sa);
  if (!anchor) return { pasteToTarget: [], moveToSource: [], sourceCellIds: [], conflicts: [], outOfBounds: 0 };

  const pasteToTarget: SwapMapping[] = [];
  const moveToSource: SwapMapping[] = [];
  const conflicts: string[] = [];
  let outOfBounds = 0;

  for (let i = 0; i < clipboard.entries.length; i++) {
    const entry = clipboard.entries[i];
    const targetRow = anchor.row + entry.rowOffset;
    const targetCol = anchor.col + entry.colOffset;

    if (targetRow < 0 || targetRow >= maxRows || targetCol < 0 || targetCol >= maxCols) {
      outOfBounds++;
      continue;
    }

    const targetCellId = toCellId(targetRow, targetCol, sa);
    if (!targetCellId) {
      outOfBounds++;
      continue;
    }

    pasteToTarget.push({ targetCellId, data: entry.data, slideHeaderValues: entry.slideHeaderValues });

    const existing = cellData[targetCellId];
    if (existing && !clipboard.sourceCellIds.includes(targetCellId)) {
      conflicts.push(targetCellId);
      const sourceCellId = clipboard.sourceCellIds[i];
      if (sourceCellId) {
        const existingSlideVals = slideValues?.[targetCellId];
        moveToSource.push({
          targetCellId: sourceCellId,
          data: { ...existing },
          slideHeaderValues: existingSlideVals ? { ...existingSlideVals } : undefined,
        });
      }
    }
  }

  return { pasteToTarget, moveToSource, sourceCellIds: [...clipboard.sourceCellIds], conflicts, outOfBounds };
}
