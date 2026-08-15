/*
# Update restore_workspace_backup to use new location naming

## Summary
Rewrites restore function to use new table names (locations, sublocations, boxes, cells)
and read from new-format backup JSON keys. Only supports version 2 backups.
*/

CREATE OR REPLACE FUNCTION public.restore_workspace_backup(p_backup_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_team_member_id uuid; v_role text; v_backup record; v_data jsonb; v_ws_id uuid; v_elem jsonb;
BEGIN
SELECT * INTO v_backup FROM workspace_backups WHERE id = p_backup_id;
IF v_backup IS NULL THEN RAISE EXCEPTION 'Backup not found'; END IF;
v_ws_id := v_backup.workspace_id;
v_data := v_backup.backup_data;

SELECT id, role INTO v_team_member_id, v_role FROM team_members WHERE auth_user_id = auth.uid() AND workspace_id = v_ws_id;
IF v_team_member_id IS NULL THEN RAISE EXCEPTION 'Not a member of this workspace'; END IF;
IF v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'Only owners and managers can restore backups'; END IF;

-- Delete all existing data in reverse dependency order
DELETE FROM project_access_list WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = v_ws_id);
DELETE FROM project_privacy_settings WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = v_ws_id);
DELETE FROM project_item_links WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = v_ws_id);
DELETE FROM project_box_links WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = v_ws_id);
DELETE FROM experiments WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = v_ws_id);
DELETE FROM projects WHERE workspace_id = v_ws_id;
DELETE FROM box_qr_codes WHERE workspace_id = v_ws_id;
DELETE FROM box_access_list WHERE box_id IN (SELECT fb.id FROM boxes fb JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws_id);
DELETE FROM box_privacy_settings WHERE box_id IN (SELECT fb.id FROM boxes fb JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws_id);
DELETE FROM slide_cell_values WHERE cell_id IN (SELECT fc.id FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws_id);
DELETE FROM slide_box_headers WHERE box_id IN (SELECT fb.id FROM boxes fb JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws_id);
DELETE FROM item_custom_values WHERE item_id IN (SELECT ii.id FROM inventory_items ii JOIN locations f ON f.id = ii.location_id WHERE f.workspace_id = v_ws_id);
DELETE FROM item_folder_headers WHERE folder_id IN (SELECT ifo.id FROM item_folders ifo JOIN locations f ON f.id = ifo.location_id WHERE f.workspace_id = v_ws_id);
DELETE FROM box_grid_item_links WHERE box_id IN (SELECT fb.id FROM boxes fb JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws_id);
DELETE FROM box_history WHERE box_id IN (SELECT fb.id FROM boxes fb JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws_id);
DELETE FROM saved_search_filters WHERE workspace_id = v_ws_id;
DELETE FROM cells WHERE box_id IN (SELECT fb.id FROM boxes fb JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws_id);
DELETE FROM inventory_items WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id);
DELETE FROM item_folders WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id);
DELETE FROM boxes WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id);
DELETE FROM sublocation_positions WHERE sublocation_id IN (SELECT fs.id FROM sublocations fs JOIN locations f ON f.id = fs.location_id WHERE f.workspace_id = v_ws_id);
DELETE FROM sublocations WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id);
DELETE FROM locations WHERE workspace_id = v_ws_id;

-- Restore workspace settings
UPDATE workspaces SET
name = COALESCE(v_data->'workspace_settings'->>'name', name),
live_sync_enabled = COALESCE((v_data->'workspace_settings'->>'live_sync_enabled')::boolean, live_sync_enabled),
auto_open_first_folder = COALESCE((v_data->'workspace_settings'->>'auto_open_first_folder')::boolean, auto_open_first_folder),
auto_open_first_item_folder = COALESCE((v_data->'workspace_settings'->>'auto_open_first_item_folder')::boolean, auto_open_first_item_folder),
colorful_icons_enabled = COALESCE((v_data->'workspace_settings'->>'colorful_icons_enabled')::boolean, colorful_icons_enabled),
auto_expand_all_locations = COALESCE((v_data->'workspace_settings'->>'auto_expand_all_locations')::boolean, auto_expand_all_locations),
hierarchical_navigation = COALESCE((v_data->'workspace_settings'->>'hierarchical_navigation')::boolean, hierarchical_navigation),
rotate_wide_grid_mobile = COALESCE((v_data->'workspace_settings'->>'rotate_wide_grid_mobile')::boolean, rotate_wide_grid_mobile),
updated_at = now()
WHERE id = v_ws_id;

