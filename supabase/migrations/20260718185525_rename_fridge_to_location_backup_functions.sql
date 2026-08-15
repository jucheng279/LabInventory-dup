/*
# Update backup and cron functions to use new location naming

## Summary
Recreates backup functions with updated table references and JSON key names.
JSON keys now use 'locations', 'sublocations', 'boxes', 'cells' instead of old fridge naming.

## Functions Updated
- create_workspace_backup (both overloads)
- cron_auto_backup_workspaces
- get_backup_stats
*/

-- Drop both overloads to recreate cleanly
DROP FUNCTION IF EXISTS public.create_workspace_backup(uuid);
DROP FUNCTION IF EXISTS public.create_workspace_backup(uuid, text, text);

-- Overload 1: simple backup
CREATE OR REPLACE FUNCTION public.create_workspace_backup(p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
v_team_member_id uuid; v_role text; v_snapshot jsonb; v_size integer; v_backup_id uuid; v_excess_ids uuid[];
BEGIN
SELECT id, role INTO v_team_member_id, v_role FROM team_members WHERE auth_user_id = auth.uid() AND workspace_id = p_workspace_id;
IF v_team_member_id IS NULL THEN RAISE EXCEPTION 'Not a member of this workspace'; END IF;
IF v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'Only owners and managers can create backups'; END IF;

SELECT row_to_json(w.*) INTO v_snapshot FROM (
SELECT name, live_sync_enabled, auto_open_first_folder, auto_open_first_item_folder, colorful_icons_enabled, auto_expand_all_locations, hierarchical_navigation
FROM workspaces WHERE id = p_workspace_id) w;

v_snapshot := jsonb_build_object(
'version', 2, 'workspace_id', p_workspace_id, 'created_at', now(), 'workspace_settings', v_snapshot,
'locations', COALESCE((SELECT jsonb_agg(row_to_json(f.*)::jsonb - 'workspace_id') FROM locations f WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'sublocations', COALESCE((SELECT jsonb_agg(row_to_json(fs.*)) FROM sublocations fs JOIN locations f ON f.id = fs.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'sublocation_positions', COALESCE((SELECT jsonb_agg(row_to_json(sp.*)) FROM sublocation_positions sp JOIN sublocations fs ON fs.id = sp.sublocation_id JOIN locations f ON f.id = fs.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'boxes', COALESCE((SELECT jsonb_agg(row_to_json(fb.*)) FROM boxes fb JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'cells', COALESCE((SELECT jsonb_agg(row_to_json(fc.*)) FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'item_folders', COALESCE((SELECT jsonb_agg(row_to_json(ifo.*)) FROM item_folders ifo JOIN locations f ON f.id = ifo.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'item_folder_headers', COALESCE((SELECT jsonb_agg(row_to_json(ifh.*)) FROM item_folder_headers ifh JOIN item_folders ifo ON ifo.id = ifh.folder_id JOIN locations f ON f.id = ifo.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'inventory_items', COALESCE((SELECT jsonb_agg(row_to_json(ii.*)) FROM inventory_items ii JOIN locations f ON f.id = ii.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'item_custom_values', COALESCE((SELECT jsonb_agg(row_to_json(icv.*)) FROM item_custom_values icv JOIN inventory_items ii ON ii.id = icv.item_id JOIN locations f ON f.id = ii.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'slide_box_headers', COALESCE((SELECT jsonb_agg(row_to_json(sbh.*)) FROM slide_box_headers sbh JOIN boxes fb ON fb.id = sbh.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'slide_cell_values', COALESCE((SELECT jsonb_agg(row_to_json(scv.*)) FROM slide_cell_values scv JOIN cells fc ON fc.id = scv.cell_id JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'box_grid_item_links', COALESCE((SELECT jsonb_agg(row_to_json(bgl.*)) FROM box_grid_item_links bgl JOIN boxes fb ON fb.id = bgl.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'box_history', COALESCE((SELECT jsonb_agg(row_to_json(bh.*)) FROM box_history bh JOIN boxes fb ON fb.id = bh.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'saved_search_filters', COALESCE((SELECT jsonb_agg(row_to_json(ssf.*)) FROM saved_search_filters ssf WHERE ssf.workspace_id = p_workspace_id), '[]'::jsonb)
);

v_size := octet_length(v_snapshot::text);
INSERT INTO workspace_backups (workspace_id, created_by, backup_data, backup_date, file_size_bytes)
VALUES (p_workspace_id, v_team_member_id, v_snapshot, CURRENT_DATE, v_size)
ON CONFLICT (workspace_id, backup_date) DO UPDATE SET backup_data = EXCLUDED.backup_data, file_size_bytes = EXCLUDED.file_size_bytes, created_by = EXCLUDED.created_by, created_at = now()
RETURNING id INTO v_backup_id;

SELECT array_agg(id) INTO v_excess_ids FROM (SELECT id FROM workspace_backups WHERE workspace_id = p_workspace_id ORDER BY backup_date DESC OFFSET 7) excess;
IF v_excess_ids IS NOT NULL THEN DELETE FROM workspace_backups WHERE id = ANY(v_excess_ids); END IF;

RETURN jsonb_build_object('backup_id', v_backup_id, 'backup_date', CURRENT_DATE, 'file_size_bytes', v_size);
END;
$function$;

-- Overload 2: typed backup with label
CREATE OR REPLACE FUNCTION public.create_workspace_backup(p_workspace_id uuid, p_backup_type text DEFAULT 'auto'::text, p_label text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_team_member_id uuid; v_role text; v_snapshot jsonb; v_size integer; v_backup_id uuid; v_excess_ids uuid[]; v_manual_count integer;
BEGIN
SELECT id, role INTO v_team_member_id, v_role FROM team_members WHERE auth_user_id = auth.uid() AND workspace_id = p_workspace_id;
IF v_team_member_id IS NULL THEN RAISE EXCEPTION 'Not a member of this workspace'; END IF;
IF v_role NOT IN ('owner', 'manager') THEN RAISE EXCEPTION 'Only owners and managers can create backups'; END IF;
IF p_backup_type NOT IN ('auto', 'manual') THEN RAISE EXCEPTION 'Invalid backup type: %', p_backup_type; END IF;

IF p_backup_type = 'manual' THEN
SELECT count(*) INTO v_manual_count FROM workspace_backups WHERE workspace_id = p_workspace_id AND backup_type = 'manual';
IF v_manual_count >= 3 THEN RAISE EXCEPTION 'Maximum 3 manual backups allowed. Delete one to create a new one.'; END IF;
END IF;

SELECT row_to_json(w.*) INTO v_snapshot FROM (
SELECT name, live_sync_enabled, auto_open_first_folder, auto_open_first_item_folder, colorful_icons_enabled, auto_expand_all_locations, hierarchical_navigation, rotate_wide_grid_mobile
FROM workspaces WHERE id = p_workspace_id) w;

v_snapshot := jsonb_build_object(
'version', 2, 'workspace_id', p_workspace_id, 'created_at', now(), 'workspace_settings', v_snapshot,
'locations', COALESCE((SELECT jsonb_agg(row_to_json(f.*)::jsonb - 'workspace_id') FROM locations f WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'sublocations', COALESCE((SELECT jsonb_agg(row_to_json(fs.*)) FROM sublocations fs JOIN locations f ON f.id = fs.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'sublocation_positions', COALESCE((SELECT jsonb_agg(row_to_json(sp.*)) FROM sublocation_positions sp JOIN sublocations fs ON fs.id = sp.sublocation_id JOIN locations f ON f.id = fs.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'boxes', COALESCE((SELECT jsonb_agg(row_to_json(fb.*)) FROM boxes fb JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'cells', COALESCE((SELECT jsonb_agg(row_to_json(fc.*)) FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'item_folders', COALESCE((SELECT jsonb_agg(row_to_json(ifo.*)) FROM item_folders ifo JOIN locations f ON f.id = ifo.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'item_folder_headers', COALESCE((SELECT jsonb_agg(row_to_json(ifh.*)) FROM item_folder_headers ifh JOIN item_folders ifo ON ifo.id = ifh.folder_id JOIN locations f ON f.id = ifo.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'inventory_items', COALESCE((SELECT jsonb_agg(row_to_json(ii.*)) FROM inventory_items ii JOIN locations f ON f.id = ii.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'item_custom_values', COALESCE((SELECT jsonb_agg(row_to_json(icv.*)) FROM item_custom_values icv JOIN inventory_items ii ON ii.id = icv.item_id JOIN locations f ON f.id = ii.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'slide_box_headers', COALESCE((SELECT jsonb_agg(row_to_json(sbh.*)) FROM slide_box_headers sbh JOIN boxes fb ON fb.id = sbh.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'slide_cell_values', COALESCE((SELECT jsonb_agg(row_to_json(scv.*)) FROM slide_cell_values scv JOIN cells fc ON fc.id = scv.cell_id JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'box_grid_item_links', COALESCE((SELECT jsonb_agg(row_to_json(bgl.*)) FROM box_grid_item_links bgl JOIN boxes fb ON fb.id = bgl.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'saved_search_filters', COALESCE((SELECT jsonb_agg(row_to_json(ssf.*)) FROM saved_search_filters ssf WHERE ssf.workspace_id = p_workspace_id), '[]'::jsonb),
'box_privacy_settings', COALESCE((SELECT jsonb_agg(row_to_json(bps.*)) FROM box_privacy_settings bps JOIN boxes fb ON fb.id = bps.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'box_access_list', COALESCE((SELECT jsonb_agg(row_to_json(bal.*)) FROM box_access_list bal JOIN boxes fb ON fb.id = bal.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = p_workspace_id), '[]'::jsonb),
'box_qr_codes', COALESCE((SELECT jsonb_agg(row_to_json(bqr.*)) FROM box_qr_codes bqr WHERE bqr.workspace_id = p_workspace_id), '[]'::jsonb),
'projects', COALESCE((SELECT jsonb_agg(row_to_json(pr.*)) FROM projects pr WHERE pr.workspace_id = p_workspace_id), '[]'::jsonb),
'experiments', COALESCE((SELECT jsonb_agg(row_to_json(ex.*)) FROM experiments ex JOIN projects pr ON pr.id = ex.project_id WHERE pr.workspace_id = p_workspace_id), '[]'::jsonb),
'project_box_links', COALESCE((SELECT jsonb_agg(row_to_json(pbl.*)) FROM project_box_links pbl JOIN projects pr ON pr.id = pbl.project_id WHERE pr.workspace_id = p_workspace_id), '[]'::jsonb),
'project_item_links', COALESCE((SELECT jsonb_agg(row_to_json(pil.*)) FROM project_item_links pil JOIN projects pr ON pr.id = pil.project_id WHERE pr.workspace_id = p_workspace_id), '[]'::jsonb),
'project_privacy_settings', COALESCE((SELECT jsonb_agg(row_to_json(pps.*)) FROM project_privacy_settings pps JOIN projects pr ON pr.id = pps.project_id WHERE pr.workspace_id = p_workspace_id), '[]'::jsonb),
'project_access_list', COALESCE((SELECT jsonb_agg(row_to_json(pal.*)) FROM project_access_list pal JOIN projects pr ON pr.id = pal.project_id WHERE pr.workspace_id = p_workspace_id), '[]'::jsonb)
);

v_size := octet_length(v_snapshot::text);

IF p_backup_type = 'auto' THEN
INSERT INTO workspace_backups (workspace_id, created_by, backup_data, backup_date, file_size_bytes, backup_type, label)
VALUES (p_workspace_id, v_team_member_id, v_snapshot, CURRENT_DATE, v_size, 'auto', NULL)
ON CONFLICT (workspace_id, backup_date) WHERE backup_type = 'auto'
DO UPDATE SET backup_data = EXCLUDED.backup_data, file_size_bytes = EXCLUDED.file_size_bytes, created_by = EXCLUDED.created_by, created_at = now()
RETURNING id INTO v_backup_id;

DELETE FROM workspace_backups WHERE workspace_id = p_workspace_id AND backup_type = 'auto' AND backup_date < CURRENT_DATE - INTERVAL '7 days';
SELECT array_agg(id) INTO v_excess_ids FROM (SELECT id FROM workspace_backups WHERE workspace_id = p_workspace_id AND backup_type = 'auto' ORDER BY backup_date DESC OFFSET 7) excess;
IF v_excess_ids IS NOT NULL THEN DELETE FROM workspace_backups WHERE id = ANY(v_excess_ids); END IF;
ELSE
INSERT INTO workspace_backups (workspace_id, created_by, backup_data, backup_date, file_size_bytes, backup_type, label)
VALUES (p_workspace_id, v_team_member_id, v_snapshot, CURRENT_DATE, v_size, 'manual', p_label)
RETURNING id INTO v_backup_id;
END IF;

RETURN jsonb_build_object('backup_id', v_backup_id, 'backup_date', CURRENT_DATE, 'file_size_bytes', v_size);
END;
$function$;

-- cron_auto_backup_workspaces
CREATE OR REPLACE FUNCTION public.cron_auto_backup_workspaces()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws record; v_snapshot jsonb; v_size integer; v_owner_tm_id uuid; v_last_auto date; v_has_activity boolean;
BEGIN
FOR v_ws IN SELECT id FROM workspaces LOOP
SELECT backup_date INTO v_last_auto FROM workspace_backups WHERE workspace_id = v_ws.id AND backup_type = 'auto' ORDER BY backup_date DESC LIMIT 1;
IF v_last_auto = CURRENT_DATE THEN CONTINUE; END IF;

v_has_activity := false;
IF v_last_auto IS NULL THEN
SELECT EXISTS(SELECT 1 FROM locations WHERE workspace_id = v_ws.id) INTO v_has_activity;
ELSE
IF EXISTS(SELECT 1 FROM locations WHERE workspace_id = v_ws.id AND updated_at > v_last_auto) THEN v_has_activity := true;
ELSIF EXISTS(SELECT 1 FROM boxes fb JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws.id AND fb.updated_at > v_last_auto) THEN v_has_activity := true;
ELSIF EXISTS(SELECT 1 FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws.id AND fc.updated_at > v_last_auto) THEN v_has_activity := true;
ELSIF EXISTS(SELECT 1 FROM inventory_items ii JOIN locations f ON f.id = ii.location_id WHERE f.workspace_id = v_ws.id AND ii.updated_at > v_last_auto) THEN v_has_activity := true;
ELSIF EXISTS(SELECT 1 FROM item_folders ifo JOIN locations f ON f.id = ifo.location_id WHERE f.workspace_id = v_ws.id AND ifo.updated_at > v_last_auto) THEN v_has_activity := true;
ELSIF EXISTS(SELECT 1 FROM projects pr WHERE pr.workspace_id = v_ws.id AND pr.updated_at > v_last_auto) THEN v_has_activity := true;
END IF;
END IF;

IF NOT v_has_activity THEN CONTINUE; END IF;
SELECT id INTO v_owner_tm_id FROM team_members WHERE workspace_id = v_ws.id AND role = 'owner' LIMIT 1;
IF v_owner_tm_id IS NULL THEN CONTINUE; END IF;

SELECT row_to_json(w.*) INTO v_snapshot FROM (SELECT name, live_sync_enabled, auto_open_first_folder, auto_open_first_item_folder, colorful_icons_enabled, auto_expand_all_locations, hierarchical_navigation, rotate_wide_grid_mobile FROM workspaces WHERE id = v_ws.id) w;

v_snapshot := jsonb_build_object(
'version', 2, 'workspace_id', v_ws.id, 'created_at', now(), 'workspace_settings', v_snapshot,
'locations', COALESCE((SELECT jsonb_agg(row_to_json(f.*)::jsonb - 'workspace_id') FROM locations f WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'sublocations', COALESCE((SELECT jsonb_agg(row_to_json(fs.*)) FROM sublocations fs JOIN locations f ON f.id = fs.location_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'sublocation_positions', COALESCE((SELECT jsonb_agg(row_to_json(sp.*)) FROM sublocation_positions sp JOIN sublocations fs ON fs.id = sp.sublocation_id JOIN locations f ON f.id = fs.location_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'boxes', COALESCE((SELECT jsonb_agg(row_to_json(fb.*)) FROM boxes fb JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'cells', COALESCE((SELECT jsonb_agg(row_to_json(fc.*)) FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'item_folders', COALESCE((SELECT jsonb_agg(row_to_json(ifo.*)) FROM item_folders ifo JOIN locations f ON f.id = ifo.location_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'item_folder_headers', COALESCE((SELECT jsonb_agg(row_to_json(ifh.*)) FROM item_folder_headers ifh JOIN item_folders ifo ON ifo.id = ifh.folder_id JOIN locations f ON f.id = ifo.location_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'inventory_items', COALESCE((SELECT jsonb_agg(row_to_json(ii.*)) FROM inventory_items ii JOIN locations f ON f.id = ii.location_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'item_custom_values', COALESCE((SELECT jsonb_agg(row_to_json(icv.*)) FROM item_custom_values icv JOIN inventory_items ii ON ii.id = icv.item_id JOIN locations f ON f.id = ii.location_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'slide_box_headers', COALESCE((SELECT jsonb_agg(row_to_json(sbh.*)) FROM slide_box_headers sbh JOIN boxes fb ON fb.id = sbh.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'slide_cell_values', COALESCE((SELECT jsonb_agg(row_to_json(scv.*)) FROM slide_cell_values scv JOIN cells fc ON fc.id = scv.cell_id JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'box_grid_item_links', COALESCE((SELECT jsonb_agg(row_to_json(bgl.*)) FROM box_grid_item_links bgl JOIN boxes fb ON fb.id = bgl.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'saved_search_filters', COALESCE((SELECT jsonb_agg(row_to_json(ssf.*)) FROM saved_search_filters ssf WHERE ssf.workspace_id = v_ws.id), '[]'::jsonb),
'box_privacy_settings', COALESCE((SELECT jsonb_agg(row_to_json(bps.*)) FROM box_privacy_settings bps JOIN boxes fb ON fb.id = bps.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'box_access_list', COALESCE((SELECT jsonb_agg(row_to_json(bal.*)) FROM box_access_list bal JOIN boxes fb ON fb.id = bal.box_id JOIN locations f ON f.id = fb.location_id WHERE f.workspace_id = v_ws.id), '[]'::jsonb),
'box_qr_codes', COALESCE((SELECT jsonb_agg(row_to_json(bqr.*)) FROM box_qr_codes bqr WHERE bqr.workspace_id = v_ws.id), '[]'::jsonb),
'projects', COALESCE((SELECT jsonb_agg(row_to_json(pr.*)) FROM projects pr WHERE pr.workspace_id = v_ws.id), '[]'::jsonb),
'experiments', COALESCE((SELECT jsonb_agg(row_to_json(ex.*)) FROM experiments ex JOIN projects pr ON pr.id = ex.project_id WHERE pr.workspace_id = v_ws.id), '[]'::jsonb),
'project_box_links', COALESCE((SELECT jsonb_agg(row_to_json(pbl.*)) FROM project_box_links pbl JOIN projects pr ON pr.id = pbl.project_id WHERE pr.workspace_id = v_ws.id), '[]'::jsonb),
'project_item_links', COALESCE((SELECT jsonb_agg(row_to_json(pil.*)) FROM project_item_links pil JOIN projects pr ON pr.id = pil.project_id WHERE pr.workspace_id = v_ws.id), '[]'::jsonb),
'project_privacy_settings', COALESCE((SELECT jsonb_agg(row_to_json(pps.*)) FROM project_privacy_settings pps JOIN projects pr ON pr.id = pps.project_id WHERE pr.workspace_id = v_ws.id), '[]'::jsonb),
'project_access_list', COALESCE((SELECT jsonb_agg(row_to_json(pal.*)) FROM project_access_list pal JOIN projects pr ON pr.id = pal.project_id WHERE pr.workspace_id = v_ws.id), '[]'::jsonb)
);

v_size := octet_length(v_snapshot::text);
INSERT INTO workspace_backups (workspace_id, created_by, backup_data, backup_date, file_size_bytes, backup_type, label)
VALUES (v_ws.id, v_owner_tm_id, v_snapshot, CURRENT_DATE, v_size, 'auto', NULL)
ON CONFLICT (workspace_id, backup_date) WHERE backup_type = 'auto'
DO UPDATE SET backup_data = EXCLUDED.backup_data, file_size_bytes = EXCLUDED.file_size_bytes, created_by = EXCLUDED.created_by, created_at = now();

DELETE FROM workspace_backups WHERE workspace_id = v_ws.id AND backup_type = 'auto' AND backup_date < CURRENT_DATE - INTERVAL '7 days';
END LOOP;
END;
$function$;

-- get_backup_stats
CREATE OR REPLACE FUNCTION public.get_backup_stats(p_backup_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
v_data jsonb; v_result jsonb;
BEGIN
SELECT backup_data INTO v_data FROM workspace_backups WHERE id = p_backup_id;
IF v_data IS NULL THEN RETURN jsonb_build_object('error', 'Backup not found'); END IF;

v_result := jsonb_build_object(
'locations', jsonb_array_length(COALESCE(v_data->'locations', '[]'::jsonb)),
'sublocations', jsonb_array_length(COALESCE(v_data->'sublocations', '[]'::jsonb)),
'boxes', jsonb_array_length(COALESCE(v_data->'boxes', '[]'::jsonb)),
'cells', jsonb_array_length(COALESCE(v_data->'cells', '[]'::jsonb)),
'item_folders', jsonb_array_length(COALESCE(v_data->'item_folders', '[]'::jsonb)),
'inventory_items', jsonb_array_length(COALESCE(v_data->'inventory_items', '[]'::jsonb))
);
RETURN v_result;
END;
$function$;
