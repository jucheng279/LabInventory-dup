/*
# Update all AI functions to return short codes instead of UUIDs

1. Modified Functions
   - `ai_get_location_breadcrumb`: Path entries now return `code` (e.g. "L3")
     instead of `id` (UUID). Boxes also get a code entry when a box_id is
     provided via the new optional p_box_id parameter.
   - `ai_search_inventory`: Returns `ref` (e.g. "B7:A1") for cells, `code`
     (e.g. "B7") for boxes, and location codes in the breadcrumb path.
     UUIDs removed from output. Also fixes item `description` -> `note` bug.
   - `ai_list_expiring_inventory`: Same code-based output.
   - `ai_list_low_stock_items`: Same code-based output.
   - `ai_get_item_details`: Returns codes instead of UUIDs. Fixes
     `ii.description` -> `ii.note` bug.
   - `ai_get_item_locations`: Returns codes in location path.
   - `ai_get_project_contents`: Returns box/item codes. Fixes `freezer_boxes`
     -> `boxes` table reference bug.
   - `ai_list_projects`: No UUID changes needed (returns project metadata).

2. New Functions
   - `ai_resolve_codes`: Given a workspace_id and array of short codes
     (e.g. ["L1","S3","B7"]), returns a JSON mapping of each code to its
     real UUID plus metadata (name, type, box_type, accent_color). Used by
     the edge function to translate codes back to UUIDs for navigation.

3. Security
   - All functions retain their existing security posture (SECURITY DEFINER
     where applicable, search_path = public, grants to authenticated only).
   - `ai_resolve_codes` is SECURITY DEFINER with search_path = public,
     granted to authenticated only.

4. Important Notes
   - The AI never sees or outputs UUIDs. Short codes like L1, S3, P2, B7
     are used instead, dramatically reducing token output.
   - Cells use combined format: B{box_code}:{cell_coordinate} e.g. "B7:A1"
   - The `ai_resolve_codes` function is called by the edge function after
     streaming completes to build a code-to-UUID mapping for the browser.
*/

