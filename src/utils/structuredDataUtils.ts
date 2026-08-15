import type { CellData, SlideBoxHeader, SlideValuesMap } from '../types/database';

export interface StructuredFieldMatchStatus {
  name: boolean;
  headerFields: Record<number, boolean>;
  color: boolean;
}

export interface StructuredPartialMatch {
  name: string;
  headerValues: Record<number, string>;
  color: string | null;
  fieldStatus: StructuredFieldMatchStatus;
  hasAnyData: boolean;
  allMatch: boolean;
}

function normalizeColor(color: string | null | undefined): string | null {
  if (!color) return null;
  return color;
}

export function detectCommonStructuredData(
  selectedCells: Set<string>,
  cellData: Record<string, CellData>,
  slideValues: SlideValuesMap,
  headers: SlideBoxHeader[],
): StructuredPartialMatch {
  const empty: StructuredPartialMatch = {
    name: '',
    headerValues: {},
    color: null,
    fieldStatus: {
      name: false,
      headerFields: Object.fromEntries(headers.map(h => [h.display_order, false])),
      color: false,
    },
    hasAnyData: false,
    allMatch: false,
  };

  const selectedWithData = Array.from(selectedCells).filter(
    cellId => cellData[cellId] || slideValues[cellId],
  );
  if (selectedWithData.length === 0) return empty;

  const firstCell = cellData[selectedWithData[0]];
  const firstVals = slideValues[selectedWithData[0]] || {};
  const firstName = firstCell?.name || '';
  const firstColor = normalizeColor(firstCell?.color);

  let nameMatch = true;
  let colorMatch = true;
  const headerMatches: Record<number, boolean> = {};
  for (const h of headers) headerMatches[h.display_order] = true;

  for (let i = 1; i < selectedWithData.length; i++) {
    const cell = cellData[selectedWithData[i]];
    const vals = slideValues[selectedWithData[i]] || {};

    if (nameMatch && (cell?.name || '') !== firstName) nameMatch = false;
    if (colorMatch && normalizeColor(cell?.color) !== firstColor) colorMatch = false;

    for (const h of headers) {
      if (headerMatches[h.display_order]) {
        const a = firstVals[h.display_order] || '';
        const b = vals[h.display_order] || '';
        if (a !== b) headerMatches[h.display_order] = false;
      }
    }
  }

  const headerValues: Record<number, string> = {};
  for (const h of headers) {
    if (headerMatches[h.display_order]) {
      headerValues[h.display_order] = firstVals[h.display_order] || '';
    }
  }

  const allHeadersMatch = Object.values(headerMatches).every(Boolean);
  const allMatch = nameMatch && colorMatch && allHeadersMatch;

  return {
    name: nameMatch ? firstName : '',
    headerValues,
    color: colorMatch ? firstColor : null,
    fieldStatus: {
      name: nameMatch,
      headerFields: headerMatches,
      color: colorMatch,
    },
    hasAnyData: true,
    allMatch,
  };
}