-- Restore locations
FOR v_elem IN SELECT jsonb_array_elements(v_data->'locations') LOOP
INSERT INTO locations (id, name, accent_color, display_order, workspace_id, show_storage_boxes, show_inventory_items, location_type, icon_id, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, v_elem->>'name', v_elem->>'accent_color', (v_elem->>'display_order')::integer, v_ws_id, COALESCE((v_elem->>'show_storage_boxes')::boolean, true), COALESCE((v_elem->>'show_inventory_items')::boolean, true), COALESCE(v_elem->>'location_type', 'fridge'), v_elem->>'icon_id', COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore sublocations
FOR v_elem IN SELECT jsonb_array_elements(v_data->'sublocations') LOOP
INSERT INTO sublocations (id, location_id, name, accent_color, display_order, location_type, icon_id, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'location_id')::uuid, v_elem->>'name', v_elem->>'accent_color', (v_elem->>'display_order')::integer, COALESCE(v_elem->>'location_type', 'general'), v_elem->>'icon_id', COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore positions
FOR v_elem IN SELECT jsonb_array_elements(v_data->'sublocation_positions') LOOP
INSERT INTO sublocation_positions (id, sublocation_id, name, accent_color, display_order, location_type, icon_id, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'sublocation_id')::uuid, v_elem->>'name', v_elem->>'accent_color', (v_elem->>'display_order')::integer, COALESCE(v_elem->>'location_type', 'general'), v_elem->>'icon_id', COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore boxes
FOR v_elem IN SELECT jsonb_array_elements(v_data->'boxes') LOOP
INSERT INTO boxes (id, location_id, sublocation_id, position_id, name, description, accent_color, rows, columns, box_type, name_font_divisor, info_font_divisor, slide_font_divisor, constrain_grid_height, icon_id, display_order, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'location_id')::uuid, (v_elem->>'sublocation_id')::uuid, (v_elem->>'position_id')::uuid, v_elem->>'name', COALESCE(v_elem->>'description', ''), v_elem->>'accent_color', COALESCE((v_elem->>'rows')::integer, 8), COALESCE((v_elem->>'columns')::integer, 12), COALESCE(v_elem->>'box_type', 'freezer'), COALESCE((v_elem->>'name_font_divisor')::integer, 8), COALESCE((v_elem->>'info_font_divisor')::integer, 10), COALESCE((v_elem->>'slide_font_divisor')::integer, 10), COALESCE((v_elem->>'constrain_grid_height')::boolean, true), v_elem->>'icon_id', COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore cells
FOR v_elem IN SELECT jsonb_array_elements(v_data->'cells') LOOP
INSERT INTO cells (id, cell_id, box_id, name, information, date, color, is_crossed, date_type, slide_image_url, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, v_elem->>'cell_id', (v_elem->>'box_id')::uuid, v_elem->>'name', COALESCE(v_elem->>'information', ''), (v_elem->>'date')::date, v_elem->>'color', COALESCE((v_elem->>'is_crossed')::boolean, false), COALESCE(v_elem->>'date_type', 'date'), v_elem->>'slide_image_url', COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore item folders
FOR v_elem IN SELECT jsonb_array_elements(v_data->'item_folders') LOOP
INSERT INTO item_folders (id, location_id, sublocation_id, position_id, name, description, accent_color, icon_id, display_order, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'location_id')::uuid, (v_elem->>'sublocation_id')::uuid, (v_elem->>'position_id')::uuid, v_elem->>'name', COALESCE(v_elem->>'description', ''), v_elem->>'accent_color', v_elem->>'icon_id', COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore item folder headers
FOR v_elem IN SELECT jsonb_array_elements(v_data->'item_folder_headers') LOOP
INSERT INTO item_folder_headers (id, folder_id, header_text, header_type, display_order, created_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'folder_id')::uuid, COALESCE(v_elem->>'header_text', ''), COALESCE(v_elem->>'header_type', 'text'), COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()));
END LOOP;

