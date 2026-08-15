/*
# Rename inventory_items.description column to note

1. Column Rename
   - Renames `description` to `note` on `inventory_items` table.
   - This is a non-destructive rename (no data lost).

2. Updated Functions
   - `ai_get_entity_details`: SELECT and JSON output now use `note` instead of `description`.
   - `ai_search_workspace`: SELECT, WHERE ILIKE, and JSON output now use `note` instead of `description`.
   - `ai_get_project_contents`: SELECT and JSON output now use `note` instead of `description`.
   - `restore_workspace_backup`: INSERT into inventory_items now uses `note` column, still reads `description` key from backup JSON for backward compatibility with existing backups.

3. Important Notes
   - The JSON output key in AI functions is changed from 'description' to 'note' for consistency.
   - The restore function reads BOTH 'note' and 'description' from the backup JSON (COALESCE) for backward compatibility with backups created before this rename.
*/

-- 1. Rename the column
ALTER TABLE inventory_items RENAME COLUMN description TO note;

-- 2. Recreate ai_get_entity_details to use 'note'
CREATE OR REPLACE FUNCTION public.ai_get_entity_details(p_team_member_id uuid, p_entity_type text, p_entity_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
AS $function$
DECLARE
  v_ws_id uuid;
  v_is_owner boolean;
  rec record;
  v_result jsonb;
  v_custom_values jsonb;
BEGIN
  SELECT tm.workspace_id, (tm.role = 'owner') INTO v_ws_id, v_is_owner FROM team_members tm WHERE tm.id = p_team_member_id;
  IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Team member not found'); END IF;

  IF p_entity_type = 'cell' THEN
    SELECT c.id, c.name, c.information, c.cell_id, c.date, c.date_type, c.color, c.is_crossed,
      fb.id AS box_id, fb.name AS box_name, fb.box_type,
      fb.location_id, fb.sublocation_id, fb.position_id
    INTO rec FROM freezer_box_cells c JOIN freezer_boxes fb ON fb.id = c.box_id
    JOIN locations f ON f.id = fb.location_id WHERE c.id = p_entity_id AND f.workspace_id = v_ws_id;

    IF rec IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not found'); END IF;
    IF NOT v_is_owner THEN
      IF EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = rec.box_id AND bps.privacy_mode = 'restricted'
        AND bps.owner_id != p_team_member_id AND NOT EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = rec.box_id AND bal.team_member_id = p_team_member_id))
      THEN RETURN jsonb_build_object('ok', false, 'error', 'Access denied'); END IF;
    END IF;

    IF rec.box_type IN ('slide', 'structured_freezer') THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('header', sbh.header_text, 'header_type', sbh.header_type, 'value', scv.value) ORDER BY sbh.display_order), '[]'::jsonb)
      INTO v_custom_values FROM slide_cell_values scv JOIN slide_box_headers sbh ON sbh.id = scv.header_id WHERE scv.cell_id = rec.id;
    END IF;

    v_result := jsonb_build_object('ok', true, 'entity_type', 'cell', 'id', rec.id, 'name', rec.name,
      'information', rec.information, 'cell_id', rec.cell_id, 'date', rec.date, 'date_type', rec.date_type,
      'color', rec.color, 'is_crossed', rec.is_crossed, 'box_id', rec.box_id, 'box_name', rec.box_name, 'box_type', rec.box_type,
      'expiration_date', CASE WHEN rec.date_type = 'expiration' AND rec.date IS NOT NULL THEN rec.date::text ELSE NULL END,
      'expiration_status', CASE WHEN rec.date_type != 'expiration' OR rec.date IS NULL THEN 'unknown' WHEN rec.date < CURRENT_DATE THEN 'expired' WHEN rec.date <= CURRENT_DATE + 30 THEN 'expiring_soon' ELSE 'valid' END,
      'custom_values', v_custom_values, 'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));

  ELSIF p_entity_type = 'item' THEN
    SELECT ii.id, ii.name, ii.note, ii.stock_number, ii.stock_threshold, ii.unit, ii.item_type,
      ii.non_counted, ii.display_mode, ii.freeze_thaw_cycles, ii.location_id, ii.sublocation_id, ii.position_id,
      ii.folder_id, ifo.name AS folder_name
    INTO rec FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
    LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id WHERE ii.id = p_entity_id AND f.workspace_id = v_ws_id;

    IF rec IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not found'); END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object('header', ifh.header_text, 'header_type', ifh.header_type, 'value', icv.value) ORDER BY ifh.display_order), '[]'::jsonb)
    INTO v_custom_values FROM item_custom_values icv JOIN item_folder_headers ifh ON ifh.id = icv.header_id WHERE icv.item_id = rec.id;

    v_result := jsonb_build_object('ok', true, 'entity_type', 'item', 'id', rec.id, 'name', rec.name,
      'note', rec.note, 'item_type', rec.item_type, 'stock_number', rec.stock_number,
      'stock_threshold', rec.stock_threshold, 'unit', rec.unit, 'non_counted', rec.non_counted,
      'display_mode', rec.display_mode, 'freeze_thaw_cycles', rec.freeze_thaw_cycles, 'folder_name', rec.folder_name,
      'low_stock', CASE WHEN rec.non_counted THEN false WHEN rec.stock_threshold IS NULL THEN false ELSE rec.stock_number <= rec.stock_threshold END,
      'custom_values', v_custom_values, 'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid entity type');
  END IF;

  RETURN v_result;
END;
$function$;

-- 3. Recreate ai_search_workspace to use 'note'
CREATE OR REPLACE FUNCTION public.ai_search_workspace(p_team_member_id uuid, p_query text, p_entity_types text[] DEFAULT ARRAY['cell','item','box'], p_location_id uuid DEFAULT NULL, p_include_crossed boolean DEFAULT false, p_only_available boolean DEFAULT false, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
AS $function$
DECLARE
  v_ws_id uuid;
  v_is_owner boolean;
  rec record;
  v_results jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_query_lower text := lower(p_query);
BEGIN
  SELECT tm.workspace_id, (tm.role = 'owner') INTO v_ws_id, v_is_owner FROM team_members tm WHERE tm.id = p_team_member_id;
  IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Team member not found'); END IF;

  IF 'cell' = ANY(p_entity_types) THEN
    FOR rec IN
      SELECT c.id, c.name, c.information, c.cell_id, c.date, c.date_type, c.is_crossed,
        fb.id AS box_id, fb.name AS box_name, fb.box_type, fb.location_id, fb.sublocation_id, fb.position_id,
        CASE WHEN lower(c.name) = v_query_lower THEN 100 WHEN lower(c.name) LIKE v_query_lower || '%' THEN 80
        WHEN lower(c.information) = v_query_lower THEN 70 WHEN lower(c.name) LIKE '%' || v_query_lower || '%' THEN 60
        WHEN lower(c.information) LIKE '%' || v_query_lower || '%' THEN 50 ELSE 30 END AS score
      FROM freezer_box_cells c JOIN freezer_boxes fb ON fb.id = c.box_id JOIN locations f ON f.id = fb.location_id
      WHERE f.workspace_id = v_ws_id AND c.name IS NOT NULL AND c.name != ''
      AND (c.name ILIKE '%' || p_query || '%' OR c.information ILIKE '%' || p_query || '%')
      AND (p_include_crossed OR c.is_crossed = false)
      AND (p_location_id IS NULL OR fb.location_id = p_location_id)
      ORDER BY score DESC, c.name LIMIT p_limit
    LOOP
      IF NOT v_is_owner THEN
        IF EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = rec.box_id AND bps.privacy_mode = 'restricted'
          AND bps.owner_id != p_team_member_id AND NOT EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = rec.box_id AND bal.team_member_id = p_team_member_id))
        THEN CONTINUE; END IF;
      END IF;
      v_results := v_results || jsonb_build_object('entity_type', 'cell', 'id', rec.id, 'display_name', rec.name,
        'information', rec.information, 'cell_id', rec.cell_id, 'box_id', rec.box_id, 'box_name', rec.box_name, 'box_type', rec.box_type,
        'date', rec.date, 'date_type', rec.date_type, 'is_crossed', rec.is_crossed,
        'expiration_date', CASE WHEN rec.date_type = 'expiration' AND rec.date IS NOT NULL THEN rec.date::text ELSE NULL END,
        'expiration_status', CASE WHEN rec.date_type != 'expiration' OR rec.date IS NULL THEN 'unknown' WHEN rec.date < CURRENT_DATE THEN 'expired' WHEN rec.date <= CURRENT_DATE + 30 THEN 'expiring_soon' ELSE 'valid' END,
        'is_crossed', rec.is_crossed, 'location_breadcrumb', (ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id))->>'breadcrumb',
        'score', rec.score, 'match_reason', CASE WHEN lower(rec.name) = v_query_lower THEN 'exact_name_match' WHEN lower(rec.name) LIKE v_query_lower || '%' THEN 'name_prefix' WHEN lower(rec.information) = v_query_lower THEN 'exact_info_match' ELSE 'partial_match' END);
      v_total := v_total + 1;
    END LOOP;
  END IF;

  IF 'item' = ANY(p_entity_types) THEN
    FOR rec IN
      SELECT ii.id, ii.name, ii.note, ii.stock_number, ii.stock_threshold, ii.unit, ii.item_type,
        ii.non_counted, ii.location_id, ii.sublocation_id, ii.position_id, ii.freeze_thaw_cycles,
        CASE WHEN lower(ii.name) = v_query_lower THEN 100 WHEN lower(ii.name) LIKE v_query_lower || '%' THEN 80
        WHEN lower(ii.note) = v_query_lower THEN 70 WHEN lower(ii.name) LIKE '%' || v_query_lower || '%' THEN 60
        WHEN lower(ii.note) LIKE '%' || v_query_lower || '%' THEN 50 ELSE 30 END AS score
      FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
      WHERE f.workspace_id = v_ws_id AND (ii.name ILIKE '%' || p_query || '%' OR ii.note ILIKE '%' || p_query || '%')
      AND (p_location_id IS NULL OR ii.location_id = p_location_id)
      AND (NOT p_only_available OR (ii.non_counted = true OR ii.stock_number > 0))
      ORDER BY score DESC, ii.name LIMIT p_limit
    LOOP
      v_results := v_results || jsonb_build_object('entity_type', 'item', 'id', rec.id, 'display_name', rec.name,
        'note', rec.note, 'item_type', rec.item_type, 'stock_number', rec.stock_number,
        'stock_threshold', rec.stock_threshold, 'unit', rec.unit, 'non_counted', rec.non_counted,
        'freeze_thaw_cycles', rec.freeze_thaw_cycles,
        'location_breadcrumb', (ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id))->>'breadcrumb',
        'score', rec.score, 'match_reason', CASE WHEN lower(rec.name) = v_query_lower THEN 'exact_name_match' WHEN lower(rec.name) LIKE v_query_lower || '%' THEN 'name_prefix' ELSE 'partial_match' END);
      v_total := v_total + 1;
    END LOOP;
  END IF;

  IF 'box' = ANY(p_entity_types) THEN
    FOR rec IN
      SELECT fb.id, fb.name, fb.box_type, fb.rows, fb.columns, fb.location_id, fb.sublocation_id, fb.position_id,
        CASE WHEN lower(fb.name) = v_query_lower THEN 100 WHEN lower(fb.name) LIKE v_query_lower || '%' THEN 80
        WHEN lower(fb.name) LIKE '%' || v_query_lower || '%' THEN 60 ELSE 30 END AS score
      FROM freezer_boxes fb JOIN locations f ON f.id = fb.location_id
      WHERE f.workspace_id = v_ws_id AND fb.name ILIKE '%' || p_query || '%'
      AND (p_location_id IS NULL OR fb.location_id = p_location_id)
      ORDER BY score DESC, fb.name LIMIT p_limit
    LOOP
      IF NOT v_is_owner THEN
        IF EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = rec.id AND bps.privacy_mode = 'restricted'
          AND bps.owner_id != p_team_member_id AND NOT EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = rec.id AND bal.team_member_id = p_team_member_id))
        THEN CONTINUE; END IF;
      END IF;
      v_results := v_results || jsonb_build_object('entity_type', 'box', 'id', rec.id, 'display_name', rec.name,
        'box_type', rec.box_type, 'grid_size', rec.rows || 'x' || rec.columns,
        'location_breadcrumb', (ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id))->>'breadcrumb',
        'score', rec.score);
      v_total := v_total + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true, 'total', v_total, 'results', v_results);
