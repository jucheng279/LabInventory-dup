import type { CentralizedInventoryData } from '../hooks/useCentralizedInventory';

export interface InventoryBoxEntry {
  boxId: string | null;
  boxName: string;
  boxType: 'freezer' | 'structured_freezer' | 'standalone' | 'item_sheet';
  boxAccentColor: string | null;
  folderName?: string;
  folderId?: string | null;
  itemId?: string | null;
  firstCellId?: string | null;
  locationId: string;
  sublocationId: string | null;
  positionId: string | null;
  count: number;
}

export interface InventoryLocationEntry {
  locationPath: string;
  locationId: string;
  sublocationId: string | null;
  positionId: string | null;
  boxes: InventoryBoxEntry[];
  totalCount: number;
}

export interface InventoryInfoEntry {
  infoKey: string;
  infoDisplay: string;
  infoFormat: 'single' | 'column';
  headerLabels?: string[];
  headerValues?: string[];
  date?: string | null;
  dateType?: string | null;
  locations: InventoryLocationEntry[];
  totalCount: number;
}

export interface InventoryNameGroup {
  name: string;
  infos: InventoryInfoEntry[];
  totalCount: number;
  hasInfoSubdivision: boolean;
  itemTypeIds: Set<string | null>;
}

export interface CentralizedInventorySummary {
  groups: InventoryNameGroup[];
  totalUniqueItems: number;
  totalCount: number;
}