-- ============================================================
-- ai_get_location_breadcrumb - return codes instead of UUIDs
-- ============================================================
DROP FUNCTION IF EXISTS public.ai_get_location_breadcrumb(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.ai_get_location_breadcrumb(
  p_location_id uuid,
  p_sublocation_id uuid DEFAULT NULL,
  p_position_id uuid DEFAULT NULL,
  p_box_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fn$
DECLARE
  v_path jsonb := '[]'::jsonb;
  v_breadcrumb text := '';
  v_name text; v_type text; v_code int;
BEGIN
  IF p_location_id IS NULL THEN
    RETURN jsonb_build_object('path', '[]'::jsonb, 'breadcrumb', '');
  END IF;

  SELECT name, location_type, ai_code INTO v_name, v_type, v_code
  FROM locations WHERE id = p_location_id;
  IF v_name IS NOT NULL THEN
    v_path := v_path || jsonb_build_object('code', 'L' || v_code, 'name', v_name, 'type', COALESCE(v_type, 'location'));
    v_breadcrumb := v_name;
  END IF;

  IF p_sublocation_id IS NOT NULL THEN
    SELECT name, location_type, ai_code INTO v_name, v_type, v_code
    FROM sublocations WHERE id = p_sublocation_id;
    IF v_name IS NOT NULL THEN
      v_path := v_path || jsonb_build_object('code', 'S' || v_code, 'name', v_name, 'type', COALESCE(v_type, 'sublocation'));
      v_breadcrumb := v_breadcrumb || ' > ' || v_name;
    END IF;
  END IF;

  IF p_position_id IS NOT NULL THEN
    SELECT name, location_type, ai_code INTO v_name, v_type, v_code
    FROM sublocation_positions WHERE id = p_position_id;
    IF v_name IS NOT NULL THEN
      v_path := v_path || jsonb_build_object('code', 'P' || v_code, 'name', v_name, 'type', COALESCE(v_type, 'position'));
      v_breadcrumb := v_breadcrumb || ' > ' || v_name;
    END IF;
  END IF;

  IF p_box_id IS NOT NULL THEN
    SELECT name, ai_code INTO v_name, v_code FROM boxes WHERE id = p_box_id;
    IF v_name IS NOT NULL THEN
      v_path := v_path || jsonb_build_object('code', 'B' || v_code, 'name', v_name, 'type', 'box');
      v_breadcrumb := v_breadcrumb || ' > ' || v_name;
    END IF;
  END IF;

  RETURN jsonb_build_object('path', v_path, 'breadcrumb', v_breadcrumb);
END;
$fn$;

REVOKE ALL ON FUNCTION ai_get_location_breadcrumb FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_get_location_breadcrumb TO authenticated;

-- ============================================================
-- ai_search_inventory - return codes instead of UUIDs
-- ============================================================
CREATE OR REPLACE FUNCTION ai_search_inventory(
  p_team_member_id uuid,
  p_query text,
  p_entity_types text[] DEFAULT ARRAY['cell','item','box'],
  p_location_id uuid DEFAULT NULL,
  p_include_crossed boolean DEFAULT false,
  p_only_available boolean DEFAULT false,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
v_ws_id uuid; v_is_owner boolean; v_results jsonb := '[]'::jsonb; v_query_lower text; v_total integer := 0; rec record;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('status', 'error', 'message', 'Invalid team member'); END IF;
SELECT (w.owner_id = p_team_member_id) INTO v_is_owner FROM workspaces w WHERE w.id = v_ws_id;
v_query_lower := lower(trim(p_query));
IF v_query_lower = '' OR length(v_query_lower) < 1 THEN RETURN jsonb_build_object('status', 'not_found', 'matches', '[]'::jsonb, 'total_count', 0); END IF;

IF 'cell' = ANY(p_entity_types) THEN
FOR rec IN
SELECT fc.id, fc.name, fc.information, fc.date, fc.date_type, fc.cell_id, fc.is_crossed,
fb.id AS box_id, fb.name AS box_name, fb.box_type, fb.ai_code AS box_code, fb.location_id, fb.sublocation_id, fb.position_id,
CASE WHEN lower(fc.name) = v_query_lower THEN 100 WHEN lower(fc.name) LIKE v_query_lower || '%' THEN 80
WHEN lower(fc.information) = v_query_lower THEN 70 WHEN lower(fc.name) LIKE '%' || v_query_lower || '%' THEN 60
WHEN lower(fc.information) LIKE '%' || v_query_lower || '%' THEN 50 ELSE 30 END AS score
FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = v_ws_id AND (p_include_crossed OR fc.is_crossed = false)
AND (fc.name ILIKE '%' || p_query || '%' OR fc.information ILIKE '%' || p_query || '%')
AND (p_location_id IS NULL OR fb.location_id = p_location_id)
AND (v_is_owner OR NOT EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id)
OR EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.privacy_mode = 'open')
OR EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.owner_id = p_team_member_id)
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id))
ORDER BY score DESC, fc.name LIMIT p_limit
LOOP
v_results := v_results || jsonb_build_object('entity_type', 'cell', 'ref', 'B' || rec.box_code || ':' || rec.cell_id, 'display_name', rec.name,
'information', rec.information, 'cell_id', rec.cell_id, 'box_name', rec.box_name, 'box_code', 'B' || rec.box_code, 'box_type', rec.box_type,
'expiration_date', CASE WHEN rec.date_type = 'expiration' AND rec.date IS NOT NULL THEN rec.date::text ELSE NULL END,
'expiration_status', CASE WHEN rec.date_type != 'expiration' OR rec.date IS NULL THEN 'unknown' WHEN rec.date < CURRENT_DATE THEN 'expired' WHEN rec.date <= CURRENT_DATE + 30 THEN 'expiring_soon' ELSE 'valid' END,
'is_crossed', rec.is_crossed,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.box_id),
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
v_results := v_results || jsonb_build_object('entity_type', 'item', 'display_name', rec.name,
'note', rec.note, 'item_type', rec.item_type, 'stock_number', rec.stock_number,
'stock_threshold', rec.stock_threshold, 'unit', rec.unit, 'non_counted', rec.non_counted,
'freeze_thaw_cycles', rec.freeze_thaw_cycles,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id),
'score', rec.score, 'match_reason', CASE WHEN lower(rec.name) = v_query_lower THEN 'exact_name_match' WHEN lower(rec.name) LIKE v_query_lower || '%' THEN 'name_prefix' ELSE 'partial_match' END);
v_total := v_total + 1;
END LOOP;
END IF;

