import type { CellData, BoxType } from './database';

export type AuthStatus = 'loading' | 'unauthenticated' | 'pending_access' | 'pending_workspace_setup' | 'authenticated';

export type AuthPage = 'login' | 'register' | 'forgot-password';

export interface ViewState {
  view: 'workspace' | 'box';
  boxId?: string;
  boxName?: string;
  boxAccentColor?: string | null;
  boxType?: BoxType;
}

export interface SublocationSelection {
  id: string;
  name: string;
  accentColor: string | null;
  locationType: string;
}

export interface PositionSelection {
  id: string;
  name: string;
  accentColor: string | null;
  locationType: string;
}

export interface ContentVariant {
  information: string;
  date: string;
  date_type?: string;
  wellCount: number;
}

export interface ContentGroup {
  effectiveName: string;
  variants: ContentVariant[];
  totalCount: number;
  isInfoOnly?: boolean;
}

export interface BoxContentSummary {
  groups: ContentGroup[];
  totalUniqueReagents: number;
  totalValidWells: number;
}

export type CellField = 'name' | 'information' | 'date' | 'color' | 'dateType';

export interface FieldMatchStatus {
  name: boolean;
  information: boolean;
  date: boolean;
  color: boolean;
  dateType: boolean;
}

export interface PartialCellMatch {
  data: CellData;
  fieldStatus: FieldMatchStatus;
  hasAnyData: boolean;
  allMatch: boolean;
}

export type ColorByField = 'name' | 'information' | 'date';

export type GroupingMethod = 1 | 2 | 3;

export interface SlideFieldMatchStatus {
  headerFields: Record<number, boolean>;
  color: boolean;
}

export interface SlidePartialMatch {
  headerValues: Record<number, string>;
  color: string | null;
  fieldStatus: SlideFieldMatchStatus;
  hasAnyData: boolean;
  allMatch: boolean;
}