END;
$function$;

-- 4. Recreate ai_get_project_contents to use 'note'
CREATE OR REPLACE FUNCTION public.ai_get_project_contents(p_team_member_id uuid, p_project_id uuid, p_experiment_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
AS $function$
DECLARE
  v_ws_id uuid;
  v_project_name text;
  v_access text;
  v_experiments jsonb;
  v_items jsonb := '[]'::jsonb;
  v_boxes jsonb := '[]'::jsonb;
  v_custom_values jsonb;
  rec record;
BEGIN
  SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
  IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Team member not found'); END IF;

  SELECT p.name INTO v_project_name FROM projects p WHERE p.id = p_project_id AND p.workspace_id = v_ws_id;
  IF v_project_name IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Project not found'); END IF;
  v_access := resolve_project_access(p_project_id, p_team_member_id);
  IF v_access = 'none' THEN RETURN jsonb_build_object('ok', false, 'error', 'Access denied'); END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name) ORDER BY e.display_order, e.name), '[]'::jsonb)
  INTO v_experiments FROM experiments e WHERE e.project_id = p_project_id;

  FOR rec IN
    SELECT pil.experiment_id, e.name AS experiment_name, ii.id AS item_id, ii.name AS item_name, ii.note,
      ii.stock_number, ii.unit, ii.item_type, ii.stock_threshold, ii.non_counted, ii.freeze_thaw_cycles,
      ii.location_id, ii.sublocation_id, ii.position_id, ifo.name AS folder_name
    FROM project_item_links pil JOIN inventory_items ii ON ii.id = pil.item_id
    JOIN locations f ON f.id = ii.location_id LEFT JOIN experiments e ON e.id = pil.experiment_id
    LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id
    WHERE pil.project_id = p_project_id AND f.workspace_id = v_ws_id
    AND (p_experiment_id IS NULL OR pil.experiment_id IS NOT DISTINCT FROM p_experiment_id)
    ORDER BY pil.display_order
  LOOP
    SELECT COALESCE(jsonb_agg(jsonb_build_object('header', ifh.header_text, 'header_type', ifh.header_type, 'value', icv.value) ORDER BY ifh.display_order), '[]'::jsonb)
    INTO v_custom_values FROM item_custom_values icv JOIN item_folder_headers ifh ON ifh.id = icv.header_id WHERE icv.item_id = rec.item_id AND icv.value != '';

    v_items := v_items || jsonb_build_object('item_id', rec.item_id, 'name', rec.item_name, 'note', rec.note,
      'item_type', rec.item_type, 'stock_number', rec.stock_number, 'unit', rec.unit, 'stock_threshold', rec.stock_threshold,
      'non_counted', rec.non_counted, 'freeze_thaw_cycles', rec.freeze_thaw_cycles, 'folder_name', rec.folder_name,
      'custom_values', v_custom_values, 'experiment_id', rec.experiment_id, 'experiment_name', rec.experiment_name,
      'location_breadcrumb', (ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id))->>'breadcrumb');
  END LOOP;

  FOR rec IN
    SELECT pbl.experiment_id, e.name AS experiment_name, fb.id AS box_id, fb.name AS box_name, fb.box_type,
      fb.rows, fb.columns, fb.location_id, fb.sublocation_id, fb.position_id
    FROM project_box_links pbl JOIN freezer_boxes fb ON fb.id = pbl.box_id
    JOIN locations f ON f.id = fb.location_id LEFT JOIN experiments e ON e.id = pbl.experiment_id
    WHERE pbl.project_id = p_project_id AND f.workspace_id = v_ws_id
    AND (p_experiment_id IS NULL OR pbl.experiment_id IS NOT DISTINCT FROM p_experiment_id)
    ORDER BY pbl.display_order
  LOOP
    v_boxes := v_boxes || jsonb_build_object('box_id', rec.box_id, 'name', rec.box_name, 'box_type', rec.box_type,
      'grid_size', rec.rows || 'x' || rec.columns, 'experiment_id', rec.experiment_id, 'experiment_name', rec.experiment_name,
      'location_breadcrumb', (ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id))->>'breadcrumb');
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'project_name', v_project_name, 'access_level', v_access,
    'experiments', v_experiments, 'items', v_items, 'boxes', v_boxes);
