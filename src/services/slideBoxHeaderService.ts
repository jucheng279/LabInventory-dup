import { createHeaderService, HeaderInput } from './headerService';
import type { SlideBoxHeader } from '../types/database';

export type { SlideBoxHeader } from '../types/database';
export type { HeaderInput };

export const slideBoxHeaderService = createHeaderService<SlideBoxHeader>({
  tableName: 'slide_box_headers',
  foreignKeyColumn: 'box_id',
  entityLabel: 'slide box',
  presetSource: 'slide_box',
});
