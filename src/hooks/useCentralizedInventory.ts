import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  Location,
  Sublocation,
  Position,
  LocationBox,
  InventoryItem,
  ItemFolder,
  ItemFolderHeader,
  SlideBoxHeader,
  BoxGridItemLink,
} from '../types/database';

export interface CentralizedInventoryData {
  locations: Location[];
  sublocations: Sublocation[];
  positions: Position[];
  boxes: LocationBox[];
  cells: { box_id: string; cell_id: string; name: string; information: string; date: string | null; date_type: string | null; is_crossed: boolean }[];
  structuredHeaders: SlideBoxHeader[];
  structuredValues: { cell_id: string; box_id: string; header_id: string; display_order: number; value: string }[];
  standaloneItems: InventoryItem[];
  folders: ItemFolder[];
  folderItems: InventoryItem[];
  folderHeaders: ItemFolderHeader[];
  folderCustomValues: { item_id: string; header_id: string; value: string }[];
  boxGridItemLinks: BoxGridItemLink[];
}

export const CENTRALIZED_INVENTORY_KEY = ['centralized-inventory'];

export function useCentralizedInventory() {
  return useQuery<CentralizedInventoryData>({
    queryKey: CENTRALIZED_INVENTORY_KEY,
    queryFn: fetchCentralizedInventory,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

async function fetchCentralizedInventory(): Promise<CentralizedInventoryData> {
  const [
    locationsRes,
    sublocationsRes,
    positionsRes,
    boxesRes,
    standaloneItemsRes,
    foldersRes,
    folderItemsRes,
    linksRes,
  ] = await Promise.all([
    supabase.from('locations').select('*').order('display_order'),
    supabase.from('sublocations').select('*').order('display_order'),
    supabase.from('sublocation_positions').select('*').order('display_order'),
    supabase.from('boxes').select('*').in('box_type', ['freezer', 'structured_freezer']),
    supabase.from('inventory_items').select('*').is('folder_id', null),
    supabase.from('item_folders').select('*').order('display_order'),
    supabase.from('inventory_items').select('*').not('folder_id', 'is', null),
    supabase.from('box_grid_item_links').select('*'),
  ]);

  if (locationsRes.error) throw locationsRes.error;
  if (sublocationsRes.error) throw sublocationsRes.error;
  if (positionsRes.error) throw positionsRes.error;
  if (boxesRes.error) throw boxesRes.error;
  if (standaloneItemsRes.error) throw standaloneItemsRes.error;
  if (foldersRes.error) throw foldersRes.error;
  if (folderItemsRes.error) throw folderItemsRes.error;
  if (linksRes.error) throw linksRes.error;

  const boxes: LocationBox[] = boxesRes.data || [];
  const boxIds = boxes.map(b => b.id);
  const structuredBoxIds = boxes.filter(b => b.box_type === 'structured_freezer').map(b => b.id);

  let cells: CentralizedInventoryData['cells'] = [];
  let structuredHeaders: SlideBoxHeader[] = [];
  let structuredValues: CentralizedInventoryData['structuredValues'] = [];

  if (boxIds.length > 0) {
    const cellsRes = await supabase
      .from('cells')
      .select('box_id, cell_id, name, information, date, date_type, is_crossed')
      .in('box_id', boxIds);
    if (cellsRes.error) throw cellsRes.error;
    cells = cellsRes.data || [];
  }

  if (structuredBoxIds.length > 0) {
    const headersRes = await supabase
      .from('slide_box_headers')
      .select('*')
      .in('box_id', structuredBoxIds);
    if (headersRes.error) throw headersRes.error;
    structuredHeaders = headersRes.data || [];

    const headerIds = structuredHeaders.map(h => h.id);
    if (headerIds.length > 0) {
      const cellIds = cells
        .filter(c => structuredBoxIds.includes(c.box_id))
        .map(c => c.cell_id);

      if (cellIds.length > 0) {
        const valuesRes = await supabase
          .from('slide_cell_values')
          .select('cell_id, header_id, value')
          .in('header_id', headerIds);
        if (valuesRes.error) throw valuesRes.error;

        const headerMap = new Map(structuredHeaders.map(h => [h.id, h]));
        structuredValues = (valuesRes.data || []).map(v => ({
          cell_id: v.cell_id,
          box_id: headerMap.get(v.header_id)?.box_id || '',
          header_id: v.header_id,
          display_order: headerMap.get(v.header_id)?.display_order || 0,
          value: v.value,
        }));
      }
    }
  }

  const folderIds = (foldersRes.data || []).map((f: ItemFolder) => f.id);
  let folderHeaders: ItemFolderHeader[] = [];
  let folderCustomValues: CentralizedInventoryData['folderCustomValues'] = [];

  if (folderIds.length > 0) {
    const fhRes = await supabase
      .from('item_folder_headers')
      .select('*')
      .in('folder_id', folderIds);
    if (fhRes.error) throw fhRes.error;
    folderHeaders = fhRes.data || [];

    const folderItemIds = (folderItemsRes.data || []).map((i: InventoryItem) => i.id);
    if (folderItemIds.length > 0) {
      const cvRes = await supabase
        .from('item_custom_values')
        .select('item_id, header_id, value')
        .in('item_id', folderItemIds);
      if (cvRes.error) throw cvRes.error;
      folderCustomValues = cvRes.data || [];
    }
  }

  return {
    locations: locationsRes.data || [],
    sublocations: sublocationsRes.data || [],
    positions: positionsRes.data || [],
    boxes,
    cells,
    structuredHeaders,
    structuredValues,
    standaloneItems: standaloneItemsRes.data || [],
    folders: foldersRes.data || [],
    folderItems: folderItemsRes.data || [],
    folderHeaders,
    folderCustomValues,
    boxGridItemLinks: linksRes.data || [],
  };
}
