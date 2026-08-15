export interface UnitGroup {
  label: string;
  units: string[];
}

export const UNIT_GROUPS: UnitGroup[] = [
  { label: 'Volume', units: ['fL', 'pL', 'nL', 'uL', 'mL', 'L', 'kL'] },
  { label: 'Mass', units: ['fg', 'pg', 'ng', 'ug', 'mg', 'g', 'kg'] },
];

export const ALL_UNITS = ['unit', ...UNIT_GROUPS.flatMap((g) => g.units)];

export function formatStockWithUnit(stock: number, unit: string): string {
  if (!unit) return String(stock);
  if (unit === 'unit') return stock === 1 ? '1 unit' : `${stock} units`;
  return `${stock} ${unit}`;
}
