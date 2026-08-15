import type { CellData, SlideValuesMap, SlideBoxHeader } from '../types/database';
import type { ContentVariant, ContentGroup, BoxContentSummary, CellField, FieldMatchStatus, PartialCellMatch, ColorByField, GroupingMethod } from '../types/ui';

export type { ContentVariant, ContentGroup, BoxContentSummary } from '../types/ui';

function normalizeColor(color: string | null | undefined): string | null {
  if (!color) return null;
  return color;
}

export function getExpirationColor(dateString: string | null): string {
  if (!dateString) return 'text-gray-500';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(dateString + 'T00:00:00');
  if (isNaN(expDate.getTime())) return 'text-gray-500';
  if (expDate < today) return 'text-red-500';
  const threeMonths = new Date(today);
  threeMonths.setMonth(threeMonths.getMonth() + 3);
  if (expDate <= threeMonths) return 'text-amber-500';
  return 'text-emerald-600';
}

export function getEffectiveName(cell: CellData): string {
  if (cell.name && cell.name.trim()) {
    return cell.name.trim();
  }
  return cell.information?.trim() || '';
}

export function isValidCell(cell: CellData): boolean {
  const hasName = cell.name && cell.name.trim().length > 0;
  const hasInfo = cell.information && cell.information.trim().length > 0;
  return (hasName || hasInfo) && !cell.is_crossed;
}

export function computeBoxContentSummary(cellData: Record<string, CellData>): BoxContentSummary {
  const validCells = Object.values(cellData).filter(isValidCell);

  if (validCells.length === 0) {
    return { groups: [], totalUniqueReagents: 0, totalValidWells: 0 };
  }

  const groupMap = new Map<string, Map<string, number>>();
  const infoOnlyGroups = new Set<string>();

  for (const cell of validCells) {
    const effectiveName = getEffectiveName(cell);
    const hasNameField = cell.name && cell.name.trim().length > 0;
    const variantInfo = hasNameField ? (cell.information?.trim() || '') : '';
    const variantKey = `${variantInfo}|||${cell.date || ''}|||${cell.date_type || 'date'}`;

    if (!groupMap.has(effectiveName)) {
      groupMap.set(effectiveName, new Map());
      if (!hasNameField) infoOnlyGroups.add(effectiveName);
    } else if (hasNameField) {
      infoOnlyGroups.delete(effectiveName);
    }
    const variantMap = groupMap.get(effectiveName)!;
    variantMap.set(variantKey, (variantMap.get(variantKey) || 0) + 1);
  }

  const groups: ContentGroup[] = [];

  for (const [effectiveName, variantMap] of groupMap) {
    const variants: ContentVariant[] = [];
    let totalCount = 0;

    for (const [variantKey, count] of variantMap) {
      const [information, date, date_type] = variantKey.split('|||');
      variants.push({ information, date, date_type, wellCount: count });
      totalCount += count;
    }

    variants.sort((a, b) => {
      if (a.information !== b.information) {
        return a.information.localeCompare(b.information);
      }
      return a.date.localeCompare(b.date);
    });

    groups.push({ effectiveName, variants, totalCount, isInfoOnly: infoOnlyGroups.has(effectiveName) });
  }

  groups.sort((a, b) => a.effectiveName.localeCompare(b.effectiveName));

  return {
    groups,
    totalUniqueReagents: groups.length,
    totalValidWells: validCells.length
  };
}

export type { CellField, FieldMatchStatus, PartialCellMatch } from '../types/ui';

export interface StructuredVariant {
  headerValues: Record<number, string>;
  wellCount: number;
}

export interface StructuredContentGroup {
  effectiveName: string;
  variants: StructuredVariant[];
  totalCount: number;
  isInfoOnly?: boolean;
}

export interface StructuredBoxContentSummary {
  groups: StructuredContentGroup[];
  totalUniqueReagents: number;
  totalValidWells: number;
}

function isValidStructuredCell(
  cell: CellData,
  cellId: string,
  slideValues: SlideValuesMap
): boolean {
  if (cell.is_crossed) return false;
  if (cell.name && cell.name.trim().length > 0) return true;
  const vals = slideValues[cellId];
  if (vals) {
    for (const v of Object.values(vals)) {
      if (v && v.trim().length > 0) return true;
    }
  }
  return false;
}

