import { supabase } from '../lib/supabase';
import type { BoxType } from '../types/database';

export type ExpirationSource = 'cell' | 'slide' | 'item';

export interface ExpirationRecord {
  id: string;
  source: ExpirationSource;
  name: string;
  expirationDate: string;
  locationId: string;
  locationName: string;
  locationAccentColor: string | null;
  sublocationId: string | null;
  sublocationName: string | null;
  positionId: string | null;
  positionName: string | null;
  boxId: string | null;
  boxName: string | null;
  boxAccentColor: string | null;
  boxIconId: string | null;
  boxType: BoxType | null;
  cellId: string | null;
  cellCoord: string | null;
  folderId: string | null;
  folderName: string | null;
  itemIconId: string | null;
  itemAccentColor: string | null;
  headerText: string | null;
  information: string | null;
}

function parseDateValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return null;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface CellRow {
  id: string;
  cell_id: string;
  name: string;
  information: string | null;
  date: string;
  box_id: string;
  boxes: {
    id: string;
    name: string;
    accent_color: string | null;
    icon_id: string | null;
    box_type: BoxType;
    location_id: string;
    sublocation_id: string | null;
    position_id: string | null;
    locations: { id: string; name: string; accent_color: string | null; workspace_id: string | null } | null;
    sublocations: { id: string; name: string } | null;
    sublocation_positions: { id: string; name: string } | null;
  } | null;
}

interface SlideValueRow {
  id: string;
  value: string;
  cell_id: string;
  header_id: string;
  slide_box_headers: {
    id: string;
    header_text: string;
    header_type: string;
    box_id: string;
    boxes: {
      id: string;
      name: string;
      accent_color: string | null;
      box_type: BoxType;
      location_id: string;
      sublocation_id: string | null;
      position_id: string | null;
      locations: { id: string; name: string; accent_color: string | null; workspace_id: string | null } | null;
      sublocations: { id: string; name: string } | null;
      sublocation_positions: { id: string; name: string } | null;
    } | null;
  } | null;
  cells: {
    id: string;
    cell_id: string;
    name: string;
  } | null;
}

interface ItemValueRow {
  id: string;
  value: string;
  item_id: string;
  header_id: string;
  item_folder_headers: {
    id: string;
    header_text: string;
    header_type: string;
  } | null;
  inventory_items: {
    id: string;
    name: string;
    note: string | null;
    folder_id: string;
    location_id: string;
    sublocation_id: string | null;
    position_id: string | null;
    icon_id: string | null;
    accent_color: string | null;
    item_folders: { id: string; name: string; accent_color: string | null } | null;
    locations: { id: string; name: string; accent_color: string | null; workspace_id: string | null } | null;
    sublocations: { id: string; name: string } | null;
    sublocation_positions: { id: string; name: string } | null;
  } | null;
}

async function fetchCellExpirations(workspaceId: string): Promise<ExpirationRecord[]> {
  const { data, error } = await supabase
    .from('cells')
    .select(`
      id, cell_id, name, information, date, box_id,
      boxes!inner (
        id, name, accent_color, icon_id, box_type, location_id, sublocation_id, position_id,
        locations!inner ( id, name, accent_color, workspace_id ),
        sublocations ( id, name ),
        sublocation_positions ( id, name )
      )
    `)
    .eq('date_type', 'expiration')
    .not('date', 'is', null)
    .eq('boxes.locations.workspace_id', workspaceId);

  if (error) throw error;

  const rows = (data ?? []) as unknown as CellRow[];
  return rows
    .filter((r) => r.boxes?.locations && r.boxes.locations.workspace_id === workspaceId)
    .map((r) => {
      const box = r.boxes!;
      const location = box.locations!;
      return {
        id: `cell-${r.id}`,
        source: 'cell' as const,
        name: r.name || '',
        expirationDate: r.date,
        locationId: location.id,
        locationName: location.name,
        locationAccentColor: location.accent_color,
        sublocationId: box.sublocations?.id ?? null,
        sublocationName: box.sublocations?.name ?? null,
        positionId: box.sublocation_positions?.id ?? null,
        positionName: box.sublocation_positions?.name ?? null,
        boxId: box.id,
        boxName: box.name,
        boxAccentColor: box.accent_color,
        boxIconId: box.icon_id ?? null,
        boxType: box.box_type,
        cellId: r.id,
        cellCoord: r.cell_id,
        folderId: null,
        folderName: null,
        itemIconId: null,
        itemAccentColor: null,
        headerText: null,
        information: r.information,
      };
    });
}