IF 'box' = ANY(p_entity_types) THEN
FOR rec IN
SELECT fb.id, fb.name, fb.box_type, fb.ai_code, fb.rows AS box_rows, fb.columns AS box_cols,
fb.location_id, fb.sublocation_id, fb.position_id,
CASE WHEN lower(fb.name) = v_query_lower THEN 100 WHEN lower(fb.name) LIKE v_query_lower || '%' THEN 80
WHEN lower(fb.name) LIKE '%' || v_query_lower || '%' THEN 60 ELSE 30 END AS score
FROM boxes fb JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = v_ws_id AND fb.name ILIKE '%' || p_query || '%'
AND (p_location_id IS NULL OR fb.location_id = p_location_id)
AND (v_is_owner OR NOT EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id)
OR EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.privacy_mode = 'open')
OR EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.owner_id = p_team_member_id)
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id))
ORDER BY score DESC, fb.name LIMIT p_limit
LOOP
v_results := v_results || jsonb_build_object('entity_type', 'box', 'code', 'B' || rec.ai_code, 'display_name', rec.name,
'box_type', rec.box_type, 'dimensions', rec.box_rows || 'x' || rec.box_cols,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.id),
'score', rec.score, 'match_reason', CASE WHEN lower(rec.name) = v_query_lower THEN 'exact_name_match' WHEN lower(rec.name) LIKE v_query_lower || '%' THEN 'name_prefix' ELSE 'partial_match' END);
v_total := v_total + 1;
END LOOP;
END IF;

RETURN jsonb_build_object('status', CASE WHEN v_total = 0 THEN 'not_found' WHEN v_total = 1 THEN 'unique' ELSE 'multiple' END,
'matches', v_results, 'total_count', v_total, 'query', p_query);
END;
$fn$;

REVOKE ALL ON FUNCTION ai_search_inventory FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_search_inventory TO authenticated;

-- ============================================================
-- ai_list_expiring_inventory - return codes instead of UUIDs
-- ============================================================
CREATE OR REPLACE FUNCTION ai_list_expiring_inventory(
  p_team_member_id uuid,
  p_within_days integer DEFAULT 30,
  p_include_expired boolean DEFAULT true,
  p_location_id uuid DEFAULT NULL,
  p_only_available boolean DEFAULT false,
  p_sort text DEFAULT 'expiration_ascending',
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $fn$
DECLARE
v_ws_id uuid; v_is_owner boolean; v_cutoff_date date; v_results jsonb := '[]'::jsonb;
v_expired_count integer := 0; v_expiring_count integer := 0; rec record;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member'); END IF;
SELECT (w.owner_id = p_team_member_id) INTO v_is_owner FROM workspaces w WHERE w.id = v_ws_id;
v_cutoff_date := CURRENT_DATE + (p_within_days || ' days')::interval;

FOR rec IN
SELECT fc.id, 'cell' AS entity_type, fc.name AS display_name, fc.date::text AS expiration_date,
fc.cell_id, fc.is_crossed, fb.id AS box_id, fb.name AS box_name, fb.box_type, fb.ai_code AS box_code,
fb.location_id, fb.sublocation_id, fb.position_id, fc.date AS exp_date
FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = v_ws_id AND fc.date_type = 'expiration' AND fc.date IS NOT NULL
AND fc.is_crossed = false AND fc.date <= v_cutoff_date
AND (NOT p_only_available OR fc.is_crossed = false)
AND (p_location_id IS NULL OR fb.location_id = p_location_id)
AND (p_include_expired OR fc.date >= CURRENT_DATE)
AND (v_is_owner OR NOT EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.privacy_mode = 'restricted')
OR EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.owner_id = p_team_member_id)
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id))
ORDER BY CASE WHEN p_sort = 'expiration_ascending' THEN fc.date END ASC,
CASE WHEN p_sort = 'expiration_descending' THEN fc.date END DESC,
CASE WHEN p_sort = 'name' THEN fc.name END ASC
LIMIT p_limit
LOOP
IF rec.exp_date < CURRENT_DATE THEN v_expired_count := v_expired_count + 1; ELSE v_expiring_count := v_expiring_count + 1; END IF;
v_results := v_results || jsonb_build_object('entity_type', rec.entity_type, 'ref', 'B' || rec.box_code || ':' || rec.cell_id,
'display_name', rec.display_name,
'expiration_date', rec.expiration_date, 'days_until_expiration', rec.exp_date - CURRENT_DATE,
'status', CASE WHEN rec.exp_date < CURRENT_DATE THEN 'expired' ELSE 'expiring_soon' END,
'box_name', rec.box_name, 'box_code', 'B' || rec.box_code, 'box_type', rec.box_type,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.box_id));
END LOOP;

