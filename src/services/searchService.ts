import { supabase } from '../lib/supabase';
import type { SearchResults, SearchFilterState, DateFilter, ColumnDateFilters } from '../types/search';
import type { BoxType } from '../types/database';
import { isPartialDate, expandPartialDate, expandPartialStart, expandPartialEnd } from '../utils/dateFilterUtils';

export type {
  CellSearchResult,
  CellCombinedSearchResult,
  BoxSearchResult,
  ItemSearchResult,
  ItemCustomValueSearchResult,
  SlideValueSearchResult,
  SlideCombinedSearchResult,
  SlideCellValueEntry,
  SlideHeaderSearchResult,
  StructuredFreezerCombinedSearchResult,
  SearchResult,
  SearchResults,
  SearchFilterState,
  DateFilterMode,
  DateFilter,
} from '../types/search';

interface RpcCellRow {
  cell_content: string;
  cell_id: string;
  box_id: string;
  box_name: string;
  box_accent_color: string | null;
  box_type: BoxType;
  location_id: string;
  location_name: string;
  sublocation_name: string | null;
  position_name: string | null;
  date_value: string | null;
  date_type: string | null;
}

interface RpcBoxRow {
  box_id: string;
  box_name: string;
  box_accent_color: string | null;
  box_type: BoxType;
  location_id: string;
  location_name: string;
  sublocation_name: string | null;
  position_name: string | null;
}

interface RpcItemRow {
  item_id: string;
  item_name: string;
  item_type: string;
  folder_id: string | null;
  folder_name: string | null;
  sublocation_id: string | null;
  position_id: string | null;
  location_id: string;
  location_name: string;
  sublocation_name: string | null;
  position_name: string | null;
}

interface RpcSlideValueRow {
  matched_value: string;
  header_text: string;
  display_order: number;
  cell_id: string;
  box_id: string;
  box_name: string;
  box_accent_color: string | null;
  box_type: BoxType;
  location_id: string;
  location_name: string;
  sublocation_name: string | null;
  position_name: string | null;
  date_value: string | null;
  date_type: string | null;
}

interface RpcSlideHeaderRow {
  header_text: string;
  display_order: number;
  box_id: string;
  box_name: string;
  box_accent_color: string | null;
  box_type: BoxType;
  location_id: string;
  location_name: string;
  sublocation_name: string | null;
  position_name: string | null;
}

interface RpcItemCustomValueRow {
  matched_value: string;
  header_text: string;
  display_order: number;
  item_id: string;
  item_name: string;
  item_type: string;
  folder_id: string | null;
  folder_name: string | null;
  sublocation_id: string | null;
  position_id: string | null;
  location_id: string;
  location_name: string;
  sublocation_name: string | null;
  position_name: string | null;
}

interface RpcCellMatchRow {
  name: string | null;
  information: string | null;
  cell_id: string;
  box_id: string;
  box_name: string;
  box_accent_color: string | null;
  box_type: BoxType;
  location_id: string;
  location_name: string;
  sublocation_name: string | null;
  position_name: string | null;
  date_value: string | null;
  date_type: string | null;
}

interface RpcSlideMatchRow {
  aggregated_text: string;
  values_array: Array<{ header_text: string; value: string; display_order: number }> | null;
  cell_id: string;
  box_id: string;
  box_name: string;
  box_accent_color: string | null;
  box_type: BoxType;
  location_id: string;
  location_name: string;
  sublocation_name: string | null;
  position_name: string | null;
  date_value: string | null;
  date_type: string | null;
}

interface RpcStructuredFreezerMatchRow {
  name: string | null;
  information: string | null;
  aggregated_text: string | null;
  values_array: Array<{ header_text: string; value: string; display_order: number }> | null;
  cell_id: string;
  box_id: string;
  box_name: string;
  box_accent_color: string | null;
  box_type: BoxType;
  location_id: string;
  location_name: string;
  sublocation_name: string | null;
  position_name: string | null;
  date_value: string | null;
  date_type: string | null;
}

interface RpcSearchResponse {
  cell_matches?: RpcCellMatchRow[];
  structured_freezer_matches?: RpcStructuredFreezerMatchRow[];
  cell_titles: RpcCellRow[];
  cell_info: RpcCellRow[];
  boxes: RpcBoxRow[];
  items: RpcItemRow[];
  item_custom_values: RpcItemCustomValueRow[];
  slide_matches?: RpcSlideMatchRow[];
  slide_values: RpcSlideValueRow[];
  slide_headers: RpcSlideHeaderRow[];
  blocked_count?: number;
}

