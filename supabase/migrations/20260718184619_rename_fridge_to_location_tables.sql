/*
# Rename legacy "fridge" tables and columns to "location" naming

## Summary
This migration renames all legacy "fridge" database objects to use generic "location" terminology,
aligning the database schema with the application's TypeScript types and UI which already use
"location" naming.

## Table Renames
- `fridges` -> `locations`
- `fridge_sublocations` -> `sublocations`
- `fridge_boxes` -> `boxes`
- `fridge_cells` -> `cells`

## Column Renames
- `sublocations.fridge_id` -> `sublocations.location_id`
- `boxes.fridge_id` -> `boxes.location_id`
- `item_folders.fridge_id` -> `item_folders.location_id`
- `inventory_items.fridge_id` -> `inventory_items.location_id`

## View Renames
- `fridges_with_stats` -> `locations_with_stats`

## Important Notes
1. ALTER TABLE RENAME preserves all data, foreign keys, constraints, triggers, and RLS policies.
2. Column renames also preserve FK constraints automatically.
3. Views are recreated to reflect new naming in their output columns.
4. Indexes are renamed for clarity (they still function with old names, this is cosmetic).
*/

-- ============================================================
-- 1. Rename Tables
-- ============================================================
ALTER TABLE IF EXISTS fridges RENAME TO locations;
ALTER TABLE IF EXISTS fridge_sublocations RENAME TO sublocations;
ALTER TABLE IF EXISTS fridge_boxes RENAME TO boxes;
ALTER TABLE IF EXISTS fridge_cells RENAME TO cells;

-- ============================================================
-- 2. Rename Columns (fridge_id -> location_id)
-- ============================================================
ALTER TABLE sublocations RENAME COLUMN fridge_id TO location_id;
ALTER TABLE boxes RENAME COLUMN fridge_id TO location_id;
ALTER TABLE item_folders RENAME COLUMN fridge_id TO location_id;
ALTER TABLE inventory_items RENAME COLUMN fridge_id TO location_id;

-- ============================================================
-- 3. Rename Indexes
-- ============================================================
ALTER INDEX IF EXISTS idx_fridges_workspace_id RENAME TO idx_locations_workspace_id;
ALTER INDEX IF EXISTS idx_fridges_display_order RENAME TO idx_locations_display_order;
ALTER INDEX IF EXISTS idx_fridges_created_at RENAME TO idx_locations_created_at;
ALTER INDEX IF EXISTS idx_fridge_sublocations_fridge_id RENAME TO idx_sublocations_location_id;
ALTER INDEX IF EXISTS idx_fridge_sublocations_display_order RENAME TO idx_sublocations_display_order;
ALTER INDEX IF EXISTS idx_fridge_boxes_fridge_id RENAME TO idx_boxes_location_id;
ALTER INDEX IF EXISTS idx_fridge_boxes_sublocation_id RENAME TO idx_boxes_sublocation_id;
ALTER INDEX IF EXISTS idx_fridge_boxes_display_order RENAME TO idx_boxes_display_order;
ALTER INDEX IF EXISTS idx_fridge_boxes_created_at RENAME TO idx_boxes_created_at;
ALTER INDEX IF EXISTS idx_fridge_boxes_name_trgm RENAME TO idx_boxes_name_trgm;
ALTER INDEX IF EXISTS idx_fridge_cells_box_id RENAME TO idx_cells_box_id;
ALTER INDEX IF EXISTS idx_fridge_cells_cell_id RENAME TO idx_cells_cell_id;
ALTER INDEX IF EXISTS idx_fridge_cells_created_at RENAME TO idx_cells_created_at;
ALTER INDEX IF EXISTS idx_fridge_cells_name_trgm RENAME TO idx_cells_name_trgm;
ALTER INDEX IF EXISTS idx_fridge_cells_information_trgm RENAME TO idx_cells_information_trgm;
ALTER INDEX IF EXISTS idx_fridge_cells_is_crossed RENAME TO idx_cells_is_crossed;

-- ============================================================
-- 4. Recreate Views with new naming
-- ============================================================
DROP VIEW IF EXISTS fridges_with_stats;
DROP VIEW IF EXISTS boxes_with_stats;
DROP VIEW IF EXISTS sublocations_with_stats;
DROP VIEW IF EXISTS positions_with_stats;