export function computeCentralizedInventory(data: CentralizedInventoryData): CentralizedInventorySummary {
  const locationNameMap = new Map(data.locations.map(l => [l.id, l.name]));
  const sublocationNameMap = new Map(data.sublocations.map(s => [s.id, s.name]));
  const sublocationLocationMap = new Map(data.sublocations.map(s => [s.id, s.location_id]));
  const positionNameMap = new Map(data.positions.map(p => [p.id, p.name]));
  const positionSublocationMap = new Map(data.positions.map(p => [p.id, p.sublocation_id]));

  const boxMap = new Map(data.boxes.map(b => [b.id, b]));

  const headersByBox = new Map<string, typeof data.structuredHeaders>();
  for (const h of data.structuredHeaders) {
    if (!headersByBox.has(h.box_id)) headersByBox.set(h.box_id, []);
    headersByBox.get(h.box_id)!.push(h);
  }
  for (const arr of headersByBox.values()) {
    arr.sort((a, b) => a.display_order - b.display_order);
  }

  const structuredValuesByCell = new Map<string, Map<number, string>>();
  for (const v of data.structuredValues) {
    if (!structuredValuesByCell.has(v.cell_id)) structuredValuesByCell.set(v.cell_id, new Map());
    structuredValuesByCell.get(v.cell_id)!.set(v.display_order, v.value);
  }

  const headersByFolder = new Map<string, typeof data.folderHeaders>();
  for (const h of data.folderHeaders) {
    if (!headersByFolder.has(h.folder_id)) headersByFolder.set(h.folder_id, []);
    headersByFolder.get(h.folder_id)!.push(h);
  }
  for (const arr of headersByFolder.values()) {
    arr.sort((a, b) => a.display_order - b.display_order);
  }

  const folderCustomValuesByItem = new Map<string, Map<string, string>>();
  for (const v of data.folderCustomValues) {
    if (!folderCustomValuesByItem.has(v.item_id)) folderCustomValuesByItem.set(v.item_id, new Map());
    folderCustomValuesByItem.get(v.item_id)!.set(v.header_id, v.value);
  }

  const folderMap = new Map(data.folders.map(f => [f.id, f]));

  const linkedItemIds = new Set(data.boxGridItemLinks.map(l => l.item_id));

  function buildLocationPath(locationId: string, sublocationId: string | null, positionId: string | null): string {
    const parts: string[] = [];
    parts.push(locationNameMap.get(locationId) || 'Unknown');
    if (sublocationId) {
      parts.push(sublocationNameMap.get(sublocationId) || 'Unknown');
    }
    if (positionId) {
      parts.push(positionNameMap.get(positionId) || 'Unknown');
    }
    return parts.join(' > ');
  }

  function resolveLocationFromPosition(positionId: string): { locationId: string; sublocationId: string | null } {
    const subId = positionSublocationMap.get(positionId) || null;
    const locId = subId ? sublocationLocationMap.get(subId) || '' : '';
    return { locationId: locId, sublocationId: subId };
  }

  function resolveLocationFromSublocation(sublocationId: string): string {
    return sublocationLocationMap.get(sublocationId) || '';
  }

  interface RawEntry {
    name: string;
    infoKey: string;
    infoDisplay: string;
    infoFormat: 'single' | 'column';
    headerLabels?: string[];
    headerValues?: string[];
    date?: string | null;
    dateType?: string | null;
    locationId: string;
    sublocationId: string | null;
    positionId: string | null;
    boxId: string | null;
    boxName: string;
    boxType: 'freezer' | 'structured_freezer' | 'standalone' | 'item_sheet';
    boxAccentColor: string | null;
    folderName?: string;
    folderId?: string | null;
    itemId?: string | null;
    firstCellId?: string | null;
    count: number;
    itemTypeId?: string | null;
  }

  const entries: RawEntry[] = [];

  // Process freezer box cells (normal boxes)
  const freezerBoxIds = new Set(data.boxes.filter(b => b.box_type === 'freezer').map(b => b.id));
  const freezerCells = data.cells.filter(c => freezerBoxIds.has(c.box_id) && !c.is_crossed);

  const freezerGrouped = new Map<string, Map<string, number>>();
  for (const cell of freezerCells) {
    const name = (cell.name || '').trim();
    if (!name && !(cell.information || '').trim()) continue;
    const effectiveName = name || (cell.information || '').trim();
    const info = name ? (cell.information || '').trim() : '';
    const box = boxMap.get(cell.box_id)!;
    const key = `${effectiveName}\x00${info}\x00${cell.box_id}`;
    freezerGrouped.set(key, (freezerGrouped.get(key) || new Map()).set('count', (freezerGrouped.get(key)?.get('count') || 0) + 1));
  }

  // Simpler approach: iterate cells directly
  const freezerAgg = new Map<string, { count: number; date: string | null; dateType: string | null; firstCellId: string }>();
  for (const cell of freezerCells) {
    const name = (cell.name || '').trim();
    if (!name && !(cell.information || '').trim()) continue;
    const effectiveName = name || (cell.information || '').trim();
    const info = name ? (cell.information || '').trim() : '';
    const key = `${effectiveName}\x00${info}\x00${cell.date || ''}\x00${cell.date_type || ''}\x00${cell.box_id}`;
    const existing = freezerAgg.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      freezerAgg.set(key, { count: 1, date: cell.date || null, dateType: cell.date_type || null, firstCellId: cell.cell_id });
    }
  }

  for (const [key, { count, date, dateType, firstCellId }] of freezerAgg) {
    const parts = key.split('\x00');
    const effectiveName = parts[0];
    const info = parts[1];
    const boxId = parts[4];
    const box = boxMap.get(boxId)!;
    entries.push({
      name: effectiveName,
      infoKey: `${info}|||${date || ''}|||${dateType || ''}`,
      infoDisplay: info,
      infoFormat: 'single',
      date,
      dateType,
      locationId: box.location_id,
      sublocationId: box.sublocation_id,
      positionId: box.position_id,
      boxId,
      boxName: box.name,
      boxType: 'freezer',
      boxAccentColor: box.accent_color,
      firstCellId,
      count,
    });
  }

  // Process structured freezer box cells
  const structuredBoxIds = new Set(data.boxes.filter(b => b.box_type === 'structured_freezer').map(b => b.id));
  const structuredCells = data.cells.filter(c => structuredBoxIds.has(c.box_id) && !c.is_crossed);

  const structuredAgg = new Map<string, { count: number; entry: Omit<RawEntry, 'count'> }>();
  for (const cell of structuredCells) {
    const name = (cell.name || '').trim();
    const cellValues = structuredValuesByCell.get(cell.cell_id);
    const hasAnyValue = name || (cellValues && Array.from(cellValues.values()).some(v => v.trim()));
    if (!hasAnyValue) continue;

    const box = boxMap.get(cell.box_id)!;
    const headers = headersByBox.get(cell.box_id) || [];
    const effectiveName = name || headers.map(h => (cellValues?.get(h.display_order) || '').trim()).filter(Boolean).join(' / ') || 'Unnamed';

    const headerLabels = headers.map(h => h.header_text);
    const headerVals = headers.map(h => (cellValues?.get(h.display_order) || '').trim());
    const infoKey = headerVals.join('|||');
    const infoDisplay = headers.map((h, i) => headerVals[i] ? `${h.header_text}: ${headerVals[i]}` : '').filter(Boolean).join(', ');

    const aggKey = `${effectiveName}\x00${infoKey}\x00${cell.box_id}`;
    const existing = structuredAgg.get(aggKey);
    if (existing) {
      existing.count++;
    } else {
      structuredAgg.set(aggKey, {
        count: 1,
        entry: {
          name: effectiveName,
          infoKey,
          infoDisplay,
          infoFormat: 'column',
          headerLabels,
          headerValues: headerVals,
          locationId: box.location_id,
          sublocationId: box.sublocation_id,
          positionId: box.position_id,
          boxId: cell.box_id,
          boxName: box.name,
          boxType: 'structured_freezer',
          boxAccentColor: box.accent_color,
          firstCellId: cell.cell_id,
        },
      });
    }
  }

  for (const { count, entry } of structuredAgg.values()) {
    entries.push({ ...entry, count });
  }

  // Process standalone items (skip linked ones)
  for (const item of data.standaloneItems) {
    if (linkedItemIds.has(item.id)) continue;
    const name = (item.name || '').trim();
    if (!name) continue;
    const info = (item.note || '').trim();

    entries.push({
      name,
      infoKey: `${info}|||${item.date || ''}|||${item.date_type || ''}`,
      infoDisplay: info,
      infoFormat: 'single',
      date: item.date || null,
      dateType: item.date_type || null,
      locationId: item.location_id,
      sublocationId: item.sublocation_id,
      positionId: item.position_id,
      boxId: null,
      boxName: 'Standalone Item',
      boxType: 'standalone',
      boxAccentColor: null,
      itemId: item.id,
      count: item.stock_number,
      itemTypeId: item.item_type_id ?? null,
    });
  }

  // Process folder (item sheet) items (skip linked ones)
  for (const item of data.folderItems) {
    if (linkedItemIds.has(item.id)) continue;
    const name = (item.name || '').trim();
    if (!name) continue;

    const folder = folderMap.get(item.folder_id!);
    if (!folder) continue;

    const headers = headersByFolder.get(item.folder_id!) || [];
    const customVals = folderCustomValuesByItem.get(item.id);

    const headerLabels = headers.map(h => h.header_text);
    const headerVals = headers.map(h => (customVals?.get(h.id) || '').trim());
    const infoKey = headerVals.join('|||');
    const infoDisplay = headers.map((h, i) => headerVals[i] ? `${h.header_text}: ${headerVals[i]}` : '').filter(Boolean).join(', ');

    entries.push({
      name,
      infoKey,
      infoDisplay,
      infoFormat: 'column',
      headerLabels,
      headerValues: headerVals,
      locationId: folder.location_id,
      sublocationId: folder.sublocation_id,
      positionId: folder.position_id,
      boxId: null,
      boxName: folder.name,
      boxType: 'item_sheet',
      boxAccentColor: null,
      folderName: folder.name,
      folderId: folder.id,
      itemId: item.id,
      count: item.stock_number,
      itemTypeId: item.item_type_id ?? null,
    });
  }

  // Build the nested group structure
  const nameMap = new Map<string, Map<string, Map<string, Map<string, RawEntry>>>>();

  for (const entry of entries) {
    const locationPath = buildLocationPath(entry.locationId, entry.sublocationId, entry.positionId);
    const locationKey = `${entry.locationId}|${entry.sublocationId || ''}|${entry.positionId || ''}`;
    const boxKey = entry.boxId
      || (entry.itemId ? `${entry.boxType}:${entry.itemId}` : `${entry.boxType}:${entry.boxName}`);
    const infoGroupKey = `${entry.infoFormat}:${entry.infoKey}`;

    if (!nameMap.has(entry.name)) nameMap.set(entry.name, new Map());
    const infoMap = nameMap.get(entry.name)!;

    if (!infoMap.has(infoGroupKey)) infoMap.set(infoGroupKey, new Map());
    const locMap = infoMap.get(infoGroupKey)!;

    if (!locMap.has(locationKey)) locMap.set(locationKey, new Map());
    const boxMap2 = locMap.get(locationKey)!;

    const existing = boxMap2.get(boxKey);
    if (existing) {
      existing.count += entry.count;
    } else {
      boxMap2.set(boxKey, { ...entry });
    }
  }

  // Convert to final structure
  const groups: InventoryNameGroup[] = [];
  let totalCount = 0;

  const sortedNames = Array.from(nameMap.keys()).sort((a, b) => a.localeCompare(b));

  for (const name of sortedNames) {
    const infoMap = nameMap.get(name)!;
    const infos: InventoryInfoEntry[] = [];
    let nameTotal = 0;

    const sortedInfoKeys = Array.from(infoMap.keys()).sort((a, b) => a.localeCompare(b));

    for (const infoGroupKey of sortedInfoKeys) {
      const locMap = infoMap.get(infoGroupKey)!;
      const locations: InventoryLocationEntry[] = [];
      let infoTotal = 0;

      const firstEntry = Array.from(Array.from(locMap.values())[0].values())[0];
      const infoFormat = firstEntry.infoFormat;
      const infoDisplay = firstEntry.infoDisplay;
      const headerLabels = firstEntry.headerLabels;
      const headerValues = firstEntry.headerValues;
      const date = firstEntry.date;
      const dateType = firstEntry.dateType;

      for (const [locationKey, boxMap2] of locMap) {
        const [locationId, sublocationId, positionId] = locationKey.split('|');
        const locationPath = buildLocationPath(locationId, sublocationId || null, positionId || null);
        const boxEntries: InventoryBoxEntry[] = [];
        let locTotal = 0;

        for (const entry of boxMap2.values()) {
          boxEntries.push({
            boxId: entry.boxId,
            boxName: entry.boxName,
            boxType: entry.boxType,
            boxAccentColor: entry.boxAccentColor,
            folderName: entry.folderName,
            folderId: entry.folderId,
            itemId: entry.itemId,
            firstCellId: entry.firstCellId,
            locationId: entry.locationId,
            sublocationId: entry.sublocationId,
            positionId: entry.positionId,
            count: entry.count,
          });
          locTotal += entry.count;
        }

        boxEntries.sort((a, b) => a.boxName.localeCompare(b.boxName));
        locations.push({
          locationPath,
          locationId,
          sublocationId: sublocationId || null,
          positionId: positionId || null,
          boxes: boxEntries,
          totalCount: locTotal,
        });
        infoTotal += locTotal;
      }

      locations.sort((a, b) => a.locationPath.localeCompare(b.locationPath));
      infos.push({
        infoKey: infoGroupKey.split(':').slice(1).join(':'),
        infoDisplay,
        infoFormat,
        headerLabels,
        headerValues,
        date,
        dateType,
        locations,
        totalCount: infoTotal,
      });
      nameTotal += infoTotal;
    }

    const hasInfoSubdivision = infos.length > 1 || (infos.length === 1 && (!!infos[0].infoDisplay || !!infos[0].date));
    const itemTypeIds = new Set<string | null>();
    for (const infoGrp of infoMap.values()) {
      for (const locGrp of infoGrp.values()) {
        for (const entry of locGrp.values()) {
          itemTypeIds.add(entry.itemTypeId ?? null);
        }
      }
    }
    groups.push({ name, infos, totalCount: nameTotal, hasInfoSubdivision, itemTypeIds });
    totalCount += nameTotal;
  }

  return {
    groups,
    totalUniqueItems: groups.length,
    totalCount,
  };
}