export function computeStructuredBoxContentSummary(
  cellData: Record<string, CellData>,
  headers: SlideBoxHeader[],
  slideValues: SlideValuesMap
): StructuredBoxContentSummary {
  const validEntries = Object.entries(cellData).filter(
    ([cellId, cell]) => isValidStructuredCell(cell, cellId, slideValues)
  );

  if (validEntries.length === 0) {
    return { groups: [], totalUniqueReagents: 0, totalValidWells: 0 };
  }

  const sortedHeaders = [...headers].sort((a, b) => a.display_order - b.display_order);
  const groupMap = new Map<string, Map<string, number>>();
  const infoOnlyGroups = new Set<string>();

  for (const [cellId, cell] of validEntries) {
    const hasNameField = cell.name && cell.name.trim().length > 0;
    const effectiveName = hasNameField
      ? cell.name!.trim()
      : sortedHeaders.map(h => (slideValues[cellId]?.[h.display_order] ?? '').trim()).filter(Boolean).join(' / ') || 'Unnamed';
    const vals = slideValues[cellId] || {};
    const variantKey = sortedHeaders.map(h => vals[h.display_order] ?? '').join('|||');

    if (!groupMap.has(effectiveName)) {
      groupMap.set(effectiveName, new Map());
      if (!hasNameField) infoOnlyGroups.add(effectiveName);
    } else if (hasNameField) {
      infoOnlyGroups.delete(effectiveName);
    }
    groupMap.get(effectiveName)!.set(variantKey, (groupMap.get(effectiveName)!.get(variantKey) || 0) + 1);
  }

  const groups: StructuredContentGroup[] = [];

  for (const [effectiveName, variantMap] of groupMap) {
    const variants: StructuredVariant[] = [];
    let totalCount = 0;

    for (const [variantKey, count] of variantMap) {
      const parts = variantKey.split('|||');
      const headerValues: Record<number, string> = {};
      sortedHeaders.forEach((h, i) => {
        headerValues[h.display_order] = parts[i] || '';
      });
      variants.push({ headerValues, wellCount: count });
      totalCount += count;
    }

    variants.sort((a, b) => {
      for (const h of sortedHeaders) {
        const cmp = (a.headerValues[h.display_order] || '').localeCompare(b.headerValues[h.display_order] || '');
        if (cmp !== 0) return cmp;
      }
      return 0;
    });

    groups.push({ effectiveName, variants, totalCount, isInfoOnly: infoOnlyGroups.has(effectiveName) });
  }

  groups.sort((a, b) => a.effectiveName.localeCompare(b.effectiveName));

  return {
    groups,
    totalUniqueReagents: groups.length,
    totalValidWells: validEntries.length
  };
}

export function detectCommonCellData(
  selectedCells: Set<string>,
  cellData: Record<string, CellData>
): PartialCellMatch {
  const noMatch: PartialCellMatch = {
    data: { name: '', information: '', date: null, color: null, date_type: 'date' },
    fieldStatus: { name: false, information: false, date: false, color: false, dateType: false },
    hasAnyData: false,
    allMatch: false,
  };

  const selectedCellsWithData = Array.from(selectedCells).filter(
    cellId => cellData[cellId]
  );

  if (selectedCellsWithData.length === 0) {
    return noMatch;
  }

  const first = cellData[selectedCellsWithData[0]];
  const firstColor = normalizeColor(first.color);
  const firstDateType = first.date_type || 'date';

  let nameMatch = true;
  let infoMatch = true;
  let dateMatch = true;
  let colorMatch = true;
  let dateTypeMatch = true;

  for (let i = 1; i < selectedCellsWithData.length; i++) {
    const cell = cellData[selectedCellsWithData[i]];
    if (nameMatch && cell.name !== first.name) nameMatch = false;
    if (infoMatch && cell.information !== first.information) infoMatch = false;
    if (dateMatch && cell.date !== first.date) dateMatch = false;
    if (colorMatch && normalizeColor(cell.color) !== firstColor) colorMatch = false;
    if (dateTypeMatch && (cell.date_type || 'date') !== firstDateType) dateTypeMatch = false;
  }

  const fieldStatus: FieldMatchStatus = {
    name: nameMatch,
    information: infoMatch,
    date: dateMatch,
    color: colorMatch,
    dateType: dateTypeMatch,
  };

  const data: CellData = {
    name: nameMatch ? first.name : '',
    information: infoMatch ? first.information : '',
    date: dateMatch ? first.date : null,
    color: colorMatch ? (first.color || null) : null,
    date_type: dateTypeMatch ? firstDateType : 'date',
  };

  const allMatch = nameMatch && infoMatch && dateMatch && colorMatch && dateTypeMatch;

  return { data, fieldStatus, hasAnyData: true, allMatch };
}

export function detectIdenticalCellData(
  selectedCells: Set<string>,
  cellData: Record<string, CellData>
): CellData | null {
  const result = detectCommonCellData(selectedCells, cellData);
  return result.allMatch && result.hasAnyData ? { ...result.data } : null;
}

const AUTO_COLOR_PALETTE = [
  '#FECACA', '#FED7AA', '#FDE68A', '#FEF3C7', '#D9F99D',
  '#BBF7D0', '#A7F3D0', '#A5F3FC', '#BAE6FD', '#BFDBFE',
  '#DDD6FE', '#FBCFE8', '#D1D5DB',
];