CREATE OR REPLACE VIEW locations_with_stats WITH (security_invoker = true) AS
SELECT f.id,
    f.name,
    f.accent_color,
    f.display_order,
    f.workspace_id,
    f.show_storage_boxes,
    f.show_inventory_items,
    f.location_type,
    f.icon_id,
    f.created_at,
    f.updated_at,
    COALESCE(b.box_count, 0::bigint) AS box_count,
    COALESCE(i.item_count, 0::bigint) AS item_count
FROM locations f
LEFT JOIN (
    SELECT boxes.location_id, count(*) AS box_count
    FROM boxes
    GROUP BY boxes.location_id
) b ON f.id = b.location_id
LEFT JOIN (
    SELECT inventory_items.location_id, count(*) AS item_count
    FROM inventory_items
    GROUP BY inventory_items.location_id
) i ON f.id = i.location_id;

CREATE OR REPLACE VIEW boxes_with_stats WITH (security_invoker = true) AS
SELECT b.id,
    b.location_id,
    b.sublocation_id,
    b.position_id,
    b.name,
    b.description,
    b.accent_color,
    b.rows,
    b.columns,
    b.name_font_divisor,
    b.info_font_divisor,
    b.slide_font_divisor,
    b.constrain_grid_height,
    b.box_type,
    b.display_order,
    b.icon_id,
    b.created_at,
    b.updated_at,
    COALESCE(c.cell_count, 0::bigint) AS occupied_cells,
    (b.rows * b.columns) AS total_cells,
    CASE
        WHEN (b.rows * b.columns) > 0 THEN (round(((COALESCE(c.cell_count, 0::bigint))::numeric / ((b.rows * b.columns))::numeric) * 100::numeric))::integer
        ELSE 0
    END AS utilization_percent
FROM boxes b
LEFT JOIN (
    SELECT cells.box_id, count(*) AS cell_count
    FROM cells
    WHERE cells.is_crossed = false
    GROUP BY cells.box_id
) c ON b.id = c.box_id;

CREATE OR REPLACE VIEW sublocations_with_stats WITH (security_invoker = true) AS
SELECT s.id,
    s.location_id,
    s.name,
    s.accent_color,
    s.display_order,
    s.location_type,
    s.icon_id,
    s.created_at,
    s.updated_at,
    COALESCE(box_stats.box_count, 0::bigint) AS box_count,
    COALESCE(item_stats.item_count, 0::bigint) AS item_count
FROM sublocations s
LEFT JOIN (
    SELECT boxes.sublocation_id, count(*) AS box_count
    FROM boxes
    WHERE boxes.sublocation_id IS NOT NULL
    GROUP BY boxes.sublocation_id
) box_stats ON s.id = box_stats.sublocation_id
LEFT JOIN (
    SELECT inventory_items.sublocation_id, count(*) AS item_count
    FROM inventory_items
    WHERE inventory_items.sublocation_id IS NOT NULL
    GROUP BY inventory_items.sublocation_id
) item_stats ON s.id = item_stats.sublocation_id;

CREATE OR REPLACE VIEW positions_with_stats WITH (security_invoker = true) AS
SELECT p.id,
    p.sublocation_id,
    p.name,
    p.accent_color,
    p.display_order,
    p.location_type,
    p.icon_id,
    p.created_at,
    p.updated_at,
    COALESCE(box_stats.box_count, 0::bigint) AS box_count,
    COALESCE(item_stats.item_count, 0::bigint) AS item_count
FROM sublocation_positions p
LEFT JOIN (
    SELECT boxes.position_id, count(*) AS box_count
    FROM boxes
    WHERE boxes.position_id IS NOT NULL
    GROUP BY boxes.position_id
) box_stats ON p.id = box_stats.position_id
LEFT JOIN (
    SELECT inventory_items.position_id, count(*) AS item_count
    FROM inventory_items
    WHERE inventory_items.position_id IS NOT NULL
    GROUP BY inventory_items.position_id
) item_stats ON p.id = item_stats.position_id;
