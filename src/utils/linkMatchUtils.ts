import type { BoxGridItemLink, CellData, SlideValuesMap, SlideBoxHeader } from '../types/database';

export function findNameLink(links: BoxGridItemLink[], name: string): BoxGridItemLink | undefined {
  return links.find(
    (l) => l.link_type === 'name' && l.linked_name.trim() === name.trim(),
  );
}

export function findInfoLink(
  links: BoxGridItemLink[],
  name: string,
  info: string,
  date: string | null = null,
  dateType: string = 'none',
): BoxGridItemLink | undefined {
  return links.find(
    (l) =>
      l.link_type === 'name_info' &&
      l.linked_name.trim() === name.trim() &&
      (l.linked_info || '').trim() === info.trim() &&
      (l.linked_date || '') === (date || '') &&
      (l.linked_date_type || 'none') === dateType,
  );
}

export function findInfoOnlyLink(
  links: BoxGridItemLink[],
  info: string,
  date: string | null = null,
  dateType: string = 'none',
): BoxGridItemLink | undefined {
  return links.find(
    (l) =>
      l.link_type === 'info' &&
      (l.linked_info || '').trim() === info.trim() &&
      (l.linked_date || '') === (date || '') &&
      (l.linked_date_type || 'none') === dateType,
  );
}

export function hasAnyVariantLink(links: BoxGridItemLink[], name: string): boolean {
  return links.some(
    (l) => l.link_type === 'name_info' && l.linked_name.trim() === name.trim(),
  );
}

export function findVariantLink(
  links: BoxGridItemLink[],
  name: string,
  info: string,
  date: string | null,
  dateType: string,
): BoxGridItemLink | undefined {
  return findInfoLink(links, name, info, date, dateType);
}

function findLinkForCell(
  links: BoxGridItemLink[],
  cellName: string,
  cellInfo: string,
  cellDate: string | null = null,
  cellDateType: string = 'none',
): BoxGridItemLink | undefined {
  const name = cellName.trim();
  const info = cellInfo.trim();
  return (
    findNameLink(links, name) ||
    findInfoLink(links, name, info, cellDate, cellDateType) ||
    findInfoOnlyLink(links, info, cellDate, cellDateType)
  );
}

function isCellEmpty(cell: CellData | undefined): boolean {
  if (!cell) return true;
  return !(cell.name?.trim()) && !(cell.information?.trim());
}

function isStructuredCellEmpty(
  cell: CellData | undefined,
  values: Record<number, string> | undefined,
): boolean {
  if (!cell) return true;
  const hasName = !!(cell.name?.trim());
  if (hasName) return false;
  if (!values) return true;
  return !Object.values(values).some(v => v.trim());
}

export function computeSelectionLinkState(
  selectedCells: Set<string>,
  cellData: Record<string, CellData>,
  links: BoxGridItemLink[],
): { allSelectedEmpty: boolean; singleLinkedItemId: string | null } {
  if (selectedCells.size === 0) {
    return { allSelectedEmpty: false, singleLinkedItemId: null };
  }

  let allEmpty = true;
  let linkedItemId: string | null = null;
  let consistent = true;

  for (const cellId of selectedCells) {
    const cell = cellData[cellId];
    if (!isCellEmpty(cell)) {
      allEmpty = false;
      const link = findLinkForCell(links, cell.name || '', cell.information || '', cell.date || null, cell.date_type || 'date');
      if (!link) {
        consistent = false;
      } else if (linkedItemId === null) {
        linkedItemId = link.item_id;
      } else if (linkedItemId !== link.item_id) {
        consistent = false;
      }
    }
  }

  return {
    allSelectedEmpty: allEmpty,
    singleLinkedItemId: consistent && linkedItemId ? linkedItemId : null,
  };
}

export function computeStructuredSelectionLinkState(
  selectedCells: Set<string>,
  cellData: Record<string, CellData>,
  slideValues: SlideValuesMap,
  links: BoxGridItemLink[],
  headers: SlideBoxHeader[],
): { allSelectedEmpty: boolean; singleLinkedItemId: string | null } {
  if (selectedCells.size === 0) {
    return { allSelectedEmpty: false, singleLinkedItemId: null };
  }

  const sortedHeaders = [...headers].sort((a, b) => a.display_order - b.display_order);

  let allEmpty = true;
  let linkedItemId: string | null = null;
  let consistent = true;

  for (const cellId of selectedCells) {
    const cell = cellData[cellId];
    const vals = slideValues[cellId];
    if (!isStructuredCellEmpty(cell, vals)) {
      allEmpty = false;
      const cellName = (cell?.name || '').trim();
      const variantInfo = sortedHeaders.map(h => (vals?.[h.display_order] ?? '').trim()).join('|||');
      const link =
        findNameLink(links, cellName) ||
        (variantInfo ? findInfoLink(links, cellName, variantInfo) : undefined) ||
        (variantInfo ? findInfoOnlyLink(links, variantInfo) : undefined);
      if (!link) {
        consistent = false;
      } else if (linkedItemId === null) {
        linkedItemId = link.item_id;
      } else if (linkedItemId !== link.item_id) {
        consistent = false;
      }
    }
  }

  return {
    allSelectedEmpty: allEmpty,
    singleLinkedItemId: consistent && linkedItemId ? linkedItemId : null,
  };
}
