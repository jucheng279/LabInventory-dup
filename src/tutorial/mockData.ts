const TUTORIAL_LOCATION_ID = 'tutorial-location-001';
const TUTORIAL_BOX_ID = 'tutorial-box-001';

const now = new Date().toISOString();

export function getTutorialSeedData(_lessonId: string): Record<string, any[]> {
  return {
    locations: [
      {
        id: TUTORIAL_LOCATION_ID,
        name: 'Tutorial Freezer',
        accent_color: '#3b82f6',
        display_order: 0,
        workspace_id: 'tutorial-workspace',
        show_storage_boxes: true,
        show_inventory_items: true,
        location_type: 'fridge',
        icon_id: 'freezer1',
        created_at: now,
        updated_at: now,
      },
    ],
    locations_with_stats: [
      {
        id: TUTORIAL_LOCATION_ID,
        name: 'Tutorial Freezer',
        accent_color: '#3b82f6',
        display_order: 0,
        workspace_id: 'tutorial-workspace',
        show_storage_boxes: true,
        show_inventory_items: true,
        location_type: 'fridge',
        icon_id: 'freezer1',
        created_at: now,
        updated_at: now,
        box_count: 0,
        item_count: 0,
      },
    ],
    boxes: [],
    boxes_with_stats: [],
    cells: [],
    box_history: [],
    sublocations: [],
    positions: [],
    item_folders: [],
    items: [],
  };
}

export { TUTORIAL_LOCATION_ID, TUTORIAL_BOX_ID };
