export type IconCategory = 'Location' | 'Biology' | 'Material' | 'Folder';

export type IconSubcategory =
  | 'Fridge' | 'Cabinet' | 'Drawer' | 'Desk' | 'Rack' | 'Place'
  | 'Cell' | 'Virus' | 'Bacteria' | 'Antibody' | 'Drug' | 'DNA' | 'Tissue'
  | 'Box' | 'Bottle' | 'Tube' | 'Equipment'
  | 'Document' | 'FolderIcon' | 'List' | 'Book' | 'Text';

export interface IconEntry {
  id: string;
  label: string;
  category: IconCategory;
  subcategory: IconSubcategory;
  svgPath: string;
}

const CATEGORY_ORDER: IconCategory[] = ['Location', 'Biology', 'Material', 'Folder'];

const SUBCATEGORY_MAP: Record<IconCategory, IconSubcategory[]> = {
  Location: ['Fridge', 'Cabinet', 'Drawer', 'Desk', 'Rack', 'Place'],
  Biology: ['Cell', 'Virus', 'Bacteria', 'Antibody', 'Drug', 'DNA', 'Tissue'],
  Material: ['Box', 'Bottle', 'Tube', 'Equipment'],
  Folder: ['FolderIcon', 'List', 'Document', 'Book', 'Text'],
};

const SUBCATEGORY_LABELS: Partial<Record<IconSubcategory, string>> = {
  FolderIcon: 'Folder',
  DNA: 'Genetics',
};

export function getSubcategoryLabel(sub: IconSubcategory): string {
  return SUBCATEGORY_LABELS[sub] || sub;
}