FOR rec IN
SELECT ii.id, 'item' AS entity_type, ii.name AS display_name, icv.value AS expiration_date,
ii.location_id, ii.sublocation_id, ii.position_id, icv.value::date AS exp_date
FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
JOIN item_custom_values icv ON icv.item_id = ii.id JOIN item_folder_headers ifh ON ifh.id = icv.header_id
WHERE f.workspace_id = v_ws_id AND ifh.header_type = 'expiration'
AND icv.value IS NOT NULL AND icv.value != '' AND icv.value ~ '^\d{4}-\d{2}-\d{2}$'
AND icv.value::date <= v_cutoff_date
AND (p_location_id IS NULL OR ii.location_id = p_location_id)
AND (p_include_expired OR icv.value::date >= CURRENT_DATE)
AND (NOT p_only_available OR ii.non_counted = true OR ii.stock_number > 0)
ORDER BY CASE WHEN p_sort = 'expiration_ascending' THEN icv.value::date END ASC,
CASE WHEN p_sort = 'expiration_descending' THEN icv.value::date END DESC,
CASE WHEN p_sort = 'name' THEN ii.name END ASC
LIMIT p_limit
LOOP
IF rec.exp_date < CURRENT_DATE THEN v_expired_count := v_expired_count + 1; ELSE v_expiring_count := v_expiring_count + 1; END IF;
v_results := v_results || jsonb_build_object('entity_type', rec.entity_type, 'display_name', rec.display_name,
'expiration_date', rec.expiration_date, 'days_until_expiration', rec.exp_date - CURRENT_DATE,
'status', CASE WHEN rec.exp_date < CURRENT_DATE THEN 'expired' ELSE 'expiring_soon' END,
'box_code', NULL, 'box_name', NULL, 'box_type', NULL,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
END LOOP;

RETURN jsonb_build_object('ok', true, 'window_start', CURRENT_DATE::text, 'window_end', v_cutoff_date::text,
'counts', jsonb_build_object('expired', v_expired_count, 'expiring_soon', v_expiring_count),
'items', v_results, 'total_count', jsonb_array_length(v_results), 'truncated', jsonb_array_length(v_results) >= p_limit);
END;
$fn$;

REVOKE ALL ON FUNCTION ai_list_expiring_inventory FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_list_expiring_inventory TO authenticated;

-- ============================================================
-- ai_list_low_stock_items - return codes instead of UUIDs
-- ============================================================
CREATE OR REPLACE FUNCTION ai_list_low_stock_items(
  p_team_member_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_include_out_of_stock boolean DEFAULT true,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $fn$
DECLARE
v_ws_id uuid; v_results jsonb := '[]'::jsonb; v_low_count integer := 0; v_out_count integer := 0; rec record;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member'); END IF;

FOR rec IN
SELECT ii.id, ii.name, ii.stock_number, ii.stock_threshold, ii.unit, ii.item_type,
ii.location_id, ii.sublocation_id, ii.position_id, ifo.name AS folder_name
FROM inventory_items ii JOIN locations f ON f.id = ii.location_id LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id
WHERE f.workspace_id = v_ws_id AND ii.non_counted = false AND ii.stock_threshold IS NOT NULL
AND ii.stock_number <= ii.stock_threshold AND (p_location_id IS NULL OR ii.location_id = p_location_id)
AND (p_include_out_of_stock OR ii.stock_number > 0)
ORDER BY CASE WHEN ii.stock_number <= 0 THEN 0 ELSE 1 END, (ii.stock_number::float / GREATEST(ii.stock_threshold, 1)), ii.name
LIMIT p_limit
LOOP
IF rec.stock_number <= 0 THEN v_out_count := v_out_count + 1; ELSE v_low_count := v_low_count + 1; END IF;
v_results := v_results || jsonb_build_object('display_name', rec.name, 'item_type', rec.item_type,
'stock_number', rec.stock_number, 'stock_threshold', rec.stock_threshold, 'unit', rec.unit,
'deficit', rec.stock_threshold - rec.stock_number,
'severity', CASE WHEN rec.stock_number <= 0 THEN 'out_of_stock' WHEN rec.stock_number <= (rec.stock_threshold * 0.5) THEN 'critical' ELSE 'low' END,
'folder_name', rec.folder_name,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
END LOOP;

RETURN jsonb_build_object('ok', true, 'counts', jsonb_build_object('low_stock', v_low_count, 'out_of_stock', v_out_count),
'items', v_results, 'total_count', jsonb_array_length(v_results), 'truncated', jsonb_array_length(v_results) >= p_limit);
END;
$fn$;

REVOKE ALL ON FUNCTION ai_list_low_stock_items FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_list_low_stock_items TO authenticated;

-- ============================================================
-- ai_get_item_details - return codes, fix description->note bug
-- ============================================================
CREATE OR REPLACE FUNCTION public.ai_get_item_details(p_team_member_id uuid, p_entity_type text, p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fn$
DECLARE
v_ws_id uuid; v_is_owner boolean; v_result jsonb; rec record; v_custom_values jsonb := '[]'::jsonb;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member'); END IF;
SELECT (w.owner_id = p_team_member_id) INTO v_is_owner FROM workspaces w WHERE w.id = v_ws_id;

IF p_entity_type = 'cell' THEN
SELECT fc.id, fc.name, fc.information, fc.date, fc.date_type, fc.cell_id, fc.color, fc.is_crossed,
fb.id AS box_id, fb.name AS box_name, fb.box_type, fb.ai_code AS box_code, fb.location_id, fb.sublocation_id, fb.position_id
INTO rec FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
WHERE fc.id = p_entity_id AND f.workspace_id = v_ws_id;

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

v_result := jsonb_build_object('ok', true, 'entity_type', 'cell', 'ref', 'B' || rec.box_code || ':' || rec.cell_id,
'name', rec.name, 'information', rec.information, 'cell_id', rec.cell_id,
'date', rec.date, 'date_type', rec.date_type, 'color', rec.color, 'is_crossed', rec.is_crossed,
'box_name', rec.box_name, 'box_code', 'B' || rec.box_code, 'box_type', rec.box_type,
'expiration_date', CASE WHEN rec.date_type = 'expiration' AND rec.date IS NOT NULL THEN rec.date::text ELSE NULL END,
'expiration_status', CASE WHEN rec.date_type != 'expiration' OR rec.date IS NULL THEN 'unknown' WHEN rec.date < CURRENT_DATE THEN 'expired' WHEN rec.date <= CURRENT_DATE + 30 THEN 'expiring_soon' ELSE 'valid' END,
'custom_values', v_custom_values,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.box_id));

ELSIF p_entity_type = 'item' THEN
SELECT ii.id, ii.name, ii.note, ii.stock_number, ii.stock_threshold, ii.unit, ii.item_type,
ii.non_counted, ii.display_mode, ii.freeze_thaw_cycles, ii.location_id, ii.sublocation_id, ii.position_id,
ii.folder_id, ifo.name AS folder_name
INTO rec FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id WHERE ii.id = p_entity_id AND f.workspace_id = v_ws_id;

IF rec IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not found'); END IF;

SELECT COALESCE(jsonb_agg(jsonb_build_object('header', ifh.header_text, 'header_type', ifh.header_type, 'value', icv.value) ORDER BY ifh.display_order), '[]'::jsonb)
INTO v_custom_values FROM item_custom_values icv JOIN item_folder_headers ifh ON ifh.id = icv.header_id WHERE icv.item_id = rec.id;

v_result := jsonb_build_object('ok', true, 'entity_type', 'item', 'name', rec.name,
'note', rec.note, 'item_type', rec.item_type, 'stock_number', rec.stock_number,
'stock_threshold', rec.stock_threshold, 'unit', rec.unit, 'non_counted', rec.non_counted,
'display_mode', rec.display_mode, 'freeze_thaw_cycles', rec.freeze_thaw_cycles, 'folder_name', rec.folder_name,
'low_stock', CASE WHEN rec.non_counted THEN false WHEN rec.stock_threshold IS NULL THEN false ELSE rec.stock_number <= rec.stock_threshold END,
'custom_values', v_custom_values,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
ELSE
RETURN jsonb_build_object('ok', false, 'error', 'Invalid entity type');
END IF;

RETURN v_result;
END;
$fn$;

-- ============================================================
-- ai_get_item_locations - return codes
-- ============================================================
CREATE OR REPLACE FUNCTION public.ai_get_item_locations(p_team_member_id uuid, p_entity_ids uuid[], p_entity_type text DEFAULT 'item')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fn$
DECLARE
v_ws_id uuid; v_results jsonb := '[]'::jsonb; rec record;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member'); END IF;

IF p_entity_type = 'item' THEN
FOR rec IN SELECT ii.id, ii.name, ii.stock_number, ii.unit, ii.location_id, ii.sublocation_id, ii.position_id
FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
WHERE ii.id = ANY(p_entity_ids) AND f.workspace_id = v_ws_id
LOOP
v_results := v_results || jsonb_build_object('display_name', rec.name,
'quantity', rec.stock_number, 'unit', rec.unit,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
END LOOP;
ELSIF p_entity_type = 'cell' THEN
FOR rec IN SELECT fc.id, fc.name, fc.cell_id, fb.name AS box_name, fb.ai_code AS box_code,
fb.location_id, fb.sublocation_id, fb.position_id, fb.id AS box_id
FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
WHERE fc.id = ANY(p_entity_ids) AND f.workspace_id = v_ws_id
LOOP
v_results := v_results || jsonb_build_object('display_name', rec.name,
'ref', 'B' || rec.box_code || ':' || rec.cell_id, 'box_name', rec.box_name,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.box_id));
END LOOP;
END IF;

RETURN jsonb_build_object('ok', true, 'items', v_results, 'count', jsonb_array_length(v_results));
END;
$fn$;

-- ============================================================
-- ai_get_project_contents - return codes, fix freezer_boxes->boxes
-- ============================================================
CREATE OR REPLACE FUNCTION public.ai_get_project_contents(p_team_member_id uuid, p_project_id uuid, p_experiment_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
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
IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM team_members tm_auth WHERE tm_auth.id = p_team_member_id AND tm_auth.auth_user_id = auth.uid()) THEN RETURN jsonb_build_object('ok', false, 'error', 'Access denied'); END IF;

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

    v_items := v_items || jsonb_build_object('name', rec.item_name, 'note', rec.note,
      'item_type', rec.item_type, 'stock_number', rec.stock_number, 'unit', rec.unit, 'stock_threshold', rec.stock_threshold,
      'non_counted', rec.non_counted, 'freeze_thaw_cycles', rec.freeze_thaw_cycles, 'folder_name', rec.folder_name,
      'custom_values', v_custom_values, 'experiment_name', rec.experiment_name,
      'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
  END LOOP;

  FOR rec IN
    SELECT pbl.experiment_id, e.name AS experiment_name, fb.id AS box_id, fb.name AS box_name, fb.box_type,
      fb.ai_code AS box_code, fb.rows, fb.columns, fb.location_id, fb.sublocation_id, fb.position_id
    FROM project_box_links pbl JOIN boxes fb ON fb.id = pbl.box_id
    JOIN locations f ON f.id = fb.location_id LEFT JOIN experiments e ON e.id = pbl.experiment_id
    WHERE pbl.project_id = p_project_id AND f.workspace_id = v_ws_id
    AND (p_experiment_id IS NULL OR pbl.experiment_id IS NOT DISTINCT FROM p_experiment_id)
    ORDER BY pbl.display_order
  LOOP
    v_boxes := v_boxes || jsonb_build_object('code', 'B' || rec.box_code, 'name', rec.box_name, 'box_type', rec.box_type,
      'grid_size', rec.rows || 'x' || rec.columns, 'experiment_name', rec.experiment_name,
      'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.box_id));
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'project_name', v_project_name, 'access_level', v_access,
    'experiments', v_experiments, 'items', v_items, 'boxes', v_boxes);
END;
$fn$;

REVOKE ALL ON FUNCTION ai_get_project_contents FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_get_project_contents TO authenticated;

-- ============================================================
-- ai_resolve_codes - translate short codes to UUIDs for navigation
-- ============================================================
CREATE OR REPLACE FUNCTION public.ai_resolve_codes(p_workspace_id uuid, p_codes text[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_code text;
  v_prefix text;
  v_num int;
  v_row record;
BEGIN
  FOREACH v_code IN ARRAY p_codes LOOP
    v_prefix := left(v_code, 1);
    v_num := substring(v_code FROM 2)::int;

    IF v_prefix = 'L' THEN
      SELECT id, name, accent_color, location_type INTO v_row
      FROM locations WHERE workspace_id = p_workspace_id AND ai_code = v_num;
      IF v_row IS NOT NULL THEN
        v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
          'uuid', v_row.id, 'name', v_row.name, 'type', 'location',
          'accent_color', v_row.accent_color, 'location_type', v_row.location_type));
      END IF;

    ELSIF v_prefix = 'S' THEN
      SELECT s.id, s.name, s.accent_color, s.location_type, s.location_id, s.icon_id INTO v_row
      FROM sublocations s JOIN locations l ON l.id = s.location_id
      WHERE l.workspace_id = p_workspace_id AND s.ai_code = v_num;
      IF v_row IS NOT NULL THEN
        v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
          'uuid', v_row.id, 'name', v_row.name, 'type', 'sublocation',
          'accent_color', v_row.accent_color, 'location_type', v_row.location_type,
          'location_id', v_row.location_id, 'icon_id', v_row.icon_id));
      END IF;

    ELSIF v_prefix = 'P' THEN
      SELECT sp.id, sp.name, sp.accent_color, sp.location_type, sp.sublocation_id, sp.icon_id, s.location_id INTO v_row
      FROM sublocation_positions sp JOIN sublocations s ON s.id = sp.sublocation_id JOIN locations l ON l.id = s.location_id
      WHERE l.workspace_id = p_workspace_id AND sp.ai_code = v_num;
      IF v_row IS NOT NULL THEN
        v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
          'uuid', v_row.id, 'name', v_row.name, 'type', 'position',
          'accent_color', v_row.accent_color, 'location_type', v_row.location_type,
          'sublocation_id', v_row.sublocation_id, 'location_id', v_row.location_id, 'icon_id', v_row.icon_id));
      END IF;

    ELSIF v_prefix = 'B' THEN
      SELECT b.id, b.name, b.accent_color, b.box_type, b.location_id, b.sublocation_id, b.position_id INTO v_row
      FROM boxes b JOIN locations l ON l.id = b.location_id
      WHERE l.workspace_id = p_workspace_id AND b.ai_code = v_num;
      IF v_row IS NOT NULL THEN
        v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
          'uuid', v_row.id, 'name', v_row.name, 'type', 'box',
          'accent_color', v_row.accent_color, 'box_type', v_row.box_type,
          'location_id', v_row.location_id, 'sublocation_id', v_row.sublocation_id, 'position_id', v_row.position_id));
      END IF;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION ai_resolve_codes FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_resolve_codes TO authenticated;
