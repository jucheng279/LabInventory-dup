import { useCallback } from 'react';
import { CellData } from '../services/locationCellService';
import type { BoxType, SlideValuesMap } from '../types/database';
import { useClipboardContext } from '../contexts/ClipboardContext';
import {
  ClipboardData,
  computeClipboardData,
  computePasteTargets,
  computeSwapTargets,
  PasteResult,
  SwapResult,
} from '../utils/clipboardUtils';

export interface BoxSource {
  boxId: string;
  boxType: BoxType;
  boxName: string;
}

export function useGridClipboard() {
  const ctx = useClipboardContext();

  const copyToClipboard = useCallback(
    (selectedCells: Set<string>, cellData: Record<string, CellData>, source: BoxSource, slideValues?: SlideValuesMap, swapAxes?: boolean) => {
      const data = computeClipboardData(selectedCells, cellData, 'copy', slideValues, swapAxes);
      if (data) {
        const enriched: ClipboardData = { ...data, sourceBoxId: source.boxId, sourceBoxType: source.boxType, sourceBoxName: source.boxName };
        ctx.setClipboard(enriched);
        return enriched;
      }
      return data;
    },
    [ctx]
  );

  const cutToClipboard = useCallback(
    (selectedCells: Set<string>, cellData: Record<string, CellData>, source: BoxSource, slideValues?: SlideValuesMap, swapAxes?: boolean) => {
      const data = computeClipboardData(selectedCells, cellData, 'cut', slideValues, swapAxes);
      if (data) {
        const enriched: ClipboardData = { ...data, sourceBoxId: source.boxId, sourceBoxType: source.boxType, sourceBoxName: source.boxName };
        ctx.setClipboard(enriched);
        return enriched;
      }
      return data;
    },
    [ctx]
  );

  const stageForMove = useCallback(
    (selectedCells: Set<string>, cellData: Record<string, CellData>, source: BoxSource, slideValues?: SlideValuesMap, swapAxes?: boolean) => {
      const data = computeClipboardData(selectedCells, cellData, 'cut', slideValues, swapAxes);
      if (data) {
        const enriched: ClipboardData = { ...data, sourceBoxId: source.boxId, sourceBoxType: source.boxType, sourceBoxName: source.boxName };
        ctx.setMoveStaged(enriched);
        return enriched;
      }
      return data;
    },
    [ctx]
  );

  const getMovePreview = useCallback(
    (
      anchorCellId: string,
      cellData: Record<string, CellData>,
      maxRows: number,
      maxCols: number,
      slideValues?: SlideValuesMap
    ): SwapResult | null => {
      if (!ctx.moveStaged) return null;
      return computeSwapTargets(ctx.moveStaged, anchorCellId, cellData, maxRows, maxCols, slideValues);
    },
    [ctx.moveStaged]
  );

  const getPastePreview = useCallback(
    (
      anchorCellId: string,
      cellData: Record<string, CellData>,
      maxRows: number,
      maxCols: number
    ): PasteResult | null => {
      if (!ctx.clipboard) return null;
      return computePasteTargets(ctx.clipboard, anchorCellId, cellData, maxRows, maxCols);
    },
    [ctx.clipboard]
  );

  return {
    clipboard: ctx.clipboard,
    hasClipboard: ctx.hasClipboard,
    clipboardCellIds: ctx.clipboardCellIds,
    clipboardOperation: ctx.clipboardOperation,
    copyToClipboard,
    cutToClipboard,
    getPastePreview,
    clearClipboard: ctx.clearClipboard,
    moveStaged: ctx.moveStaged,
    hasMoveStaged: ctx.hasMoveStaged,
    moveStagedCellIds: ctx.moveStagedCellIds,
    stageForMove,
    getMovePreview,
    clearMoveStaged: ctx.clearMoveStaged,
    canPasteIntoBox: ctx.canPasteIntoBox,
    canMoveIntoBox: ctx.canMoveIntoBox,
    isCrossBoxMove: ctx.isCrossBoxMove,
    sourceBoxId: ctx.sourceBoxId,
    sourceBoxName: ctx.sourceBoxName,
    moveStagedBoxId: ctx.moveStagedBoxId,
    moveStagedBoxName: ctx.moveStagedBoxName,
  };
}