-- Restore inventory items
FOR v_elem IN SELECT jsonb_array_elements(v_data->'inventory_items') LOOP
INSERT INTO inventory_items (id, location_id, sublocation_id, position_id, folder_id, name, description, stock_number, stock_threshold, unit, non_counted, item_type, accent_color, icon_id, display_order, freeze_thaw_cycles, display_mode, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'location_id')::uuid, (v_elem->>'sublocation_id')::uuid, (v_elem->>'position_id')::uuid, (v_elem->>'folder_id')::uuid, v_elem->>'name', COALESCE(v_elem->>'description', ''), COALESCE((v_elem->>'stock_number')::integer, 0), (v_elem->>'stock_threshold')::integer, COALESCE(v_elem->>'unit', ''), COALESCE((v_elem->>'non_counted')::boolean, false), v_elem->>'item_type', v_elem->>'accent_color', v_elem->>'icon_id', COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'freeze_thaw_cycles')::integer, 0), COALESCE(v_elem->>'display_mode', 'stock'), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore item custom values
FOR v_elem IN SELECT jsonb_array_elements(v_data->'item_custom_values') LOOP
INSERT INTO item_custom_values (id, item_id, header_id, value, created_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'item_id')::uuid, (v_elem->>'header_id')::uuid, COALESCE(v_elem->>'value', ''), COALESCE((v_elem->>'created_at')::timestamptz, now()));
END LOOP;

-- Restore slide box headers
FOR v_elem IN SELECT jsonb_array_elements(v_data->'slide_box_headers') LOOP
INSERT INTO slide_box_headers (id, box_id, header_text, header_type, display_order, created_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'box_id')::uuid, COALESCE(v_elem->>'header_text', ''), COALESCE(v_elem->>'header_type', 'text'), COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()));
END LOOP;

-- Restore slide cell values
FOR v_elem IN SELECT jsonb_array_elements(v_data->'slide_cell_values') LOOP
INSERT INTO slide_cell_values (id, cell_id, header_id, value, created_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'cell_id')::uuid, (v_elem->>'header_id')::uuid, COALESCE(v_elem->>'value', ''), COALESCE((v_elem->>'created_at')::timestamptz, now()));
END LOOP;

-- Restore box grid item links
FOR v_elem IN SELECT jsonb_array_elements(v_data->'box_grid_item_links') LOOP
INSERT INTO box_grid_item_links (id, box_id, item_id, link_type, linked_name, linked_info, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'box_id')::uuid, (v_elem->>'item_id')::uuid, v_elem->>'link_type', v_elem->>'linked_name', v_elem->>'linked_info', COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore saved search filters
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'saved_search_filters', '[]'::jsonb)) LOOP
IF EXISTS (SELECT 1 FROM team_members WHERE id = (v_elem->>'team_member_id')::uuid) THEN
INSERT INTO saved_search_filters (id, workspace_id, team_member_id, filter_text, created_at)
VALUES ((v_elem->>'id')::uuid, v_ws_id, (v_elem->>'team_member_id')::uuid, v_elem->>'filter_text', COALESCE((v_elem->>'created_at')::timestamptz, now()));
END IF;
END LOOP;

-- Restore box privacy settings
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'box_privacy_settings', '[]'::jsonb)) LOOP
IF EXISTS (SELECT 1 FROM team_members WHERE id = (v_elem->>'owner_id')::uuid) THEN
INSERT INTO box_privacy_settings (id, box_id, privacy_mode, owner_id, owner_only_delete, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'box_id')::uuid, COALESCE(v_elem->>'privacy_mode', 'open'), (v_elem->>'owner_id')::uuid, COALESCE((v_elem->>'owner_only_delete')::boolean, false), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END IF;
END LOOP;