END;
$function$;

-- 5. Update restore_workspace_backup to use 'note' column (reads both 'note' and 'description' from JSON for backward compat)
CREATE OR REPLACE FUNCTION public.restore_workspace_backup(p_team_member_id uuid, p_backup_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_ws_id uuid;
  v_role text;
  v_data jsonb;
  v_elem jsonb;
BEGIN
  SELECT tm.workspace_id, tm.role INTO v_ws_id, v_role FROM team_members tm WHERE tm.id = p_team_member_id;
  IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Team member not found'); END IF;
  IF v_role != 'owner' THEN RETURN jsonb_build_object('ok', false, 'error', 'Only owner can restore'); END IF;

  v_data := p_backup_data;

  -- Delete existing data (in dependency order)
  DELETE FROM item_custom_values WHERE item_id IN (SELECT id FROM inventory_items WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id));
  DELETE FROM inventory_items WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id);
  DELETE FROM item_folder_headers WHERE folder_id IN (SELECT id FROM item_folders WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id));
  DELETE FROM item_folders WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id);
  DELETE FROM freezer_box_cells WHERE box_id IN (SELECT id FROM freezer_boxes WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id));
  DELETE FROM slide_cell_values WHERE cell_id IN (SELECT c.id FROM freezer_box_cells c JOIN freezer_boxes fb ON fb.id = c.box_id WHERE fb.location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id));
  DELETE FROM slide_box_headers WHERE box_id IN (SELECT id FROM freezer_boxes WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id));
  DELETE FROM freezer_boxes WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id);
  DELETE FROM sublocation_positions WHERE sublocation_id IN (SELECT id FROM sublocations WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id));
  DELETE FROM sublocations WHERE location_id IN (SELECT id FROM locations WHERE workspace_id = v_ws_id);
  DELETE FROM locations WHERE workspace_id = v_ws_id;

  -- Restore locations
  FOR v_elem IN SELECT jsonb_array_elements(v_data->'locations') LOOP
    INSERT INTO locations (id, workspace_id, name, accent_color, display_order, show_storage_boxes, show_inventory_items, location_type, icon_id, created_at, updated_at)
    VALUES ((v_elem->>'id')::uuid, v_ws_id, v_elem->>'name', v_elem->>'accent_color', COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'show_storage_boxes')::boolean, true), COALESCE((v_elem->>'show_inventory_items')::boolean, true), COALESCE(v_elem->>'location_type', 'fridge'), v_elem->>'icon_id', COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
  END LOOP;

  -- Restore sublocations
  FOR v_elem IN SELECT jsonb_array_elements(v_data->'sublocations') LOOP
    INSERT INTO sublocations (id, location_id, name, display_order, created_at, updated_at)
    VALUES ((v_elem->>'id')::uuid, (v_elem->>'location_id')::uuid, v_elem->>'name', COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
  END LOOP;

  -- Restore positions
  FOR v_elem IN SELECT jsonb_array_elements(v_data->'sublocation_positions') LOOP
    INSERT INTO sublocation_positions (id, sublocation_id, name, description, display_order, created_at, updated_at)
    VALUES ((v_elem->>'id')::uuid, (v_elem->>'sublocation_id')::uuid, v_elem->>'name', COALESCE(v_elem->>'description', ''), COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
  END LOOP;

  -- Restore freezer boxes
  FOR v_elem IN SELECT jsonb_array_elements(v_data->'freezer_boxes') LOOP
    INSERT INTO freezer_boxes (id, location_id, sublocation_id, position_id, name, description, rows, columns, accent_color, display_order, box_type, icon_id, created_at, updated_at)
    VALUES ((v_elem->>'id')::uuid, (v_elem->>'location_id')::uuid, (v_elem->>'sublocation_id')::uuid, (v_elem->>'position_id')::uuid, v_elem->>'name', COALESCE(v_elem->>'description', ''), COALESCE((v_elem->>'rows')::integer, 9), COALESCE((v_elem->>'columns')::integer, 9), v_elem->>'accent_color', COALESCE((v_elem->>'display_order')::integer, 0), COALESCE(v_elem->>'box_type', 'freezer'), v_elem->>'icon_id', COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
  END LOOP;

  -- Restore slide box headers
  FOR v_elem IN SELECT jsonb_array_elements(v_data->'slide_box_headers') LOOP
    INSERT INTO slide_box_headers (id, box_id, header_text, header_type, display_order, created_at)
    VALUES ((v_elem->>'id')::uuid, (v_elem->>'box_id')::uuid, v_elem->>'header_text', COALESCE(v_elem->>'header_type', 'text'), COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()));
  END LOOP;

  -- Restore cells
  FOR v_elem IN SELECT jsonb_array_elements(v_data->'freezer_box_cells') LOOP
    INSERT INTO freezer_box_cells (id, box_id, cell_id, name, information, date, color, is_crossed, date_type, created_at, updated_at)
    VALUES ((v_elem->>'id')::uuid, (v_elem->>'box_id')::uuid, v_elem->>'cell_id', v_elem->>'name', COALESCE(v_elem->>'information', ''), v_elem->>'date', v_elem->>'color', COALESCE((v_elem->>'is_crossed')::boolean, false), COALESCE(v_elem->>'date_type', 'date'), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
  END LOOP;

  -- Restore slide cell values
  FOR v_elem IN SELECT jsonb_array_elements(v_data->'slide_cell_values') LOOP
    INSERT INTO slide_cell_values (id, cell_id, header_id, value, created_at)
    VALUES ((v_elem->>'id')::uuid, (v_elem->>'cell_id')::uuid, (v_elem->>'header_id')::uuid, COALESCE(v_elem->>'value', ''), COALESCE((v_elem->>'created_at')::timestamptz, now()));
  END LOOP;

  -- Restore item folders
  FOR v_elem IN SELECT jsonb_array_elements(v_data->'item_folders') LOOP
    INSERT INTO item_folders (id, location_id, sublocation_id, position_id, name, description, accent_color, display_order, icon_id, created_at, updated_at)
    VALUES ((v_elem->>'id')::uuid, (v_elem->>'location_id')::uuid, (v_elem->>'sublocation_id')::uuid, (v_elem->>'position_id')::uuid, v_elem->>'name', COALESCE(v_elem->>'description', ''), v_elem->>'accent_color', COALESCE((v_elem->>'display_order')::integer, 0), v_elem->>'icon_id', COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
  END LOOP;

  -- Restore item folder headers
  FOR v_elem IN SELECT jsonb_array_elements(v_data->'item_folder_headers') LOOP
    INSERT INTO item_folder_headers (id, folder_id, header_text, header_type, display_order, created_at)
    VALUES ((v_elem->>'id')::uuid, (v_elem->>'folder_id')::uuid, v_elem->>'header_text', COALESCE(v_elem->>'header_type', 'text'), COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'created_at')::timestamptz, now()));
  END LOOP;

  -- Restore inventory items (reads 'note' first, falls back to 'description' for old backups)
  FOR v_elem IN SELECT jsonb_array_elements(v_data->'inventory_items') LOOP
    INSERT INTO inventory_items (id, location_id, sublocation_id, position_id, folder_id, name, note, stock_number, stock_threshold, unit, non_counted, item_type, accent_color, icon_id, display_order, freeze_thaw_cycles, display_mode, created_at, updated_at)
    VALUES ((v_elem->>'id')::uuid, (v_elem->>'location_id')::uuid, (v_elem->>'sublocation_id')::uuid, (v_elem->>'position_id')::uuid, (v_elem->>'folder_id')::uuid, v_elem->>'name', COALESCE(v_elem->>'note', v_elem->>'description', ''), COALESCE((v_elem->>'stock_number')::integer, 0), (v_elem->>'stock_threshold')::integer, COALESCE(v_elem->>'unit', ''), COALESCE((v_elem->>'non_counted')::boolean, false), v_elem->>'item_type', v_elem->>'accent_color', v_elem->>'icon_id', COALESCE((v_elem->>'display_order')::integer, 0), COALESCE((v_elem->>'freeze_thaw_cycles')::integer, 0), COALESCE(v_elem->>'display_mode', 'stock'), COALESCE((v_elem->>'created_at')::timestamptz, now()), now());
  END LOOP;

  -- Restore item custom values
  FOR v_elem IN SELECT jsonb_array_elements(v_data->'item_custom_values') LOOP
    INSERT INTO item_custom_values (id, item_id, header_id, value, created_at)
    VALUES ((v_elem->>'id')::uuid, (v_elem->>'item_id')::uuid, (v_elem->>'header_id')::uuid, COALESCE(v_elem->>'value', ''), COALESCE((v_elem->>'created_at')::timestamptz, now()));
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$function$;
