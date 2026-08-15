import type { CellData, SlideBoxHeader, SlideValuesMap } from '../types/database';
import type { SlideFieldMatchStatus, SlidePartialMatch } from '../types/ui';

export type { SlideFieldMatchStatus, SlidePartialMatch } from '../types/ui';

function normalizeColor(color: string | null | undefined): string | null {
  if (!color) return null;
  return color;
}

export function detectCommonSlideData(
  selectedCells: Set<string>,
  cellData: Record<string, CellData>,
  slideValues: SlideValuesMap,
  headers: SlideBoxHeader[]
): SlidePartialMatch {
  const noMatch: SlidePartialMatch = {
    headerValues: {},
    color: null,
    fieldStatus: {
      headerFields: Object.fromEntries(headers.map(h => [h.display_order, false])),
      color: false,
    },
    hasAnyData: false,
    allMatch: false,
  };

  const selectedWithData = Array.from(selectedCells).filter(
    cellId => cellData[cellId] || slideValues[cellId]
  );

  if (selectedWithData.length === 0) return noMatch;

  const firstCell = cellData[selectedWithData[0]];
  const firstValues = slideValues[selectedWithData[0]] || {};
  const firstColor = normalizeColor(firstCell?.color);

  let colorMatch = true;
  const headerMatches: Record<number, boolean> = {};

  for (const h of headers) {
    headerMatches[h.display_order] = true;
  }

  for (let i = 1; i < selectedWithData.length; i++) {
    const cell = cellData[selectedWithData[i]];
    const vals = slideValues[selectedWithData[i]] || {};

    if (colorMatch && normalizeColor(cell?.color) !== firstColor) {
      colorMatch = false;
    }

    for (const h of headers) {
      if (headerMatches[h.display_order]) {
        const firstVal = firstValues[h.display_order] || '';
        const curVal = vals[h.display_order] || '';
        if (firstVal !== curVal) {
          headerMatches[h.display_order] = false;
        }
      }
    }
  }

  const headerValues: Record<number, string> = {};
  for (const h of headers) {
    if (headerMatches[h.display_order]) {
      headerValues[h.display_order] = firstValues[h.display_order] || '';
    }
  }

  const allHeadersMatch = Object.values(headerMatches).every(Boolean);
  const allMatch = allHeadersMatch && colorMatch;

  return {
    headerValues,
    color: colorMatch ? (firstColor || null) : null,
    fieldStatus: {
      headerFields: headerMatches,
      color: colorMatch,
    },
    hasAnyData: true,
    allMatch,
  };
}