interface SerializedColumnDateFilter {
  column_name: string;
  mode: string;
  date_start: string | null;
  date_end: string | null;
}

function serializeColumnDateFilters(filters: ColumnDateFilters): SerializedColumnDateFilter[] {
  return Object.entries(filters).map(([columnName, df]) => {
    let mode = df.mode as string;
    let dateStart: string | null = null;
    let dateEnd: string | null = null;

    if (df.mode === 'exact') {
      const raw = df.date || '';
      if (raw && isPartialDate(raw)) {
        mode = 'range';
        dateStart = expandPartialStart(raw);
        dateEnd = expandPartialEnd(raw);
      } else {
        dateStart = raw || null;
      }
    } else if (df.mode === 'before') {
      const raw = df.date || '';
      dateStart = raw && isPartialDate(raw) ? expandPartialEnd(raw) : (raw || null);
    } else if (df.mode === 'after') {
      const raw = df.date || '';
      dateStart = raw && isPartialDate(raw) ? expandPartialStart(raw) : (raw || null);
    } else if (df.mode === 'range') {
      const rawStart = df.startDate || '';
      const rawEnd = df.endDate || '';
      dateStart = rawStart && isPartialDate(rawStart) ? expandPartialStart(rawStart) : (rawStart || null);
      dateEnd = rawEnd && isPartialDate(rawEnd) ? expandPartialEnd(rawEnd) : (rawEnd || null);
    } else if (df.mode === 'expiring_within') {
      dateEnd = df.days != null ? String(df.days) : null;
    }

    return { column_name: columnName, mode, date_start: dateStart, date_end: dateEnd };
  });
}

const emptyResults: SearchResults = {
  cellMatches: [],
  structuredFreezerMatches: [],
  cellTitles: [],
  cellInfo: [],
  boxes: [],
  items: [],
  itemCustomValues: [],
  slideMatches: [],
  slideValues: [],
  slideHeaders: [],
  blockedCount: 0,
};

