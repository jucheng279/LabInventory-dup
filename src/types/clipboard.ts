import type { BoxType, CellData } from './database';

export type SlideHeaderSnapshot = Record<number, string>;

export interface CellPosition {
  row: number;
  col: number;
}

export interface ClipboardEntry {
  rowOffset: number;
  colOffset: number;
  data: CellData;
  slideHeaderValues?: SlideHeaderSnapshot;
}

export interface ClipboardData {
  entries: ClipboardEntry[];
  sourceCellIds: string[];
  operation: 'copy' | 'cut';
  swapAxes?: boolean;
  sourceBoxId: string;
  sourceBoxType: BoxType;
  sourceBoxName: string;
}

export interface PasteMapping {
  targetCellId: string;
  data: CellData;
  slideHeaderValues?: SlideHeaderSnapshot;
}

export interface PasteResult {
  mappings: PasteMapping[];
  conflicts: string[];
  outOfBounds: number;
}

export interface SwapMapping {
  targetCellId: string;
  data: CellData;
  slideHeaderValues?: SlideHeaderSnapshot;
}

export interface SwapResult {
  pasteToTarget: SwapMapping[];
  moveToSource: SwapMapping[];
  sourceCellIds: string[];
  conflicts: string[];
  outOfBounds: number;
}