const ICON_STORAGE_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/icons`;

export const ITEM_FALLBACK_ICON_ID = 'other/stock.svg';

const ICON_VERSIONS: Record<string, string> = {
  'bottle/bottle3.svg': '3',
  'place/Room1.svg': '5',
  'Fridge/freezer1.svg': '2',
  'box/box1.svg': '2',
  'DNA/DNA1.svg': '3',
  'tissue/Tissue1.svg': '3',
  'other/stock.svg': '1',
};

function buildIcons(
  category: IconCategory,
  subcategory: IconSubcategory,
  folder: string,
  files: string[],
): IconEntry[] {
  return files.map((file) => {
    const name = file.replace(/\.\w+$/, '');
    const id = `${folder}/${file}`;
    const version = ICON_VERSIONS[id];
    const suffix = version ? `?v=${version}` : '';
    return {
      id,
      label: name,
      category,
      subcategory,
      svgPath: `${ICON_STORAGE_BASE_URL}/${folder}/${file}${suffix}`,
    };
  });
}

const ICON_REGISTRY: IconEntry[] = [
  ...buildIcons('Location', 'Fridge', 'Fridge', [
    'freezer1.svg', 'freezer2.svg', 'freezer3.svg', 'freezer4.svg',
    'freezer5.svg', 'freezer6.svg', 'freezer7.svg', 'freezer8.svg',
  ]),
  ...buildIcons('Location', 'Cabinet', 'cabinet', [
    'cabinet1.svg', 'cabinet2.svg', 'cabinet3.svg', 'cabinet4.svg', 'cabinet5.svg',
  ]),
  ...buildIcons('Location', 'Drawer', 'drawer', [
    'Drawer1.svg', 'Drawer2.svg', 'Drawer3.svg', 'Drawer4.svg',
  ]),
  ...buildIcons('Location', 'Desk', 'desk', [
    'desk1.svg', 'desk2.svg', 'desk3.svg',
  ]),
  ...buildIcons('Location', 'Rack', 'Rack', [
    'rack1.svg', 'rack2.svg', 'rack3.svg', 'rack4.svg',
  ]),
  ...buildIcons('Location', 'Place', 'place', [
    'location1.svg', 'Room1.svg', 'Room2.svg', 'Room3.svg', 'School1.svg', 'Hospital1.svg',
  ]),
  ...buildIcons('Biology', 'Cell', 'cell', [
    'Cell1.svg', 'Cell2.svg', 'Cell3.svg', 'Cell4.svg', 'Cell5.svg',
    'Cell6.svg', 'Cell7.svg',
  ]),
  ...buildIcons('Biology', 'Virus', 'virus', [
    'virus1.svg', 'virus2.svg', 'virus3.svg',
  ]),
  ...buildIcons('Biology', 'Bacteria', 'bacteria', [
    'bacteria1.svg', 'bacteria2.svg', 'bacteria3.svg',
  ]),
  ...buildIcons('Biology', 'Antibody', 'antibody', [
    'antibody1.svg', 'antibody2.svg', 'antibody3.svg', 'antibody4.svg',
  ]),
  ...buildIcons('Biology', 'Drug', 'Drug', [
    'Drug1.svg', 'Drug2.svg', 'Drug3.svg', 'Drug4.svg', 'Drug5.svg',
    'Drug6.svg', 'Drug7.svg',
  ]),
  ...buildIcons('Biology', 'DNA', 'DNA', [
    'DNA1.svg', 'DNA2.svg', 'RNA1.svg', 'RNA2.svg', 'Plasmid1.svg',
  ]),
  ...buildIcons('Biology', 'Tissue', 'tissue', [
    'Tissue1.svg', 'Tissue2.svg', 'Tissue3.svg', 'Tissue4.svg',
  ]),
  ...buildIcons('Material', 'Box', 'box', [
    'box1.svg', 'box2.svg', 'box3.svg', 'box4.svg', 'box5.svg', 'box6.svg',
  ]),
  ...buildIcons('Material', 'Bottle', 'bottle', [
    'bottle1.svg', 'bottle2.svg', 'bottle3.svg', 'bottle4.svg',
    'bottle5.svg', 'bottle6.svg',
  ]),
  ...buildIcons('Material', 'Tube', 'tube', [
    'tube1.svg', 'tube2.svg', 'tube3.svg', 'tube4.svg', 'tube5.svg', 'tube6.svg',
  ]),
  ...buildIcons('Material', 'Equipment', 'equipment', [
    'equip1.svg', 'equip2.svg', 'equip3.svg', 'equip4.svg', 'equip5.svg', 'equip6.svg',
  ]),
  ...buildIcons('Folder', 'Document', 'other', [
    'document1.svg', 'document2.svg', 'document3.svg',
  ]),
  ...buildIcons('Folder', 'FolderIcon', 'other', [
    'folder1.svg', 'folder2.svg',
  ]),
  ...buildIcons('Folder', 'List', 'other', [
    'list1.svg', 'list2.svg', 'list3.svg',
  ]),
  ...buildIcons('Folder', 'Book', 'other', [
    'book1.svg', 'book2.svg',
  ]),
  ...buildIcons('Folder', 'Text', 'other', [
    'text1.svg',
  ]),
];

const iconByIdMap = new Map<string, IconEntry>();
ICON_REGISTRY.forEach((icon) => iconByIdMap.set(icon.id, icon));

iconByIdMap.set(ITEM_FALLBACK_ICON_ID, {
  id: ITEM_FALLBACK_ICON_ID,
  label: 'Default',
  category: 'Material',
  subcategory: 'Equipment',
  svgPath: `${ICON_STORAGE_BASE_URL}/other/stock.svg?v=${ICON_VERSIONS['other/stock.svg'] || ''}`,
});

export function getAllIcons(): IconEntry[] {
  return ICON_REGISTRY;
}

export function getAllCategories(): IconCategory[] {
  return CATEGORY_ORDER;
}

export function getSubcategories(category: IconCategory): IconSubcategory[] {
  return SUBCATEGORY_MAP[category] || [];
}

export function getIconsBySubcategory(category: IconCategory, subcategory: IconSubcategory): IconEntry[] {
  return ICON_REGISTRY.filter((i) => i.category === category && i.subcategory === subcategory);
}

export function getIconById(iconId: string): IconEntry | undefined {
  return iconByIdMap.get(iconId);
}

export function getIconsByCategory(category: IconCategory): IconEntry[] {
  return ICON_REGISTRY.filter((i) => i.category === category);
}

export type IconPresetContext = 'location' | 'box' | 'item' | 'folder';

function getFirstIconOfSubcategory(category: IconCategory, subcategory: IconSubcategory): string | undefined {
  const icons = ICON_REGISTRY.filter((i) => i.category === category && i.subcategory === subcategory);
  return icons.length > 0 ? icons[0].id : undefined;
}

const CONTEXT_SUBCATEGORIES: Record<IconPresetContext, { category: IconCategory; subcategory: IconSubcategory }[]> = {
  location: [
    { category: 'Location', subcategory: 'Fridge' },
    { category: 'Location', subcategory: 'Cabinet' },
    { category: 'Location', subcategory: 'Drawer' },
    { category: 'Location', subcategory: 'Desk' },
    { category: 'Location', subcategory: 'Rack' },
    { category: 'Location', subcategory: 'Place' },
  ],
  box: [
    { category: 'Material', subcategory: 'Box' },
  ],
  item: [
    { category: 'Biology', subcategory: 'Cell' },
    { category: 'Biology', subcategory: 'Virus' },
    { category: 'Biology', subcategory: 'Bacteria' },
    { category: 'Biology', subcategory: 'Antibody' },
    { category: 'Biology', subcategory: 'Drug' },
    { category: 'Material', subcategory: 'Bottle' },
    { category: 'Material', subcategory: 'Tube' },
    { category: 'Material', subcategory: 'Equipment' },
  ],
  folder: [
    { category: 'Folder', subcategory: 'FolderIcon' },
    { category: 'Folder', subcategory: 'List' },
    { category: 'Folder', subcategory: 'Document' },
    { category: 'Folder', subcategory: 'Book' },
    { category: 'Folder', subcategory: 'Text' },
  ],
};

export interface PresetIcon {
  id: string;
  subcategoryLabel: string;
  category: IconCategory;
  subcategory: IconSubcategory;
}

export function getGridPresetIcons(context: IconPresetContext, maxSlots: number): PresetIcon[] {
  if (context === 'box') {
    const boxIcons = ICON_REGISTRY.filter((i) => i.category === 'Material' && i.subcategory === 'Box');
    return boxIcons.slice(0, Math.min(4, maxSlots)).map((icon) => ({
      id: icon.id,
      subcategoryLabel: icon.label,
      category: 'Material' as IconCategory,
      subcategory: 'Box' as IconSubcategory,
    }));
  }
  const entries = CONTEXT_SUBCATEGORIES[context] || [];
  const result: PresetIcon[] = [];
  for (const entry of entries) {
    if (result.length >= maxSlots) break;
    const iconId = getFirstIconOfSubcategory(entry.category, entry.subcategory);
    if (iconId) {
      result.push({
        id: iconId,
        subcategoryLabel: getSubcategoryLabel(entry.subcategory),
        category: entry.category,
        subcategory: entry.subcategory,
      });
    }
  }
  return result;
}

export function getPresetIcons(context: IconPresetContext): string[] {
  if (context === 'box') {
    const boxIcons = ICON_REGISTRY.filter((i) => i.category === 'Material' && i.subcategory === 'Box');
    return boxIcons.slice(0, 4).map((icon) => icon.id);
  }
  const entries = CONTEXT_SUBCATEGORIES[context] || [];
  const result: string[] = [];
  for (const entry of entries) {
    const iconId = getFirstIconOfSubcategory(entry.category, entry.subcategory);
    if (iconId) result.push(iconId);
  }
  return result;
}

export function getDefaultIconForContext(context: IconPresetContext): string | null {
  const entries = CONTEXT_SUBCATEGORIES[context] || [];
  if (entries.length === 0) return null;
  const first = entries[0];
  return getFirstIconOfSubcategory(first.category, first.subcategory) || null;
}

export function getDefaultHubConfig(context: IconPresetContext): { category: IconCategory; subcategory?: IconSubcategory } {
  const entries = CONTEXT_SUBCATEGORIES[context] || [];
  if (entries.length > 0) {
    return { category: entries[0].category, subcategory: entries[0].subcategory };
  }
  return { category: 'Location', subcategory: 'Fridge' };
}