export const searchService = {
  async searchAll(query: string, dateFilter?: DateFilter | null, filters?: SearchFilterState | null, signal?: AbortSignal, teamMemberId?: string): Promise<SearchResults> {
    const hasSlideDateFilters = filters?.slideDateFilters && Object.keys(filters.slideDateFilters).length > 0;
    const hasItemDateFilters = filters?.itemDateFilters && Object.keys(filters.itemDateFilters).length > 0;
    const hasFreezerDateFilters = filters?.freezerDateFilters && Object.keys(filters.freezerDateFilters).length > 0;
    const hasNonDateFilters = !!(
      filters?.scopes?.length ||
      filters?.customFilters?.length ||
      filters?.freezerSubFilters?.length ||
      filters?.freezerHeaderFilters?.length ||
      filters?.slideHeaderFilters?.length ||
      filters?.itemSubFilters?.length ||
      filters?.itemHeaderFilters?.length ||
      filters?.itemFolderNameFilter
    );
    if (!query.trim() && !dateFilter && !hasSlideDateFilters && !hasItemDateFilters && !hasFreezerDateFilters && !hasNonDateFilters) {
      return emptyResults;
    }

    let dateMode: string | null = null;
    let dateStart: string | null = null;
    let dateEnd: string | null = null;
    let dateTypeTarget: string | null = null;

    if (dateFilter) {
      dateMode = dateFilter.mode;
      dateTypeTarget = dateFilter.dateTypeTarget || null;

      if (dateFilter.mode === 'exact') {
        const raw = dateFilter.date || '';
        if (raw && isPartialDate(raw)) {
          const expanded = expandPartialDate(raw);
          dateMode = 'range';
          dateStart = expanded.start;
          dateEnd = expanded.end;
        } else {
          dateStart = raw || null;
        }
      } else if (dateFilter.mode === 'before') {
        const raw = dateFilter.date || '';
        dateStart = raw && isPartialDate(raw) ? expandPartialEnd(raw) : (raw || null);
      } else if (dateFilter.mode === 'after') {
        const raw = dateFilter.date || '';
        dateStart = raw && isPartialDate(raw) ? expandPartialStart(raw) : (raw || null);
      } else if (dateFilter.mode === 'range') {
        const rawStart = dateFilter.startDate || '';
        const rawEnd = dateFilter.endDate || '';
        dateStart = rawStart && isPartialDate(rawStart) ? expandPartialStart(rawStart) : (rawStart || null);
        dateEnd = rawEnd && isPartialDate(rawEnd) ? expandPartialEnd(rawEnd) : (rawEnd || null);
      } else if (dateFilter.mode === 'expiring_within') {
        dateEnd = dateFilter.days != null ? String(dateFilter.days) : null;
      }
    }

    const slideDateFiltersJson = hasSlideDateFilters
      ? JSON.stringify(serializeColumnDateFilters(filters!.slideDateFilters))
      : null;

    const itemDateFiltersJson = hasItemDateFilters
      ? JSON.stringify(serializeColumnDateFilters(filters!.itemDateFilters))
      : null;

    const freezerDateFiltersJson = hasFreezerDateFilters
      ? JSON.stringify(serializeColumnDateFilters(filters!.freezerDateFilters))
      : null;

    const trimmed = query.trim();
    const queryParts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    const hasMultipleQueryTerms = queryParts.length > 1;

    const effectiveQuery = hasMultipleQueryTerms ? '' : trimmed;
    const queryAsFilters = hasMultipleQueryTerms ? queryParts : [];
    const baseFilters = filters?.customFilters ?? [];
    const mergedFilters = [...baseFilters, ...queryAsFilters.filter(
      q => !baseFilters.some(f => f.toLowerCase() === q.toLowerCase()),
    )];

    const rpcParams: Record<string, unknown> = {
      search_query: effectiveQuery,
      date_mode: dateMode,
      date_start: dateStart,
      date_end: dateEnd,
      date_type_target: dateTypeTarget,
      filter_scopes: filters?.scopes?.length ? filters.scopes : null,
      filter_texts: mergedFilters.length > 0 ? mergedFilters : null,
      freezer_sub_filters: filters?.freezerSubFilters?.length ? filters.freezerSubFilters : null,
      slide_header_filters: filters?.slideHeaderFilters?.length ? filters.slideHeaderFilters : null,
      slide_date_filters: slideDateFiltersJson,
      item_sub_filters: filters?.itemSubFilters?.length ? filters.itemSubFilters : null,
      item_header_filters: filters?.itemHeaderFilters?.length ? filters.itemHeaderFilters : null,
      item_folder_name_filter: filters?.itemFolderNameFilter || null,
      item_date_filters: itemDateFiltersJson,
      freezer_header_filters: filters?.freezerHeaderFilters?.length ? filters.freezerHeaderFilters : null,
      freezer_date_filters: freezerDateFiltersJson,
      p_team_member_id: teamMemberId || null,
    };

    let rpcCall = supabase.rpc('search_workspace', rpcParams);
    if (signal) {
      rpcCall = rpcCall.abortSignal(signal);
    }
    const { data, error } = await rpcCall;

    if (error) {
      if (signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      console.error('Error searching workspace:', error);
      throw error;
    }

    const response = data as RpcSearchResponse;

    return {
      cellMatches: (response.cell_matches || []).map((r) => ({
        type: 'cell_combined' as const,
        name: r.name || '',
        information: r.information || '',
        cellId: r.cell_id,
        boxId: r.box_id,
        boxName: r.box_name,
        boxAccentColor: r.box_accent_color,
        boxType: r.box_type,
        locationId: r.location_id,
        locationName: r.location_name,
        sublocationName: r.sublocation_name,
        positionName: r.position_name,
        dateValue: r.date_value || null,
        dateType: (r.date_type as 'date' | 'expiration' | 'none') || null,
      })),
      structuredFreezerMatches: (response.structured_freezer_matches || []).map((r) => ({
        type: 'structured_freezer_combined' as const,
        name: r.name || '',
        information: r.information || '',
        values: (r.values_array || []).map((v) => ({
          headerText: v.header_text,
          value: v.value,
          displayOrder: v.display_order,
        })),
        cellId: r.cell_id,
        boxId: r.box_id,
        boxName: r.box_name,
        boxAccentColor: r.box_accent_color,
        boxType: r.box_type,
        locationId: r.location_id,
        locationName: r.location_name,
        sublocationName: r.sublocation_name,
        positionName: r.position_name,
        dateValue: r.date_value || null,
        dateType: (r.date_type as 'date' | 'expiration' | 'none') || null,
      })),
      slideMatches: (response.slide_matches || []).map((r) => ({
        type: 'slide_combined' as const,
        values: (r.values_array || []).map((v) => ({
          headerText: v.header_text,
          value: v.value,
          displayOrder: v.display_order,
        })),
        cellId: r.cell_id,
        boxId: r.box_id,
        boxName: r.box_name,
        boxAccentColor: r.box_accent_color,
        boxType: r.box_type,
        locationId: r.location_id,
        locationName: r.location_name,
        sublocationName: r.sublocation_name,
        positionName: r.position_name,
        dateValue: r.date_value || null,
        dateType: (r.date_type as 'date' | 'expiration' | 'none') || null,
      })),
      cellTitles: (response.cell_titles || []).map((r) => ({
        type: 'cell_title' as const,
        cellContent: r.cell_content,
        cellId: r.cell_id,
        boxId: r.box_id,
        boxName: r.box_name,
        boxAccentColor: r.box_accent_color,
        boxType: r.box_type,
        locationId: r.location_id,
        locationName: r.location_name,
        sublocationName: r.sublocation_name,
        positionName: r.position_name,
        dateValue: r.date_value || null,
        dateType: (r.date_type as 'date' | 'expiration' | 'none') || null,
      })),
      cellInfo: (response.cell_info || []).map((r) => ({
        type: 'cell_info' as const,
        cellContent: r.cell_content,
        cellId: r.cell_id,
        boxId: r.box_id,
        boxName: r.box_name,
        boxAccentColor: r.box_accent_color,
        boxType: r.box_type,
        locationId: r.location_id,
        locationName: r.location_name,
        sublocationName: r.sublocation_name,
        positionName: r.position_name,
        dateValue: r.date_value || null,
        dateType: (r.date_type as 'date' | 'expiration' | 'none') || null,
      })),
      boxes: (response.boxes || []).map((r) => ({
        type: 'box' as const,
        boxId: r.box_id,
        boxName: r.box_name,
        boxAccentColor: r.box_accent_color,
        boxType: r.box_type,
        locationId: r.location_id,
        locationName: r.location_name,
        sublocationName: r.sublocation_name,
        positionName: r.position_name,
      })),
      items: (response.items || []).map((r) => ({
        type: 'item' as const,
        itemId: r.item_id,
        itemName: r.item_name,
        itemType: r.item_type,
        folderId: r.folder_id,
        folderName: r.folder_name,
        locationId: r.location_id,
        locationName: r.location_name,
        sublocationId: r.sublocation_id,
        sublocationName: r.sublocation_name,
        positionId: r.position_id,
        positionName: r.position_name,
      })),
      itemCustomValues: (response.item_custom_values || []).map((r) => ({
        type: 'item_custom_value' as const,
        matchedValue: r.matched_value,
        headerText: r.header_text,
        displayOrder: r.display_order,
        itemId: r.item_id,
        itemName: r.item_name,
        itemType: r.item_type,
        folderId: r.folder_id,
        folderName: r.folder_name,
        locationId: r.location_id,
        locationName: r.location_name,
        sublocationId: r.sublocation_id,
        sublocationName: r.sublocation_name,
        positionId: r.position_id,
        positionName: r.position_name,
      })),
      slideValues: (response.slide_values || []).map((r) => ({
        type: 'slide_value' as const,
        matchedValue: r.matched_value,
        headerText: r.header_text,
        displayOrder: r.display_order,
        cellId: r.cell_id,
        boxId: r.box_id,
        boxName: r.box_name,
        boxAccentColor: r.box_accent_color,
        boxType: r.box_type,
        locationId: r.location_id,
        locationName: r.location_name,
        sublocationName: r.sublocation_name,
        positionName: r.position_name,
        dateValue: r.date_value || null,
        dateType: (r.date_type as 'date' | 'expiration' | 'none') || null,
      })),
      slideHeaders: (response.slide_headers || []).map((r) => ({
        type: 'slide_header' as const,
        headerText: r.header_text,
        displayOrder: r.display_order,
        boxId: r.box_id,
        boxName: r.box_name,
        boxAccentColor: r.box_accent_color,
        boxType: r.box_type,
        locationId: r.location_id,
        locationName: r.location_name,
        sublocationName: r.sublocation_name,
        positionName: r.position_name,
      })),
      blockedCount: response.blocked_count || 0,
    };
  },
};
