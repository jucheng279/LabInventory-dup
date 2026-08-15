import { supabase } from '../lib/supabase';
import type { SlideHeaderType } from '../types/database';
import { presetOptionService } from './presetOptionService';

export interface HeaderInput {
  name: string;
  type: SlideHeaderType;
  presetOptions?: string[];
}

interface HeaderRow {
  id: string;
  header_text: string;
  header_type: SlideHeaderType;
  display_order: number;
}

interface HeaderServiceConfig {
  tableName: string;
  foreignKeyColumn: string;
  entityLabel: string;
  presetSource: 'slide_box' | 'item_folder';
}

async function savePresetOptionsForHeaders(
  headers: HeaderInput[],
  createdHeaders: HeaderRow[],
  source: 'slide_box' | 'item_folder',
) {
  for (let i = 0; i < headers.length; i++) {
    const input = headers[i];
    if (input.type === 'preset' && input.presetOptions && input.presetOptions.length > 0) {
      const created = createdHeaders[i];
      if (created) {
        await presetOptionService.replaceOptions(
          created.id,
          source,
          input.presetOptions.map((label, idx) => ({ option_label: label, display_order: idx })),
        );
      }
    }
  }
}

function createHeaderService<T extends HeaderRow>(config: HeaderServiceConfig) {
  const { tableName, foreignKeyColumn, entityLabel, presetSource } = config;

  return {
    async getHeaders(parentId: string): Promise<T[]> {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq(foreignKeyColumn, parentId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error(`Error fetching ${entityLabel} headers:`, error);
        throw error;
      }

      return (data || []) as T[];
    },

    async createHeaders(parentId: string, headers: HeaderInput[]): Promise<T[]> {
      const rows = headers.map((h, index) => ({
        [foreignKeyColumn]: parentId,
        header_text: h.name,
        header_type: h.type,
        display_order: index,
      }));

      const { data, error } = await supabase
        .from(tableName)
        .insert(rows)
        .select();

      if (error) {
        console.error(`Error creating ${entityLabel} headers:`, error);
        throw error;
      }

      const created = (data || []) as T[];
      await savePresetOptionsForHeaders(headers, created, presetSource);
      return created;
    },

    async replaceHeaders(parentId: string, headers: HeaderInput[]): Promise<T[]> {
      const existing = await this.getHeaders(parentId);

      const matchedExistingIds = new Set<string>();

      const toUpdate: { id: string; header_text: string; header_type: string; display_order: number }[] = [];
      const toInsert: Record<string, unknown>[] = [];
      const inputToHeaderIdMap: (string | null)[] = [];

      for (let i = 0; i < headers.length; i++) {
        const input = headers[i];
        let matched: T | undefined;

        for (const ex of existing) {
          if (!matchedExistingIds.has(ex.id) && ex.header_text === input.name && ex.header_type === input.type) {
            matched = ex;
            break;
          }
        }

        if (matched) {
          matchedExistingIds.add(matched.id);
          inputToHeaderIdMap.push(matched.id);
          if (matched.display_order !== i || matched.header_text !== input.name || matched.header_type !== input.type) {
            toUpdate.push({ id: matched.id, header_text: input.name, header_type: input.type, display_order: i });
          }
        } else {
          const reusable = existing.find((ex) => !matchedExistingIds.has(ex.id));
          if (reusable) {
            matchedExistingIds.add(reusable.id);
            inputToHeaderIdMap.push(reusable.id);
            toUpdate.push({ id: reusable.id, header_text: input.name, header_type: input.type, display_order: i });
          } else {
            inputToHeaderIdMap.push(null);
            toInsert.push({ [foreignKeyColumn]: parentId, header_text: input.name, header_type: input.type, display_order: i });
          }
        }
      }

      const toDeleteIds = existing.filter((ex) => !matchedExistingIds.has(ex.id)).map((ex) => ex.id);

      if (toDeleteIds.length > 0) {
        await presetOptionService.deleteOptionsForHeaders(toDeleteIds, presetSource);

        const { error } = await supabase
          .from(tableName)
          .delete()
          .in('id', toDeleteIds);

        if (error) {
          console.error(`Error deleting removed ${entityLabel} headers:`, error);
          throw error;
        }
      }

      for (const upd of toUpdate) {
        const { error } = await supabase
          .from(tableName)
          .update({ header_text: upd.header_text, header_type: upd.header_type, display_order: upd.display_order })
          .eq('id', upd.id);

        if (error) {
          console.error(`Error updating ${entityLabel} header:`, error);
          throw error;
        }
      }

      if (toInsert.length > 0) {
        const { data: insertedData, error } = await supabase
          .from(tableName)
          .insert(toInsert)
          .select();

        if (error) {
          console.error(`Error creating new ${entityLabel} headers:`, error);
          throw error;
        }

        const insertedRows = (insertedData || []) as T[];
        let insertIdx = 0;
        for (let i = 0; i < inputToHeaderIdMap.length; i++) {
          if (inputToHeaderIdMap[i] === null && insertIdx < insertedRows.length) {
            inputToHeaderIdMap[i] = insertedRows[insertIdx].id;
            insertIdx++;
          }
        }
      }

      for (let i = 0; i < headers.length; i++) {
        const input = headers[i];
        const headerId = inputToHeaderIdMap[i];
        if (input.type === 'preset' && headerId) {
          const options = (input.presetOptions || []).map((label, idx) => ({
            option_label: label,
            display_order: idx,
          }));
          await presetOptionService.replaceOptions(headerId, presetSource, options);
        }
      }

      return this.getHeaders(parentId);
    },
  };
}

export { createHeaderService };
export type { HeaderRow, HeaderServiceConfig };
