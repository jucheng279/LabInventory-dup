import type { BoxType } from './database';

export interface CellSearchResult {
  type: 'cell_title' | 'cell_info';
  cellContent: string;
  cellId: string;
  boxId: string;
  boxName: string;
  boxAccentColor: string | null;
  boxType: BoxType;
  locationId: string;
  locationName: string;
  sublocationName: string | null;
  positionName: string | null;
  dateValue: string | null;
  dateType: 'date' | 'expiration' | 'none' | null;
}

export interface BoxSearchResult {
  type: 'box';
  boxId: string;
  boxName: string;
  boxAccentColor: string | null;
  boxType: BoxType;
  locationId: string;
  locationName: string;
  sublocationName: string | null;
  positionName: string | null;
}

export interface ItemSearchResult {
  type: 'item';
  itemId: string;
  itemName: string;
  itemType: string;
  folderId: string | null;
  folderName: string | null;
  locationId: string;
  locationName: string;
  sublocationId: string | null;
  sublocationName: string | null;
  positionId: string | null;
  positionName: string | null;
}

export interface SlideValueSearchResult {
  type: 'slide_value';
  matchedValue: string;
  headerText: string;
  displayOrder: number;
  cellId: string;
  boxId: string;
  boxName: string;
  boxAccentColor: string | null;
  boxType: BoxType;
  locationId: string;
  locationName: string;
  sublocationName: string | null;
  positionName: string | null;
  dateValue: string | null;
  dateType: 'date' | 'expiration' | 'none' | null;
}

export interface SlideHeaderSearchResult {
  type: 'slide_header';
  headerText: string;
  displayOrder: number;
  boxId: string;
  boxName: string;
  boxAccentColor: string | null;
  boxType: BoxType;
  locationId: string;
  locationName: string;
  sublocationName: string | null;
  positionName: string | null;
}

export interface ItemCustomValueSearchResult {
  type: 'item_custom_value';
  matchedValue: string;
  headerText: string;
  displayOrder: number;
  itemId: string;
  itemName: string;
  itemType: string;
  folderId: string | null;
  folderName: string | null;
  locationId: string;
  locationName: string;
  sublocationId: string | null;
  sublocationName: string | null;
  positionId: string | null;
  positionName: string | null;
}

export type DateFilterMode = 'exact' | 'range' | 'before' | 'after' | 'expiring_within';

export interface DateFilter {
  mode: DateFilterMode;
  date?: string;
  startDate?: string;
  endDate?: string;
  days?: number;
  dateTypeTarget?: 'date' | 'expiration' | null;
}

export type ColumnDateFilters = Record<string, DateFilter>;

export interface CellCombinedSearchResult {
  type: 'cell_combined';
  name: string;
  information: string;
  cellId: string;
  boxId: string;
  boxName: string;
  boxAccentColor: string | null;
  boxType: BoxType;
  locationId: string;
  locationName: string;
  sublocationName: string | null;
  positionName: string | null;
  dateValue: string | null;
  dateType: 'date' | 'expiration' | 'none' | null;
}

export interface SlideCellValueEntry {
  headerText: string;
  value: string;
  displayOrder: number;
}

export interface SlideCombinedSearchResult {
  type: 'slide_combined';
  values: SlideCellValueEntry[];
  cellId: string;
  boxId: string;
  boxName: string;
  boxAccentColor: string | null;
  boxType: BoxType;
  locationId: string;
  locationName: string;
  sublocationName: string | null;
  positionName: string | null;
  dateValue: string | null;
  dateType: 'date' | 'expiration' | 'none' | null;
}

export interface StructuredFreezerCombinedSearchResult {
  type: 'structured_freezer_combined';
  name: string;
  information: string;
  values: SlideCellValueEntry[];
  cellId: string;
  boxId: string;
  boxName: string;
  boxAccentColor: string | null;
  boxType: BoxType;
  locationId: string;
  locationName: string;
  sublocationName: string | null;
  positionName: string | null;
  dateValue: string | null;
  dateType: 'date' | 'expiration' | 'none' | null;
}

export type SearchResult =
  | CellSearchResult
  | CellCombinedSearchResult
  | BoxSearchResult
  | ItemSearchResult
  | SlideValueSearchResult
  | SlideCombinedSearchResult
  | SlideHeaderSearchResult
  | ItemCustomValueSearchResult
  | StructuredFreezerCombinedSearchResult;

export interface SearchResults {
  cellMatches: CellCombinedSearchResult[];
  structuredFreezerMatches: StructuredFreezerCombinedSearchResult[];
  cellTitles: CellSearchResult[];
  cellInfo: CellSearchResult[];
  boxes: BoxSearchResult[];
  items: ItemSearchResult[];
  itemCustomValues: ItemCustomValueSearchResult[];
  slideMatches: SlideCombinedSearchResult[];
  slideValues: SlideValueSearchResult[];
  slideHeaders: SlideHeaderSearchResult[];
  blockedCount: number;
}

export type SearchFilterScopeValue = 'freezer_box' | 'slide_box' | 'item';
export type SearchFilterScopes = SearchFilterScopeValue[];

export type FreezerSubFilterValue = 'name' | 'info';
export type FreezerSubFilters = FreezerSubFilterValue[];

export interface SlideHeaderInfo {
  headerText: string;
  headerType: 'text' | 'date' | 'expiration';
}

export type ItemSubFilterValue = 'name' | 'folder_name' | 'column_header';
export type ItemSubFilters = ItemSubFilterValue[];

export interface ItemFolderHeaderInfo {
  headerText: string;
  headerType: 'text' | 'date' | 'expiration';
}

export interface FreezerHeaderInfo {
  headerText: string;
  headerType: 'text' | 'date' | 'expiration';
}

export interface SearchFilterState {
  scopes: SearchFilterScopes;
  customFilters: string[];
  freezerSubFilters: FreezerSubFilters;
  freezerHeaderFilters: string[];
  freezerDateFilters: ColumnDateFilters;
  slideHeaderFilters: string[];
  slideDateFilters: ColumnDateFilters;
  itemSubFilters: ItemSubFilters;
  itemHeaderFilters: string[];
  itemFolderNameFilter: string | null;
  itemDateFilters: ColumnDateFilters;
}

export interface SavedSearchFilter {
  id: string;
  workspaceId: string;
  teamMemberId: string;
  filterText: string;
  createdAt: string;
}