export type { ColorByField } from '../types/ui';

const EMPTY_GROUP_KEY = '\x00__empty__';

export interface StructuredContext {
  slideValues: SlideValuesMap;
  headers: SlideBoxHeader[];
}

function getStructuredFieldValue(
  cellId: string,
  field: ColorByField,
  cell: CellData,
  ctx?: StructuredContext
): string {
  if (field === 'name') return (cell.name ?? '').trim();

  if (!ctx) return (cell[field] ?? '').toString().trim();

  const { slideValues, headers } = ctx;
  const cellValues = slideValues[cellId] || {};

  if (field === 'information') {
    const textHeaders = headers.filter(h => h.header_type === 'text' || h.header_type === 'preset').sort((a, b) => a.display_order - b.display_order);
    return textHeaders.map(h => (cellValues[h.display_order] ?? '').trim()).filter(Boolean).join(' | ');
  }

  if (field === 'date') {
    const dateHeaders = headers.filter(h => h.header_type === 'date' || h.header_type === 'expiration').sort((a, b) => a.display_order - b.display_order);
    return dateHeaders.map(h => (cellValues[h.display_order] ?? '').trim()).filter(Boolean).join(' | ');
  }

  return '';
}

function detectGroupMajorityColor(
  cellIds: string[],
  cellData: Record<string, CellData>
): string | null {
  const colorCounts = new Map<string, number>();
  let totalWithColor = 0;

  for (const cellId of cellIds) {
    const color = normalizeColor(cellData[cellId]?.color);
    if (color) {
      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
      totalWithColor++;
    }
  }

  if (totalWithColor === 0) return null;

  let bestColor: string | null = null;
  let bestCount = 0;
  for (const [color, count] of colorCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestColor = color;
    }
  }

  if (bestColor && bestCount > cellIds.length / 2) {
    return bestColor;
  }

  return null;
}

export function computeAutoColorMap(
  cellData: Record<string, CellData>,
  filters: ColorByField[],
  ctx?: StructuredContext
): Record<string, string> {
  if (filters.length === 0) return {};

  const groupKeys = new Map<string, string[]>();

  for (const [cellId, cell] of Object.entries(cellData)) {
    if (cell.is_crossed) continue;
    const parts = filters.map(f => getStructuredFieldValue(cellId, f, cell, ctx));
    const key = parts.every(p => p === '') ? EMPTY_GROUP_KEY : parts.join('|||');

    if (!groupKeys.has(key)) {
      groupKeys.set(key, []);
    }
    groupKeys.get(key)!.push(cellId);
  }

  const sortedKeys = Array.from(groupKeys.keys()).sort((a, b) => {
    if (a === EMPTY_GROUP_KEY) return 1;
    if (b === EMPTY_GROUP_KEY) return -1;
    return a.localeCompare(b);
  });

  const claimedColors = new Set<string>();
  const groupColors = new Map<string, string>();

  for (const key of sortedKeys) {
    const cellIds = groupKeys.get(key)!;
    const majorityColor = detectGroupMajorityColor(cellIds, cellData);
    if (majorityColor && !claimedColors.has(majorityColor)) {
      groupColors.set(key, majorityColor);
      claimedColors.add(majorityColor);
    }
  }

  let paletteIndex = 0;
  for (const key of sortedKeys) {
    if (groupColors.has(key)) continue;

    while (paletteIndex < AUTO_COLOR_PALETTE.length && claimedColors.has(AUTO_COLOR_PALETTE[paletteIndex])) {
      paletteIndex++;
    }

    const color = AUTO_COLOR_PALETTE[paletteIndex % AUTO_COLOR_PALETTE.length];
    groupColors.set(key, color);
    claimedColors.add(color);
    paletteIndex++;
  }

  const result: Record<string, string> = {};
  for (const key of sortedKeys) {
    const color = groupColors.get(key)!;
    for (const cellId of groupKeys.get(key)!) {
      result[cellId] = color;
    }
  }

  return result;
}

export type { GroupingMethod } from '../types/ui';

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRST';

function makeCellId(rowIndex: number, colIndex: number): string {
  return `${ROW_LABELS[rowIndex]}${colIndex + 1}`;
}

function snakePositions(rows: number, columns: number): string[] {
  const positions: string[] = [];
  for (let r = 0; r < rows; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < columns; c++) positions.push(makeCellId(r, c));
    } else {
      for (let c = columns - 1; c >= 0; c--) positions.push(makeCellId(r, c));
    }
  }
  return positions;
}

function linearPositions(rows: number, columns: number): string[] {
  const positions: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) positions.push(makeCellId(r, c));
  }
  return positions;
}

