import { createHeaderService } from './headerService';
import type { ItemSheetHeader } from '../types/database';
import type { HeaderInput } from './headerService';

export type { ItemSheetHeader, ItemFolderHeader } from '../types/database';
export type { HeaderInput as FolderHeaderInput };
export type { HeaderInput as SheetHeaderInput };

export const itemSheetHeaderService = createHeaderService<ItemSheetHeader>({
  tableName: 'item_folder_headers',
  foreignKeyColumn: 'folder_id',
  entityLabel: 'item sheet',
  presetSource: 'item_folder',
});

export const itemFolderHeaderService = itemSheetHeaderService;
