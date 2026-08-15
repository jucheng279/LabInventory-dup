export interface LocationTypeOption {
  value: string;
  label: string;
  iconId: string;
}

export const LOCATION_TYPES: LocationTypeOption[] = [
  { value: 'fridge', label: 'Fridge', iconId: 'Fridge/freezer2.svg' },
  { value: 'room', label: 'Room', iconId: 'place/location1.svg' },
  { value: 'cabinet', label: 'Cabinet', iconId: 'cabinet/cabinet4.svg' },
  { value: 'drawer', label: 'Drawer', iconId: 'drawer/Drawer3.svg' },
  { value: 'shelf', label: 'Shelf', iconId: 'Rack/rack2.svg' },
  { value: 'rack', label: 'Rack', iconId: 'Rack/rack1.svg' },
  { value: 'table', label: 'Table', iconId: 'desk/desk3.svg' },
  { value: 'general', label: 'General', iconId: 'place/location1.svg' },
];

const iconIdMap: Record<string, string> = Object.fromEntries(
  LOCATION_TYPES.map((t) => [t.value, t.iconId])
);

export function getLocationIconId(locationType?: string | null): string {
  return iconIdMap[locationType || ''] || 'place/location1.svg';
}
