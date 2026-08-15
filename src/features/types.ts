import { BoxType } from '../services/boxService';
import type { DateFilter, SearchFilterState } from '../types/search';

export type AuthPage = 'login' | 'register' | 'forgot-password';

export interface ViewState {
  view: 'workspace' | 'box' | 'sheet' | 'search' | 'expiration' | 'lowStock' | 'project' | 'inventoryOverview' | 'aiChat';
  boxId?: string;
  boxName?: string;
  boxAccentColor?: string | null;
  boxType?: BoxType;
  highlightCellId?: string;
  highlightColumn?: number;
  searchQuery?: string;
  searchDateFilter?: DateFilter | null;
  searchFilterState?: SearchFilterState | null;
  initialFolderId?: string;
  sheetId?: string;
  sheetName?: string;
  sheetAccentColor?: string | null;
  highlightItemId?: string;
}

export interface SublocationSelection {
  id: string;
  name: string;
  accentColor: string | null;
  locationType: string;
  iconId: string | null;
}

export interface PositionSelection {
  id: string;
  sublocationId: string;
  name: string;
  accentColor: string | null;
  locationType: string;
  iconId: string | null;
}

export const SELECTED_LOCATION_KEY = 'selectedLocationId';
export const SELECTED_SUBLOCATION_KEY = 'selectedSublocationId';
export const SELECTED_POSITION_KEY = 'selectedPositionId';