async function fetchSlideExpirations(workspaceId: string): Promise<ExpirationRecord[]> {
  const { data, error } = await supabase
    .from('slide_cell_values')
    .select(`
      id, value, cell_id, header_id,
      slide_box_headers!inner (
        id, header_text, header_type, box_id,
        boxes!inner (
          id, name, accent_color, icon_id, box_type, location_id, sublocation_id, position_id,
          locations!inner ( id, name, accent_color, workspace_id ),
          sublocations ( id, name ),
          sublocation_positions ( id, name )
        )
      ),
      cells ( id, cell_id, name )
    `)
    .eq('slide_box_headers.header_type', 'expiration')
    .neq('value', '')
    .eq('slide_box_headers.boxes.locations.workspace_id', workspaceId);

  if (error) throw error;

  const rows = (data ?? []) as unknown as SlideValueRow[];
  const records: ExpirationRecord[] = [];
  for (const r of rows) {
    const header = r.slide_box_headers;
    if (!header || header.header_type !== 'expiration') continue;
    const box = header.boxes;
    if (!box || !box.locations || box.locations.workspace_id !== workspaceId) continue;
    const parsed = parseDateValue(r.value);
    if (!parsed) continue;

    records.push({
      id: `slide-${r.id}`,
      source: 'slide',
      name: r.cells?.name || '',
      expirationDate: parsed,
      locationId: box.locations.id,
      locationName: box.locations.name,
      locationAccentColor: box.locations.accent_color,
      sublocationId: box.sublocations?.id ?? null,
      sublocationName: box.sublocations?.name ?? null,
      positionId: box.sublocation_positions?.id ?? null,
      positionName: box.sublocation_positions?.name ?? null,
      boxId: box.id,
      boxName: box.name,
      boxAccentColor: box.accent_color,
      boxIconId: box.icon_id ?? null,
      boxType: box.box_type,
      cellId: r.cells?.id ?? null,
      cellCoord: r.cells?.cell_id ?? null,
      folderId: null,
      folderName: null,
      itemIconId: null,
      itemAccentColor: null,
      headerText: header.header_text,
      information: header.header_text ?? null,
    });
  }
  return records;
}

async function fetchItemExpirations(workspaceId: string): Promise<ExpirationRecord[]> {
  const { data, error } = await supabase
    .from('item_custom_values')
    .select(`
      id, value, item_id, header_id,
      item_folder_headers!inner ( id, header_text, header_type ),
      inventory_items!inner (
        id, name, note, folder_id, location_id, sublocation_id, position_id, icon_id, accent_color,
        item_folders ( id, name, accent_color ),
        locations!inner ( id, name, accent_color, workspace_id ),
        sublocations ( id, name ),
        sublocation_positions ( id, name )
      )
    `)
    .eq('item_folder_headers.header_type', 'expiration')
    .neq('value', '')
    .eq('inventory_items.locations.workspace_id', workspaceId);

  if (error) throw error;

  const rows = (data ?? []) as unknown as ItemValueRow[];
  const records: ExpirationRecord[] = [];
  for (const r of rows) {
    const header = r.item_folder_headers;
    const item = r.inventory_items;
    if (!header || header.header_type !== 'expiration') continue;
    if (!item || !item.locations || item.locations.workspace_id !== workspaceId) continue;
    const parsed = parseDateValue(r.value);
    if (!parsed) continue;

    records.push({
      id: `item-${r.id}`,
      source: 'item',
      name: item.name,
      expirationDate: parsed,
      locationId: item.locations.id,
      locationName: item.locations.name,
      locationAccentColor: item.locations.accent_color,
      sublocationId: item.sublocations?.id ?? null,
      sublocationName: item.sublocations?.name ?? null,
      positionId: item.sublocation_positions?.id ?? null,
      positionName: item.sublocation_positions?.name ?? null,
      boxId: null,
      boxName: null,
      boxAccentColor: null,
      boxIconId: null,
      boxType: null,
      cellId: null,
      cellCoord: null,
      folderId: item.item_folders?.id ?? item.folder_id,
      folderName: item.item_folders?.name ?? null,
      itemIconId: item.icon_id ?? null,
      itemAccentColor: item.accent_color ?? null,
      headerText: header.header_text,
      information: item.note,
    });
  }
  return records;
}

export async function getAllExpirations(workspaceId: string): Promise<ExpirationRecord[]> {
  if (!workspaceId) return [];
  const [cells, slides, items] = await Promise.all([
    fetchCellExpirations(workspaceId),
    fetchSlideExpirations(workspaceId),
    fetchItemExpirations(workspaceId),
  ]);
  const all = [...cells, ...slides, ...items];
  all.sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
  return all;
}

export function getDaysUntil(expirationDate: string, today: Date = new Date()): number {
  const target = new Date(expirationDate + 'T00:00:00');
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = target.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export type UrgencyBucket = 'expired' | 'week' | 'month' | 'quarter' | 'later';

export function getUrgency(days: number): UrgencyBucket {
  if (days < 0) return 'expired';
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  if (days <= 90) return 'quarter';
  return 'later';
}

export const urgencyMeta: Record<UrgencyBucket, { label: string; dot: string; chipBg: string; chipText: string; border: string; ring: string }> = {
  expired: {
    label: 'Expired',
    dot: 'bg-red-500',
    chipBg: 'bg-red-50',
    chipText: 'text-red-700',
    border: 'border-red-200',
    ring: 'ring-red-200',
  },
  week: {
    label: 'This Week',
    dot: 'bg-orange-500',
    chipBg: 'bg-orange-50',
    chipText: 'text-orange-700',
    border: 'border-orange-200',
    ring: 'ring-orange-200',
  },
  month: {
    label: 'This Month',
    dot: 'bg-amber-500',
    chipBg: 'bg-amber-50',
    chipText: 'text-amber-700',
    border: 'border-amber-200',
    ring: 'ring-amber-200',
  },
  quarter: {
    label: 'Next 3 Months',
    dot: 'bg-yellow-500',
    chipBg: 'bg-yellow-50',
    chipText: 'text-yellow-800',
    border: 'border-yellow-200',
    ring: 'ring-yellow-200',
  },
  later: {
    label: 'Later',
    dot: 'bg-emerald-500',
    chipBg: 'bg-emerald-50',
    chipText: 'text-emerald-700',
    border: 'border-emerald-200',
    ring: 'ring-emerald-200',
  },
};

export function formatDaysLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `In ${days} days`;
}

export function formatDateDisplay(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
