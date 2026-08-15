export interface BoxMeta {
  boxId: string;
  boxName: string;
  boxAccentColor: string | null;
  locationName: string;
  sublocationName: string | null;
  positionName: string | null;
}

export type BoxGroupItem<T> =
  | { kind: 'single'; item: T; index: number }
  | { kind: 'group'; meta: BoxMeta; items: { item: T; index: number }[] };

export function groupByBox<T extends { boxId: string; boxName: string; boxAccentColor: string | null; locationName: string; sublocationName: string | null; positionName: string | null }>(
  results: T[],
): BoxGroupItem<T>[] {
  const groups = new Map<string, { meta: BoxMeta; items: { item: T; index: number }[] }>();
  const order: string[] = [];

  results.forEach((item, index) => {
    const key = item.boxId;
    if (!groups.has(key)) {
      groups.set(key, {
        meta: {
          boxId: item.boxId,
          boxName: item.boxName,
          boxAccentColor: item.boxAccentColor,
          locationName: item.locationName,
          sublocationName: item.sublocationName,
          positionName: item.positionName,
        },
        items: [],
      });
      order.push(key);
    }
    groups.get(key)!.items.push({ item, index });
  });

  return order.map((key) => {
    const group = groups.get(key)!;
    if (group.items.length === 1) {
      return { kind: 'single' as const, item: group.items[0].item, index: group.items[0].index };
    }
    return { kind: 'group' as const, meta: group.meta, items: group.items };
  });
}