function sortGroupKeys(keys: string[]): string[] {
  return keys.sort((a, b) => {
    if (a === EMPTY_GROUP_KEY) return 1;
    if (b === EMPTY_GROUP_KEY) return -1;
    return a.localeCompare(b);
  });
}

function groupCellsByFilters(
  cellData: Record<string, CellData>,
  filters: ColorByField[],
  ctx?: StructuredContext
): { groups: Map<string, { cellId: string; data: CellData }[]>; unmatchedCells: { cellId: string; data: CellData }[] } {
  const groups = new Map<string, { cellId: string; data: CellData }[]>();
  const unmatchedCells: { cellId: string; data: CellData }[] = [];

  for (const [cellId, cell] of Object.entries(cellData)) {
    if (cell.is_crossed) {
      unmatchedCells.push({ cellId, data: cell });
      continue;
    }

    const parts = filters.map(f => getStructuredFieldValue(cellId, f, cell, ctx));
    const key = parts.every(p => p === '') ? EMPTY_GROUP_KEY : parts.join('|||');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ cellId, data: cell });
  }

  for (const cells of groups.values()) {
    cells.sort((a, b) => a.cellId.localeCompare(b.cellId, undefined, { numeric: true }));
  }

  return { groups, unmatchedCells };
}

function fillGridWithPositions(
  groups: Map<string, { cellId: string; data: CellData }[]>,
  unmatchedCells: { cellId: string; data: CellData }[],
  positions: string[],
): Array<{ cellId: string; data: CellData }> {
  const sortedKeys = sortGroupKeys(Array.from(groups.keys()));

  const orderedCells: CellData[] = [];
  for (const key of sortedKeys) {
    for (const entry of groups.get(key)!) {
      orderedCells.push(entry.data);
    }
  }
  for (const entry of unmatchedCells) {
    orderedCells.push(entry.data);
  }

  const result: Array<{ cellId: string; data: CellData }> = [];
  for (let i = 0; i < orderedCells.length && i < positions.length; i++) {
    result.push({ cellId: positions[i], data: orderedCells[i] });
  }
  return result;
}

function layoutRowPerGroup(
  groups: Map<string, { cellId: string; data: CellData }[]>,
  unmatchedCells: { cellId: string; data: CellData }[],
  rows: number,
  columns: number
): Array<{ cellId: string; data: CellData }> {
  const occupied = new Set<string>();
  const result: Array<{ cellId: string; data: CellData }> = [];
  const sortedKeys = sortGroupKeys(Array.from(groups.keys()));
  const overflow: CellData[] = [];

  let currentRow = 0;

  for (const key of sortedKeys) {
    const cells = groups.get(key)!;
    if (cells.length === 0) continue;

    if (currentRow >= rows) {
      for (const entry of cells) overflow.push(entry.data);
      continue;
    }

    let placed = 0;
    let r = currentRow;
    while (placed < cells.length && r < rows) {
      for (let c = 0; c < columns && placed < cells.length; c++) {
        const pos = makeCellId(r, c);
        if (!occupied.has(pos)) {
          result.push({ cellId: pos, data: cells[placed].data });
          occupied.add(pos);
          placed++;
        }
      }
      if (placed < cells.length) r++;
    }

    for (let i = placed; i < cells.length; i++) {
      overflow.push(cells[i].data);
    }

    currentRow = r + 1;
  }

  for (const data of overflow) {
    let placed = false;
    for (let r = 0; r < rows && !placed; r++) {
      for (let c = columns - 1; c >= 0 && !placed; c--) {
        const pos = makeCellId(r, c);
        if (!occupied.has(pos)) {
          result.push({ cellId: pos, data });
          occupied.add(pos);
          placed = true;
        }
      }
    }
  }

  for (const entry of unmatchedCells) {
    let placed = false;
    for (let r = 0; r < rows && !placed; r++) {
      for (let c = 0; c < columns && !placed; c++) {
        const pos = makeCellId(r, c);
        if (!occupied.has(pos)) {
          result.push({ cellId: pos, data: entry.data });
          occupied.add(pos);
          placed = true;
        }
      }
    }
  }

  return result;
}

export function computeGroupedLayout(
  cellData: Record<string, CellData>,
  filters: ColorByField[],
  rows: number,
  columns: number,
  method: GroupingMethod,
  ctx?: StructuredContext
): Array<{ cellId: string; data: CellData }> {
  if (filters.length === 0) return [];

  const { groups, unmatchedCells } = groupCellsByFilters(cellData, filters, ctx);
  if (groups.size === 0) return [];

  if (method === 1) {
    return fillGridWithPositions(groups, unmatchedCells, snakePositions(rows, columns));
  }
  if (method === 3) {
    return fillGridWithPositions(groups, unmatchedCells, linearPositions(rows, columns));
  }
  return layoutRowPerGroup(groups, unmatchedCells, rows, columns);
}