-- Restore box access list
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'box_access_list', '[]'::jsonb)) LOOP
IF EXISTS (SELECT 1 FROM team_members WHERE id = (v_elem->>'team_member_id')::uuid) AND EXISTS (SELECT 1 FROM box_privacy_settings WHERE box_id = (v_elem->>'box_id')::uuid) THEN
INSERT INTO box_access_list (id, box_id, team_member_id, access_level, created_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'box_id')::uuid, (v_elem->>'team_member_id')::uuid, v_elem->>'access_level', COALESCE((v_elem->>'created_at')::timestamptz, now()));
END IF;
END LOOP;

-- Restore box QR codes
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'box_qr_codes', '[]'::jsonb)) LOOP
IF EXISTS (SELECT 1 FROM team_members WHERE id = (v_elem->>'created_by')::uuid) THEN
INSERT INTO box_qr_codes (id, box_id, workspace_id, token, label, created_by, created_at, revoked_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'box_id')::uuid, v_ws_id, v_elem->>'token', v_elem->>'label', (v_elem->>'created_by')::uuid, COALESCE((v_elem->>'created_at')::timestamptz, now()), (v_elem->>'revoked_at')::timestamptz);
END IF;
END LOOP;

-- Restore projects
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'projects', '[]'::jsonb)) LOOP
INSERT INTO projects (id, workspace_id, name, icon_id, accent_color, display_order, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, v_ws_id, v_elem->>'name', v_elem->>'icon_id', COALESCE(v_elem->>'accent_color', '#3b82f6'), COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore experiments
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'experiments', '[]'::jsonb)) LOOP
INSERT INTO experiments (id, project_id, name, icon_id, accent_color, display_order, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'project_id')::uuid, v_elem->>'name', v_elem->>'icon_id', COALESCE(v_elem->>'accent_color', '#3b82f6'), COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END LOOP;

-- Restore project box/item links
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'project_box_links', '[]'::jsonb)) LOOP
INSERT INTO project_box_links (id, project_id, experiment_id, box_id, display_order, created_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'project_id')::uuid, (v_elem->>'experiment_id')::uuid, (v_elem->>'box_id')::uuid, COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()));
END LOOP;

FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'project_item_links', '[]'::jsonb)) LOOP
INSERT INTO project_item_links (id, project_id, experiment_id, item_id, display_order, created_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'project_id')::uuid, (v_elem->>'experiment_id')::uuid, (v_elem->>'item_id')::uuid, COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()));
END LOOP;

-- Restore project privacy
FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'project_privacy_settings', '[]'::jsonb)) LOOP
IF EXISTS (SELECT 1 FROM team_members WHERE id = (v_elem->>'owner_id')::uuid) THEN
INSERT INTO project_privacy_settings (id, project_id, privacy_mode, owner_id, owner_only_delete, created_at, updated_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'project_id')::uuid, COALESCE(v_elem->>'privacy_mode', 'open'), (v_elem->>'owner_id')::uuid, COALESCE((v_elem->>'owner_only_delete')::boolean, false), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
END IF;
END LOOP;

FOR v_elem IN SELECT jsonb_array_elements(COALESCE(v_data->'project_access_list', '[]'::jsonb)) LOOP
IF EXISTS (SELECT 1 FROM team_members WHERE id = (v_elem->>'team_member_id')::uuid) AND EXISTS (SELECT 1 FROM project_privacy_settings WHERE project_id = (v_elem->>'project_id')::uuid) THEN
INSERT INTO project_access_list (id, project_id, team_member_id, access_level, created_at)
VALUES ((v_elem->>'id')::uuid, (v_elem->>'project_id')::uuid, (v_elem->>'team_member_id')::uuid, v_elem->>'access_level', COALESCE((v_elem->>'created_at')::timestamptz, now()));
END IF;
END LOOP;

RETURN jsonb_build_object('success', true, 'restored_from', v_backup.backup_date);
END;
$function$;
