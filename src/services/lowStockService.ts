import { supabase } from '../lib/supabase';
import type { ItemType } from '../types/database';

export type LowStockSeverity = 'out' | 'critical' | 'low';

export interface LowStockRecord {
  id: string;
  name: string;
  note: string | null;
  itemType: ItemType;
  stockNumber: number;
  stockThreshold: number;
  unit: string;
  iconId: string | null;
  accentColor: string | null;
  locationId: string;
  locationName: string;
  locationAccentColor: string | null;
  sublocationId: string | null;
  sublocationName: string | null;
  positionId: string | null;
  positionName: string | null;
  folderId: string;
  folderName: string | null;
  folderAccentColor: string | null;
  severity: LowStockSeverity;
  ratio: number;
}

interface LowStockRow {
  id: string;
  name: string;
  note: string | null;
  item_type: ItemType;
  stock_number: number;
  stock_threshold: number;
  unit: string;
  icon_id: string | null;
  accent_color: string | null;
  location_id: string;
  sublocation_id: string | null;
  position_id: string | null;
  folder_id: string;
  locations: { id: string; name: string; accent_color: string | null; workspace_id: string | null } | null;
  sublocations: { id: string; name: string } | null;
  sublocation_positions: { id: string; name: string } | null;
  item_folders: { id: string; name: string; accent_color: string | null } | null;
}

export function classifySeverity(stock: number, threshold: number): LowStockSeverity {
  if (stock <= 0) return 'out';
  if (threshold > 0 && stock <= threshold * 0.5) return 'critical';
  return 'low';
}

export async function getLowStockItems(workspaceId: string): Promise<LowStockRecord[]> {
  if (!workspaceId) return [];

  const { data, error } = await supabase
    .from('inventory_items')
    .select(`
      id, name, note, item_type, stock_number, stock_threshold, unit, icon_id, accent_color,
      location_id, sublocation_id, position_id, folder_id,
      locations!inner ( id, name, accent_color, workspace_id ),
      sublocations ( id, name ),
      sublocation_positions ( id, name ),
      item_folders ( id, name, accent_color )
    `)
    .eq('non_counted', false)
    .not('stock_threshold', 'is', null)
    .eq('locations.workspace_id', workspaceId);

  if (error) throw error;

  const rows = (data ?? []) as unknown as LowStockRow[];

  const records: LowStockRecord[] = [];
  for (const r of rows) {
    if (!r.locations || r.locations.workspace_id !== workspaceId) continue;
    if (r.stock_threshold === null) continue;
    if (r.stock_number > r.stock_threshold) continue;

    const severity = classifySeverity(r.stock_number, r.stock_threshold);
    const ratio = r.stock_threshold > 0 ? r.stock_number / r.stock_threshold : 0;

    records.push({
      id: r.id,
      name: r.name,
      note: r.note,
      itemType: r.item_type,
      stockNumber: r.stock_number,
      stockThreshold: r.stock_threshold,
      unit: r.unit || '',
      iconId: r.icon_id,
      accentColor: r.accent_color,
      locationId: r.locations.id,
      locationName: r.locations.name,
      locationAccentColor: r.locations.accent_color,
      sublocationId: r.sublocations?.id ?? null,
      sublocationName: r.sublocations?.name ?? null,
      positionId: r.sublocation_positions?.id ?? null,
      positionName: r.sublocation_positions?.name ?? null,
      folderId: r.item_folders?.id ?? r.folder_id,
      folderName: r.item_folders?.name ?? null,
      folderAccentColor: r.item_folders?.accent_color ?? null,
      severity,
      ratio,
    });
  }

  records.sort((a, b) => {
    const severityRank: Record<LowStockSeverity, number> = { out: 0, critical: 1, low: 2 };
    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    if (a.ratio !== b.ratio) return a.ratio - b.ratio;
    return a.name.localeCompare(b.name);
  });

  return records;
}

export const severityMeta: Record<LowStockSeverity, { label: string; dot: string; chipBg: string; chipText: string; border: string; ring: string; bar: string }> = {
  out: {
    label: 'Out of Stock',
    dot: 'bg-red-500',
    chipBg: 'bg-red-50',
    chipText: 'text-red-700',
    border: 'border-red-200',
    ring: 'ring-red-200',
    bar: 'bg-red-500',
  },
  critical: {
    label: 'Critical',
    dot: 'bg-rose-500',
    chipBg: 'bg-rose-50',
    chipText: 'text-rose-700',
    border: 'border-rose-200',
    ring: 'ring-rose-200',
    bar: 'bg-rose-500',
  },
  low: {
    label: 'Low',
    dot: 'bg-amber-500',
    chipBg: 'bg-amber-50',
    chipText: 'text-amber-700',
    border: 'border-amber-200',
    ring: 'ring-amber-200',
    bar: 'bg-amber-500',
  },
};
