export type BoxType = 'freezer' | 'slide' | 'structured_freezer';

export type ItemType = 'Antibody' | 'Cell' | 'Medium' | 'Kits' | 'Chemicals';

export interface InventoryItemTypeRecord {
  id: string;
  workspace_id: string;
  name: string;
  icon_id: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateInventoryItemTypeData {
  workspace_id: string;
  name: string;
  icon_id: string;
}

export interface UpdateInventoryItemTypeData {
  name?: string;
  icon_id?: string;
}

export type TeamRole = 'owner' | 'manager' | 'member';

export type HistoryActionType = 'edit' | 'cross' | 'clear' | 'cut' | 'copy' | 'move' | 'swap' | 'undo' | 'revert' | 'redo';

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  live_sync_enabled: boolean;
  auto_open_first_folder: boolean;
  auto_open_first_item_folder: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  email: string;
  display_name: string | null;
  role: TeamRole | null;
  auth_user_id: string | null;
  invited_by: string | null;
  workspace_id: string | null;
  former_workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AddMemberData {
  email: string;
  role: TeamRole;
}

export interface Location {
  id: string;
  name: string;
  accent_color: string | null;
  display_order: number;
  workspace_id: string | null;
  show_storage_boxes: boolean;
  show_inventory_items: boolean;
  location_type: string;
  icon_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocationWithStats extends Location {
  boxCount: number;
  itemCount: number;
}

export interface CreateLocationData {
  name: string;
  accent_color?: string | null;
  workspace_id: string;
  show_storage_boxes?: boolean;
  show_inventory_items?: boolean;
  location_type?: string;
  icon_id?: string | null;
}

export interface UpdateLocationData {
  name?: string;
  accent_color?: string | null;
  show_storage_boxes?: boolean;
  show_inventory_items?: boolean;
  location_type?: string;
  icon_id?: string | null;
}

export interface Sublocation {
  id: string;
  location_id: string;
  name: string;
  accent_color: string | null;
  display_order: number;
  location_type: string;
  icon_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SublocationWithStats extends Sublocation {
  box_count: number;
  item_count: number;
}

export interface CreateSublocationData {
  location_id: string;
  name: string;
  accent_color?: string | null;
  location_type?: string;
  icon_id?: string | null;
}

export interface UpdateSublocationData {
  name?: string;
  accent_color?: string | null;
  location_type?: string;
  icon_id?: string | null;
}

export interface Position {
  id: string;
  sublocation_id: string;
  name: string;
  accent_color: string | null;
  display_order: number;
  location_type: string;
  icon_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PositionWithStats extends Position {
  box_count: number;
  item_count: number;
}

export interface CreatePositionData {
  sublocation_id: string;
  name: string;
  accent_color?: string | null;
  location_type?: string;
  icon_id?: string | null;
}

export interface UpdatePositionData {
  name?: string;
  accent_color?: string | null;
  location_type?: string;
  icon_id?: string | null;
}

export interface LocationBox {
  id: string;
  location_id: string;
  sublocation_id: string | null;
  position_id: string | null;
  name: string;
  description: string;
  accent_color: string | null;
  rows: number;
  columns: number;
  name_font_divisor: number;
  info_font_divisor: number;
  slide_font_divisor: number;
  constrain_grid_height: boolean;
  box_type: BoxType;
  icon_id: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface LocationBoxWithStats extends LocationBox {
  occupiedCells: number;
  totalCells: number;
  utilizationPercent: number;
}

export interface CreateBoxData {
  location_id: string;
  sublocation_id?: string | null;
  position_id?: string | null;
  name: string;
  description?: string;
  accent_color?: string | null;
  rows?: number;
  columns?: number;
  box_type?: BoxType;
  icon_id?: string | null;
}

export interface UpdateBoxData {
  name?: string;
  description?: string;
  accent_color?: string | null;
  rows?: number;
  columns?: number;
  name_font_divisor?: number;
  info_font_divisor?: number;
  slide_font_divisor?: number;
  constrain_grid_height?: boolean;
  icon_id?: string | null;
}

export interface CellData {
  name: string;
  information: string;
  date: string | null;
  color?: string | null;
  is_crossed?: boolean;
  date_type?: 'date' | 'expiration' | 'none';
  slide_image_url?: string | null;
}

export interface LocationCellRecord {
  id: string;
  cell_id: string;
  box_id: string;
  name: string;
  information: string;
  date: string | null;
  color: string | null;
  is_crossed: boolean;
  date_type: string;
  slide_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemSheet {
  id: string;
  location_id: string;
  sublocation_id: string | null;
  position_id: string | null;
  name: string;
  description: string;
  accent_color: string | null;
  icon_id: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type ItemFolder = ItemSheet;

export interface ItemSheetWithStats extends ItemSheet {
  item_count: number;
}

export type ItemFolderWithStats = ItemSheetWithStats;

export interface CreateItemSheetData {
  location_id: string;
  sublocation_id?: string | null;
  position_id?: string | null;
  name: string;
  description?: string;
  accent_color?: string | null;
}

export type CreateItemFolderData = CreateItemSheetData;

export interface UpdateItemSheetData {
  name?: string;
  description?: string;
  accent_color?: string | null;
  icon_id?: string | null;
}

export type UpdateItemFolderData = UpdateItemSheetData;

export interface ItemSheetHeader {
  id: string;
  folder_id: string;
  header_text: string;
  header_type: SlideHeaderType;
  display_order: number;
  created_at: string;
  preset_options?: PresetOption[];
}

export type ItemFolderHeader = ItemSheetHeader;

export interface ItemCustomValue {
  id: string;
  item_id: string;
  header_id: string;
  value: string;
  created_at: string;
}

export type ItemCustomValuesMap = Record<string, Record<string, string>>;

export type DisplayMode = 'stock' | 'freeze_thaw';

export interface InventoryItem {
  id: string;
  location_id: string;
  sublocation_id: string | null;
  position_id: string | null;
  /** null = standalone item (Framework 1: name+info+date, links to normal freezer boxes).
   *  non-null = sheet item (Framework 2: name+columns, links to structured freezer boxes). */
  folder_id: string | null;
  name: string;
  note: string;
  stock_number: number;
  stock_threshold: number | null;
  unit: string;
  non_counted: boolean;
  item_type: ItemType;
  accent_color: string | null;
  icon_id: string | null;
  display_order: number;
  freeze_thaw_cycles: number;
  display_mode: DisplayMode;
  date: string | null;
  date_type: string;
  item_type_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateItemData {
  location_id: string;
  sublocation_id?: string | null;
  position_id?: string | null;
  folder_id?: string | null;
  name: string;
  note?: string;
  stock_number?: number;
  stock_threshold?: number | null;
  unit?: string;
  non_counted?: boolean;
  item_type: ItemType;
  accent_color?: string | null;
  icon_id?: string | null;
  freeze_thaw_cycles?: number;
  display_mode?: DisplayMode;
  date?: string | null;
  date_type?: string;
  item_type_id?: string | null;
}

export interface UpdateItemData {
  name?: string;
  note?: string;
  stock_number?: number;
  stock_threshold?: number | null;
  unit?: string;
  non_counted?: boolean;
  item_type?: ItemType;
  accent_color?: string | null;
  icon_id?: string | null;
  freeze_thaw_cycles?: number;
  display_mode?: DisplayMode;
  date?: string | null;
  date_type?: string;
  item_type_id?: string | null;
}

export interface CellDataSnapshot {
  name: string;
  information: string;
  date: string | null;
  date_type?: string;
}

export interface CellStateMap {
  [cellId: string]: {
    name: string;
    information: string;
    date: string | null;
    color: string | null;
    is_crossed: boolean;
    date_type: string;
  };
}

export interface HistoryEntry {
  id: string;
  box_id: string;
  team_member_id: string;
  action_type: HistoryActionType;
  affected_cells: string[];
  source_cells: string[] | null;
  target_cells: string[] | null;
  cell_data: CellDataSnapshot | null;
  previous_cell_data: CellStateMap | null;
  redo_cell_data: CellStateMap | null;
  related_box_id: string | null;
  related_box_name: string | null;
  batch_id: string | null;
  is_undone: boolean;
  created_at: string;
  team_member: {
    display_name: string | null;
    email: string;
  } | null;
}

export interface RevertGroup {
  id: string;
  box_id: string;
  parent_group_id: string | null;
  team_member_id: string | null;
  created_at: string;
  team_member: {
    display_name: string | null;
    email: string;
  } | null;
}

export interface HistoryActionContext {
  actionType: HistoryActionType;
  sourceCells: string[];
  targetCells: string[];
  relatedBoxId?: string;
  relatedBoxName?: string;
}

export interface GetHistoryOptions {
  boxId: string;
  limit?: number;
  offset?: number;
}

export type SlideHeaderType = 'text' | 'date' | 'expiration' | 'preset';

export interface PresetOption {
  id: string;
  header_id: string;
  header_source: 'slide_box' | 'item_folder';
  option_label: string;
  display_order: number;
  created_at: string;
}

export interface SlideBoxHeader {
  id: string;
  box_id: string;
  header_text: string;
  header_type: SlideHeaderType;
  display_order: number;
  created_at: string;
  preset_options?: PresetOption[];
}

/** Alias for SlideBoxHeader when used in the structured freezer box context (Framework 2). */
export type StructuredBoxHeader = SlideBoxHeader;

export interface SlideCellValue {
  id: string;
  cell_id: string;
  header_id: string;
  value: string;
  created_at: string;
}

export type SlideValuesMap = Record<string, Record<number, string>>;

/** Alias for SlideValuesMap when used in the structured freezer box context (Framework 2). */
export type ColumnValuesMap = SlideValuesMap;

export type GridItemLinkType = 'name' | 'name_info' | 'info';

export interface BoxGridItemLink {
  id: string;
  box_id: string;
  item_id: string;
  link_type: GridItemLinkType;
  linked_name: string;
  linked_info: string | null;
  linked_date: string | null;
  linked_date_type: string;
  created_at: string;
  updated_at: string;
  box_name?: string;
}

export type BoxPrivacyMode = 'open' | 'restricted';
export type BoxAccessLevel = 'owner' | 'edit' | 'view' | 'none' | 'open';

export interface BoxPrivacySettings {
  id: string;
  box_id: string;
  privacy_mode: BoxPrivacyMode;
  owner_id: string;
  owner_only_delete: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoxAccessEntry {
  id: string;
  box_id: string;
  team_member_id: string;
  access_level: 'edit' | 'view';
  created_at: string;
}

export interface BoxPrivacyData {
  settings: BoxPrivacySettings;
  accessList: BoxAccessEntry[];
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  icon_id: string | null;
  accent_color: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithStats extends Project {
  experiment_count: number;
  box_count: number;
  item_count: number;
}

export interface CreateProjectData {
  name: string;
  workspace_id: string;
  icon_id?: string | null;
  accent_color?: string | null;
}

export interface UpdateProjectData {
  name?: string;
  icon_id?: string | null;
  accent_color?: string | null;
}

export interface Experiment {
  id: string;
  project_id: string;
  name: string;
  icon_id: string | null;
  accent_color: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ExperimentWithStats extends Experiment {
  box_count: number;
  item_count: number;
}

export interface CreateExperimentData {
  project_id: string;
  name: string;
  icon_id?: string | null;
  accent_color?: string | null;
}

export interface UpdateExperimentData {
  name?: string;
  icon_id?: string | null;
  accent_color?: string | null;
}

export interface ProjectBoxLink {
  id: string;
  project_id: string;
  experiment_id: string | null;
  box_id: string;
  display_order: number;
  created_at: string;
}

export interface ProjectItemLink {
  id: string;
  project_id: string;
  experiment_id: string | null;
  item_id: string;
  display_order: number;
  created_at: string;
}

export type ProjectPrivacyMode = 'open' | 'restricted';
export type ProjectAccessLevel = 'owner' | 'edit' | 'view' | 'none' | 'open';

export interface ProjectPrivacySettings {
  id: string;
  project_id: string;
  privacy_mode: ProjectPrivacyMode;
  owner_id: string;
  owner_only_delete: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectAccessEntry {
  id: string;
  project_id: string;
  team_member_id: string;
  access_level: 'edit' | 'view';
  created_at: string;
}

export interface ProjectPrivacyData {
  settings: ProjectPrivacySettings;
  accessList: ProjectAccessEntry[];
}

export interface SignUpData {
  email: string;
  password: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface BoxQRCode {
  id: string;
  box_id: string;
  workspace_id: string;
  token: string;
  label: string | null;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
}

export interface ResolvedQRToken {
  box_id: string;
  workspace_id: string;
  location_id: string;
  sublocation_id: string | null;
  position_id: string | null;
  box_type: string;
  box_name: string;
  accent_color: string | null;
}
