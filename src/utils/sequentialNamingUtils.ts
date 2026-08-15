import type { CellData } from '../types/database';

export interface SequentialRef {
  active: boolean;
  getNamesMap: () => Record<string, string> | undefined;
  infoActive: boolean;
  getInfoMap: () => Record<string, string> | undefined;
}

export interface SequentialCandidate {
  sourceCellId: string;
  prefix: string;
  startNumber: number;
  digitCount: number;
  emptyCellIds: string[];
  generatedNames: string[];
}

const TRAILING_DIGITS_RE = /^(.+?)(\d+)$/;

function parseCellId(cellId: string): { row: string; col: number } | null {
  const match = cellId.match(/^([A-Z])(\d+)$/);
  if (!match) return null;
  return { row: match[1], col: parseInt(match[2], 10) };
}

export function sortCellIdsGridOrder(cellIds: string[]): string[] {
  return [...cellIds].sort((a, b) => {
    const pa = parseCellId(a);
    const pb = parseCellId(b);
    if (!pa || !pb) return a.localeCompare(b);
    if (pa.row !== pb.row) return pa.row.charCodeAt(0) - pb.row.charCodeAt(0);
    return pa.col - pb.col;
  });
}

export function generateSequentialNames(
  prefix: string,
  startNumber: number,
  digitCount: number,
  count: number
): string[] {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const num = startNumber + 1 + i;
    const numStr = String(num);
    const padded = numStr.length < digitCount
      ? numStr.padStart(digitCount, '0')
      : numStr;
    names.push(prefix + padded);
  }
  return names;
}

export function detectSequentialCandidate(
  selectedCells: Set<string>,
  cellData: Record<string, CellData>
): SequentialCandidate | null {
  if (selectedCells.size < 2) return null;

  let sourceCellId: string | null = null;
  const emptyCellIds: string[] = [];

  for (const cellId of selectedCells) {
    const cell = cellData[cellId];
    const hasName = cell && cell.name && cell.name.trim().length > 0;
    if (hasName) {
      if (sourceCellId !== null) return null;
      sourceCellId = cellId;
    } else {
      emptyCellIds.push(cellId);
    }
  }

  if (!sourceCellId || emptyCellIds.length === 0) return null;

  const sourceName = cellData[sourceCellId].name.trim();
  const match = sourceName.match(TRAILING_DIGITS_RE);
  if (!match) return null;

  const prefix = match[1];
  const digitStr = match[2];
  const startNumber = parseInt(digitStr, 10);
  const digitCount = digitStr.length;

  const sortedEmpty = sortCellIdsGridOrder(emptyCellIds);
  const generatedNames = generateSequentialNames(prefix, startNumber, digitCount, sortedEmpty.length);

  return {
    sourceCellId,
    prefix,
    startNumber,
    digitCount,
    emptyCellIds: sortedEmpty,
    generatedNames,
  };
}

export function detectSequentialInfoCandidate(
  selectedCells: Set<string>,
  cellData: Record<string, CellData>
): SequentialCandidate | null {
  if (selectedCells.size < 2) return null;

  let sourceCellId: string | null = null;
  const emptyCellIds: string[] = [];

  for (const cellId of selectedCells) {
    const cell = cellData[cellId];
    const hasInfo = cell && cell.information && cell.information.trim().length > 0;
    if (hasInfo) {
      if (sourceCellId !== null) return null;
      sourceCellId = cellId;
    } else {
      emptyCellIds.push(cellId);
    }
  }

  if (!sourceCellId || emptyCellIds.length === 0) return null;

  const sourceInfo = cellData[sourceCellId].information!.trim();
  const match = sourceInfo.match(TRAILING_DIGITS_RE);
  if (!match) return null;

  const prefix = match[1];
  const digitStr = match[2];
  const startNumber = parseInt(digitStr, 10);
  const digitCount = digitStr.length;

  const sortedEmpty = sortCellIdsGridOrder(emptyCellIds);
  const generatedNames = generateSequentialNames(prefix, startNumber, digitCount, sortedEmpty.length);

  return {
    sourceCellId,
    prefix,
    startNumber,
    digitCount,
    emptyCellIds: sortedEmpty,
    generatedNames,
  };
}

export function buildSequentialNamesMap(
  candidate: SequentialCandidate
): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 0; i < candidate.emptyCellIds.length; i++) {
    map[candidate.emptyCellIds[i]] = candidate.generatedNames[i];
  }
  return map;
}
