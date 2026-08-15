/*
# Strip all UUIDs from AI function outputs and use ref codes exclusively

1. Modified Functions
   - `ai_search_inventory`: Removed all id/box_id UUID fields. Cells use ref (B1:A1),
     items use code (I5), boxes use code (B7). No UUID ever appears in output.
   - `ai_list_expiring_inventory`: Removed id/box_id UUID fields. Uses ref codes.
   - `ai_list_low_stock_items`: Removed id UUID field. Items use code (I5).
   - `ai_get_item_details`: Changed to accept ref code string instead of UUID.
     Removed id/box_id from output. Returns ref/code instead.
   - `ai_get_item_locations`: Changed to accept ref code array instead of UUID array.
     Returns ref/code instead of entity_id.
   - `ai_list_projects`: Removed project/experiment UUIDs. Returns PR/EX codes.
   - `ai_get_project_contents`: Changed to accept project/experiment codes.
     Removed all UUIDs from output. Returns codes.

2. New/Updated Functions
   - `ai_resolve_ref_to_uuid`: Resolves any ref code (L1, S2, P3, B7, I5, PR2, EX1,
     B7:A1) to its UUID within a workspace.
   - `ai_resolve_codes`: Expanded to handle I/PR/EX prefixes and cell refs (B7:A1).

3. Security
   - All functions remain SECURITY DEFINER with search_path = public
   - EXECUTE granted only to authenticated role
   - No UUID is ever returned to the AI context

4. Important Notes
   - The AI never sees any UUID. All entity references use short codes.
   - The edge function resolves codes to UUIDs before calling RPCs that need them.
   - The browser receives a codeMap (code->UUID) for navigation.
*/

-- ─── Helper: resolve a single ref code to UUID ──────────────────────────
CREATE OR REPLACE FUNCTION ai_resolve_ref_to_uuid(
  p_workspace_id uuid,
  p_ref text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_prefix text;
  v_num integer;
  v_result uuid;
  v_box_code integer;
  v_cell_coord text;
  v_colon_pos integer;
BEGIN
  IF p_ref IS NULL OR p_ref = '' THEN RETURN NULL; END IF;

  -- Cell ref: B7:A1 format
  v_colon_pos := position(':' in p_ref);
  IF v_colon_pos > 1 THEN
    v_box_code := substring(p_ref from 2 for v_colon_pos - 2)::integer;
    v_cell_coord := substring(p_ref from v_colon_pos + 1);
    SELECT c.id INTO v_result
    FROM cells c JOIN boxes b ON b.id = c.box_id JOIN locations l ON l.id = b.location_id
    WHERE l.workspace_id = p_workspace_id AND b.ai_code = v_box_code AND c.cell_id = v_cell_coord;
    RETURN v_result;
  END IF;

  -- Extract prefix and number
  v_prefix := regexp_replace(p_ref, '\d+$', '');
  v_num := regexp_replace(p_ref, '^\D+', '')::integer;

  CASE v_prefix
    WHEN 'L' THEN
      SELECT id INTO v_result FROM locations WHERE workspace_id = p_workspace_id AND ai_code = v_num;
    WHEN 'S' THEN
      SELECT s.id INTO v_result FROM sublocations s JOIN locations l ON l.id = s.location_id
      WHERE l.workspace_id = p_workspace_id AND s.ai_code = v_num;
    WHEN 'P' THEN
      SELECT sp.id INTO v_result FROM sublocation_positions sp
      JOIN sublocations s ON s.id = sp.sublocation_id JOIN locations l ON l.id = s.location_id
      WHERE l.workspace_id = p_workspace_id AND sp.ai_code = v_num;
    WHEN 'B' THEN
      SELECT b.id INTO v_result FROM boxes b JOIN locations l ON l.id = b.location_id
      WHERE l.workspace_id = p_workspace_id AND b.ai_code = v_num;
    WHEN 'I' THEN
      SELECT ii.id INTO v_result FROM inventory_items ii JOIN locations l ON l.id = ii.location_id
      WHERE l.workspace_id = p_workspace_id AND ii.ai_code = v_num;
    WHEN 'PR' THEN
      SELECT p.id INTO v_result FROM projects p WHERE p.workspace_id = p_workspace_id AND p.ai_code = v_num;
    WHEN 'EX' THEN
      SELECT e.id INTO v_result FROM experiments e JOIN projects p ON p.id = e.project_id
      WHERE p.workspace_id = p_workspace_id AND e.ai_code = v_num;
    ELSE
      RETURN NULL;
  END CASE;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION ai_resolve_ref_to_uuid FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_resolve_ref_to_uuid TO authenticated;

-- ─── Expanded ai_resolve_codes: handles all prefixes + cell refs ────────
CREATE OR REPLACE FUNCTION ai_resolve_codes(p_workspace_id uuid, p_codes text[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_code text;
  v_prefix text;
  v_num integer;
  v_colon_pos integer;
  rec record;
BEGIN
  FOREACH v_code IN ARRAY p_codes LOOP
    -- Cell ref: B7:A1
    v_colon_pos := position(':' in v_code);
    IF v_colon_pos > 1 THEN
      DECLARE v_box_code integer; v_cell_coord text;
      BEGIN
        v_box_code := substring(v_code from 2 for v_colon_pos - 2)::integer;
        v_cell_coord := substring(v_code from v_colon_pos + 1);
        SELECT c.id, c.cell_id, b.id AS box_id, b.name AS box_name, b.box_type,
               b.location_id, b.sublocation_id, b.position_id
        INTO rec
        FROM cells c JOIN boxes b ON b.id = c.box_id JOIN locations l ON l.id = b.location_id
        WHERE l.workspace_id = p_workspace_id AND b.ai_code = v_box_code AND c.cell_id = v_cell_coord;
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', v_cell_coord, 'type', 'cell',
            'box_id', rec.box_id, 'location_id', rec.location_id,
            'sublocation_id', rec.sublocation_id, 'position_id', rec.position_id));
        END IF;
      END;
      CONTINUE;
    END IF;

    v_prefix := upper(regexp_replace(v_code, '\d+$', ''));
    BEGIN
      v_num := regexp_replace(v_code, '^\D+', '')::integer;
    EXCEPTION WHEN OTHERS THEN CONTINUE;
    END;

    CASE v_prefix
      WHEN 'L' THEN
        SELECT l.id, l.name, l.accent_color, l.location_type, l.icon_id INTO rec
        FROM locations l WHERE l.workspace_id = p_workspace_id AND l.ai_code = v_num;
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'location',
            'accent_color', rec.accent_color, 'location_type', rec.location_type, 'icon_id', rec.icon_id));
        END IF;
      WHEN 'S' THEN
        SELECT s.id, s.name, s.accent_color, s.location_type, s.icon_id, s.location_id INTO rec
        FROM sublocations s JOIN locations l ON l.id = s.location_id
        WHERE l.workspace_id = p_workspace_id AND s.ai_code = v_num;
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'sublocation',
            'accent_color', rec.accent_color, 'location_type', rec.location_type, 'icon_id', rec.icon_id,
            'location_id', rec.location_id));
        END IF;
      WHEN 'P' THEN
        SELECT sp.id, sp.name, sp.accent_color, sp.location_type, sp.icon_id,
               s.location_id, sp.sublocation_id INTO rec
        FROM sublocation_positions sp JOIN sublocations s ON s.id = sp.sublocation_id
        JOIN locations l ON l.id = s.location_id
        WHERE l.workspace_id = p_workspace_id AND sp.ai_code = v_num;
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'position',
            'accent_color', rec.accent_color, 'location_type', rec.location_type, 'icon_id', rec.icon_id,
            'location_id', rec.location_id, 'sublocation_id', rec.sublocation_id));
        END IF;
      WHEN 'B' THEN
        SELECT b.id, b.name, b.box_type, b.location_id, b.sublocation_id, b.position_id INTO rec
        FROM boxes b JOIN locations l ON l.id = b.location_id
        WHERE l.workspace_id = p_workspace_id AND b.ai_code = v_num;
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'box', 'box_type', rec.box_type,
            'location_id', rec.location_id, 'sublocation_id', rec.sublocation_id, 'position_id', rec.position_id));
        END IF;
      WHEN 'I' THEN
        SELECT ii.id, ii.name, ii.location_id, ii.sublocation_id, ii.position_id INTO rec
        FROM inventory_items ii JOIN locations l ON l.id = ii.location_id
        WHERE l.workspace_id = p_workspace_id AND ii.ai_code = v_num;
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'item',
            'location_id', rec.location_id, 'sublocation_id', rec.sublocation_id, 'position_id', rec.position_id));
        END IF;
      WHEN 'PR' THEN
        SELECT p.id, p.name INTO rec FROM projects p
        WHERE p.workspace_id = p_workspace_id AND p.ai_code = v_num;
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'project'));
        END IF;
      WHEN 'EX' THEN
        SELECT e.id, e.name, e.project_id INTO rec FROM experiments e
        JOIN projects p ON p.id = e.project_id
        WHERE p.workspace_id = p_workspace_id AND e.ai_code = v_num;
        IF rec IS NOT NULL THEN
          v_result := v_result || jsonb_build_object(v_code, jsonb_build_object(
            'uuid', rec.id, 'name', rec.name, 'type', 'experiment',
            'project_id', rec.project_id));
        END IF;
      ELSE NULL;
    END CASE;
  END LOOP;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION ai_resolve_codes FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_resolve_codes TO authenticated;

-- ─── ai_search_inventory: zero UUIDs in output ─────────────────────────
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
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('status','error','message','Invalid team member'); END IF;
SELECT (w.owner_id = p_team_member_id) INTO v_is_owner FROM workspaces w WHERE w.id = v_ws_id;
v_query_lower := lower(trim(p_query));
IF v_query_lower = '' OR length(v_query_lower) < 1 THEN RETURN jsonb_build_object('status','not_found','matches','[]'::jsonb,'total_count',0); END IF;

IF 'cell' = ANY(p_entity_types) THEN
FOR rec IN
SELECT fc.name, fc.information, fc.date, fc.date_type, fc.cell_id, fc.is_crossed,
fb.name AS box_name, fb.box_type, fb.ai_code AS box_code, fb.location_id, fb.sublocation_id, fb.position_id,
CASE WHEN lower(fc.name) = v_query_lower THEN 100 WHEN lower(fc.name) LIKE v_query_lower||'%' THEN 80
WHEN lower(fc.information) = v_query_lower THEN 70 WHEN lower(fc.name) LIKE '%'||v_query_lower||'%' THEN 60
WHEN lower(fc.information) LIKE '%'||v_query_lower||'%' THEN 50 ELSE 30 END AS score
FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = v_ws_id AND (p_include_crossed OR fc.is_crossed = false)
AND (fc.name ILIKE '%'||p_query||'%' OR fc.information ILIKE '%'||p_query||'%')
AND (p_location_id IS NULL OR fb.location_id = p_location_id)
AND (v_is_owner OR NOT EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id)
OR EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.privacy_mode='open')
OR EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.owner_id = p_team_member_id)
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id))
ORDER BY score DESC, fc.name LIMIT p_limit
LOOP
v_results := v_results || jsonb_build_object('entity_type','cell',
'ref', 'B'||rec.box_code||':'||rec.cell_id, 'display_name', rec.name,
'information', rec.information, 'cell_id', rec.cell_id,
'box_name', rec.box_name, 'box_code', 'B'||rec.box_code, 'box_type', rec.box_type,
'expiration_date', CASE WHEN rec.date_type='expiration' AND rec.date IS NOT NULL THEN rec.date::text ELSE NULL END,
'expiration_status', CASE WHEN rec.date_type!='expiration' OR rec.date IS NULL THEN 'unknown' WHEN rec.date < CURRENT_DATE THEN 'expired' WHEN rec.date <= CURRENT_DATE+30 THEN 'expiring_soon' ELSE 'valid' END,
'is_crossed', rec.is_crossed,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, (SELECT id FROM boxes WHERE ai_code=rec.box_code AND location_id=rec.location_id LIMIT 1)),
'score', rec.score);
v_total := v_total + 1;
END LOOP;
END IF;

IF 'item' = ANY(p_entity_types) THEN
FOR rec IN
SELECT ii.name, ii.note, ii.stock_number, ii.stock_threshold, ii.unit, ii.item_type,
ii.non_counted, ii.location_id, ii.sublocation_id, ii.position_id, ii.freeze_thaw_cycles,
ii.ai_code,
CASE WHEN lower(ii.name) = v_query_lower THEN 100 WHEN lower(ii.name) LIKE v_query_lower||'%' THEN 80
WHEN lower(ii.note) = v_query_lower THEN 70 WHEN lower(ii.name) LIKE '%'||v_query_lower||'%' THEN 60
WHEN lower(ii.note) LIKE '%'||v_query_lower||'%' THEN 50 ELSE 30 END AS score
FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
WHERE f.workspace_id = v_ws_id AND (ii.name ILIKE '%'||p_query||'%' OR ii.note ILIKE '%'||p_query||'%')
AND (p_location_id IS NULL OR ii.location_id = p_location_id)
AND (NOT p_only_available OR (ii.non_counted = true OR ii.stock_number > 0))
ORDER BY score DESC, ii.name LIMIT p_limit
LOOP
v_results := v_results || jsonb_build_object('entity_type','item',
'code', 'I'||rec.ai_code, 'display_name', rec.name,
'note', rec.note, 'item_type', rec.item_type, 'stock_number', rec.stock_number,
'stock_threshold', rec.stock_threshold, 'unit', rec.unit, 'non_counted', rec.non_counted,
'freeze_thaw_cycles', rec.freeze_thaw_cycles,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id),
'score', rec.score);
v_total := v_total + 1;
END LOOP;
END IF;

IF 'box' = ANY(p_entity_types) THEN
FOR rec IN
SELECT fb.name, fb.box_type, fb.ai_code, fb.rows AS box_rows, fb.columns AS box_cols,
fb.location_id, fb.sublocation_id, fb.position_id, fb.id AS box_id,
CASE WHEN lower(fb.name) = v_query_lower THEN 100 WHEN lower(fb.name) LIKE v_query_lower||'%' THEN 80
WHEN lower(fb.name) LIKE '%'||v_query_lower||'%' THEN 60 ELSE 30 END AS score
FROM boxes fb JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = v_ws_id AND fb.name ILIKE '%'||p_query||'%'
AND (p_location_id IS NULL OR fb.location_id = p_location_id)
AND (v_is_owner OR NOT EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id)
OR EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.privacy_mode='open')
OR EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.owner_id = p_team_member_id)
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id))
ORDER BY score DESC, fb.name LIMIT p_limit
LOOP
v_results := v_results || jsonb_build_object('entity_type','box',
'code', 'B'||rec.ai_code, 'display_name', rec.name,
'box_type', rec.box_type, 'dimensions', rec.box_rows||'x'||rec.box_cols,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.box_id),
'score', rec.score);
v_total := v_total + 1;
END LOOP;
END IF;

RETURN jsonb_build_object('status', CASE WHEN v_total=0 THEN 'not_found' WHEN v_total=1 THEN 'unique' ELSE 'multiple' END,
'matches', v_results, 'total_count', v_total, 'query', p_query);
END;
$fn$;

REVOKE ALL ON FUNCTION ai_search_inventory FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_search_inventory TO authenticated;

-- ─── ai_list_expiring_inventory: zero UUIDs ─────────────────────────────
CREATE OR REPLACE FUNCTION ai_list_expiring_inventory(
  p_team_member_id uuid, p_within_days integer DEFAULT 30, p_include_expired boolean DEFAULT true,
  p_location_id uuid DEFAULT NULL, p_only_available boolean DEFAULT false,
  p_sort text DEFAULT 'expiration_ascending', p_limit integer DEFAULT 50
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
v_ws_id uuid; v_is_owner boolean; v_cutoff_date date; v_results jsonb := '[]'::jsonb;
v_expired_count integer := 0; v_expiring_count integer := 0; rec record;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Invalid team member'); END IF;
SELECT (w.owner_id = p_team_member_id) INTO v_is_owner FROM workspaces w WHERE w.id = v_ws_id;
v_cutoff_date := CURRENT_DATE + (p_within_days||' days')::interval;

FOR rec IN
SELECT 'cell' AS entity_type, fc.name AS display_name, fc.date::text AS expiration_date,
fc.cell_id, fc.is_crossed, fb.name AS box_name, fb.box_type, fb.ai_code AS box_code,
fb.location_id, fb.sublocation_id, fb.position_id, fb.id AS box_id, fc.date AS exp_date
FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = v_ws_id AND fc.date_type='expiration' AND fc.date IS NOT NULL
AND fc.is_crossed = false AND fc.date <= v_cutoff_date
AND (NOT p_only_available OR fc.is_crossed = false)
AND (p_location_id IS NULL OR fb.location_id = p_location_id)
AND (p_include_expired OR fc.date >= CURRENT_DATE)
AND (v_is_owner OR NOT EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.privacy_mode='restricted')
OR EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = fb.id AND bps.owner_id = p_team_member_id)
OR EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = fb.id AND bal.team_member_id = p_team_member_id))
ORDER BY CASE WHEN p_sort='expiration_ascending' THEN fc.date END ASC,
CASE WHEN p_sort='expiration_descending' THEN fc.date END DESC,
CASE WHEN p_sort='name' THEN fc.name END ASC
LIMIT p_limit
LOOP
IF rec.exp_date < CURRENT_DATE THEN v_expired_count := v_expired_count+1; ELSE v_expiring_count := v_expiring_count+1; END IF;
v_results := v_results || jsonb_build_object('entity_type', rec.entity_type,
'ref', 'B'||rec.box_code||':'||rec.cell_id, 'display_name', rec.display_name,
'expiration_date', rec.expiration_date, 'days_until_expiration', rec.exp_date - CURRENT_DATE,
'status', CASE WHEN rec.exp_date < CURRENT_DATE THEN 'expired' ELSE 'expiring_soon' END,
'box_name', rec.box_name, 'box_code', 'B'||rec.box_code, 'box_type', rec.box_type,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.box_id));
END LOOP;

FOR rec IN
SELECT 'item' AS entity_type, ii.name AS display_name, icv.value AS expiration_date,
ii.location_id, ii.sublocation_id, ii.position_id, icv.value::date AS exp_date, ii.ai_code
FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
JOIN item_custom_values icv ON icv.item_id = ii.id JOIN item_folder_headers ifh ON ifh.id = icv.header_id
WHERE f.workspace_id = v_ws_id AND ifh.header_type='expiration'
AND icv.value IS NOT NULL AND icv.value != '' AND icv.value ~ '^\d{4}-\d{2}-\d{2}$'
AND icv.value::date <= v_cutoff_date
AND (p_location_id IS NULL OR ii.location_id = p_location_id)
AND (p_include_expired OR icv.value::date >= CURRENT_DATE)
AND (NOT p_only_available OR ii.non_counted = true OR ii.stock_number > 0)
ORDER BY CASE WHEN p_sort='expiration_ascending' THEN icv.value::date END ASC,
CASE WHEN p_sort='expiration_descending' THEN icv.value::date END DESC,
CASE WHEN p_sort='name' THEN ii.name END ASC
LIMIT p_limit
LOOP
IF rec.exp_date < CURRENT_DATE THEN v_expired_count := v_expired_count+1; ELSE v_expiring_count := v_expiring_count+1; END IF;
v_results := v_results || jsonb_build_object('entity_type', rec.entity_type,
'code', 'I'||rec.ai_code, 'display_name', rec.display_name,
'expiration_date', rec.expiration_date, 'days_until_expiration', rec.exp_date - CURRENT_DATE,
'status', CASE WHEN rec.exp_date < CURRENT_DATE THEN 'expired' ELSE 'expiring_soon' END,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
END LOOP;

RETURN jsonb_build_object('ok',true,'window_start',CURRENT_DATE::text,'window_end',v_cutoff_date::text,
'counts',jsonb_build_object('expired',v_expired_count,'expiring_soon',v_expiring_count),
'items',v_results,'total_count',jsonb_array_length(v_results),'truncated',jsonb_array_length(v_results)>=p_limit);
END;
$fn$;

REVOKE ALL ON FUNCTION ai_list_expiring_inventory FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_list_expiring_inventory TO authenticated;

-- ─── ai_list_low_stock_items: zero UUIDs ────────────────────────────────
-- Check current signature
DO $$ BEGIN
  -- Drop the old function if it has different args
  DROP FUNCTION IF EXISTS ai_list_low_stock_items(uuid, uuid, boolean, integer);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION ai_list_low_stock_items(
  p_team_member_id uuid, p_location_id uuid DEFAULT NULL,
  p_include_out_of_stock boolean DEFAULT true, p_limit integer DEFAULT 50
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
v_ws_id uuid; v_results jsonb := '[]'::jsonb; rec record;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Invalid team member'); END IF;

FOR rec IN
SELECT ii.name, ii.stock_number, ii.stock_threshold, ii.unit, ii.item_type, ii.ai_code,
ii.location_id, ii.sublocation_id, ii.position_id
FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
WHERE f.workspace_id = v_ws_id AND ii.non_counted = false
AND ii.stock_threshold IS NOT NULL AND ii.stock_number <= ii.stock_threshold
AND (p_location_id IS NULL OR ii.location_id = p_location_id)
AND (p_include_out_of_stock OR ii.stock_number > 0)
ORDER BY ii.stock_number ASC, ii.name LIMIT p_limit
LOOP
v_results := v_results || jsonb_build_object(
'code', 'I'||rec.ai_code, 'display_name', rec.name,
'stock_number', rec.stock_number, 'stock_threshold', rec.stock_threshold,
'unit', rec.unit, 'item_type', rec.item_type,
'severity', CASE WHEN rec.stock_number = 0 THEN 'out_of_stock' WHEN rec.stock_number <= rec.stock_threshold * 0.25 THEN 'critical' ELSE 'low' END,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
END LOOP;

RETURN jsonb_build_object('ok',true,'items',v_results,'total_count',jsonb_array_length(v_results));
END;
$fn$;

REVOKE ALL ON FUNCTION ai_list_low_stock_items FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_list_low_stock_items TO authenticated;

-- ─── ai_get_item_details: accepts ref code, zero UUIDs out ──────────────
-- Drop old signature that took UUID
DROP FUNCTION IF EXISTS ai_get_item_details(uuid, text, uuid);

CREATE OR REPLACE FUNCTION ai_get_item_details(
  p_team_member_id uuid, p_ref_code text
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
v_ws_id uuid; v_is_owner boolean; v_result jsonb; rec record; v_custom_values jsonb := '[]'::jsonb;
v_entity_id uuid; v_entity_type text;
v_colon_pos integer;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Invalid team member'); END IF;
SELECT (w.owner_id = p_team_member_id) INTO v_is_owner FROM workspaces w WHERE w.id = v_ws_id;

-- Determine entity type from prefix
v_colon_pos := position(':' in p_ref_code);
IF v_colon_pos > 1 OR upper(left(p_ref_code,1)) = 'B' THEN
  IF v_colon_pos > 1 THEN v_entity_type := 'cell'; ELSE v_entity_type := 'box'; END IF;
ELSIF upper(left(p_ref_code,1)) = 'I' THEN v_entity_type := 'item';
ELSE RETURN jsonb_build_object('ok',false,'error','Invalid ref code prefix. Use B#:cell for cells, I# for items');
END IF;

v_entity_id := ai_resolve_ref_to_uuid(v_ws_id, p_ref_code);
IF v_entity_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Entity not found for ref '||p_ref_code); END IF;

IF v_entity_type = 'cell' THEN
  SELECT fc.name, fc.information, fc.date, fc.date_type, fc.cell_id, fc.color, fc.is_crossed,
  fb.name AS box_name, fb.box_type, fb.ai_code AS box_code, fb.location_id, fb.sublocation_id, fb.position_id, fb.id AS box_id
  INTO rec FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
  WHERE fc.id = v_entity_id AND f.workspace_id = v_ws_id;
  IF rec IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Not found'); END IF;
  IF NOT v_is_owner THEN
    IF EXISTS (SELECT 1 FROM box_privacy_settings bps WHERE bps.box_id = rec.box_id AND bps.privacy_mode='restricted'
    AND bps.owner_id != p_team_member_id AND NOT EXISTS (SELECT 1 FROM box_access_list bal WHERE bal.box_id = rec.box_id AND bal.team_member_id = p_team_member_id))
    THEN RETURN jsonb_build_object('ok',false,'error','Access denied'); END IF;
  END IF;
  IF rec.box_type IN ('slide','structured_freezer') THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('header',sbh.header_text,'header_type',sbh.header_type,'value',scv.value) ORDER BY sbh.display_order),'[]'::jsonb)
    INTO v_custom_values FROM slide_cell_values scv JOIN slide_box_headers sbh ON sbh.id = scv.header_id WHERE scv.cell_id = v_entity_id;
  END IF;
  v_result := jsonb_build_object('ok',true,'entity_type','cell',
  'ref','B'||rec.box_code||':'||rec.cell_id,
  'name',rec.name,'information',rec.information,'cell_id',rec.cell_id,
  'date',rec.date,'date_type',rec.date_type,'color',rec.color,'is_crossed',rec.is_crossed,
  'box_name',rec.box_name,'box_code','B'||rec.box_code,'box_type',rec.box_type,
  'expiration_date', CASE WHEN rec.date_type='expiration' AND rec.date IS NOT NULL THEN rec.date::text ELSE NULL END,
  'expiration_status', CASE WHEN rec.date_type!='expiration' OR rec.date IS NULL THEN 'unknown' WHEN rec.date < CURRENT_DATE THEN 'expired' WHEN rec.date <= CURRENT_DATE+30 THEN 'expiring_soon' ELSE 'valid' END,
  'custom_values',v_custom_values,
  'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.box_id));

ELSIF v_entity_type = 'item' THEN
  SELECT ii.name, ii.note, ii.stock_number, ii.stock_threshold, ii.unit, ii.item_type,
  ii.non_counted, ii.display_mode, ii.freeze_thaw_cycles, ii.location_id, ii.sublocation_id, ii.position_id,
  ii.ai_code, ifo.name AS folder_name
  INTO rec FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
  LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id WHERE ii.id = v_entity_id AND f.workspace_id = v_ws_id;
  IF rec IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Not found'); END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('header',ifh.header_text,'header_type',ifh.header_type,'value',icv.value) ORDER BY ifh.display_order),'[]'::jsonb)
  INTO v_custom_values FROM item_custom_values icv JOIN item_folder_headers ifh ON ifh.id = icv.header_id WHERE icv.item_id = v_entity_id;
  v_result := jsonb_build_object('ok',true,'entity_type','item',
  'code','I'||rec.ai_code,'name',rec.name,
  'note',rec.note,'item_type',rec.item_type,'stock_number',rec.stock_number,
  'stock_threshold',rec.stock_threshold,'unit',rec.unit,'non_counted',rec.non_counted,
  'display_mode',rec.display_mode,'freeze_thaw_cycles',rec.freeze_thaw_cycles,'folder_name',rec.folder_name,
  'low_stock', CASE WHEN rec.non_counted THEN false WHEN rec.stock_threshold IS NULL THEN false ELSE rec.stock_number <= rec.stock_threshold END,
  'custom_values',v_custom_values,
  'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));

ELSIF v_entity_type = 'box' THEN
  SELECT fb.name, fb.box_type, fb.ai_code AS box_code, fb.rows, fb.columns,
  fb.location_id, fb.sublocation_id, fb.position_id, fb.id AS box_id
  INTO rec FROM boxes fb JOIN locations f ON f.id = fb.location_id
  WHERE fb.id = v_entity_id AND f.workspace_id = v_ws_id;
  IF rec IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Not found'); END IF;
  v_result := jsonb_build_object('ok',true,'entity_type','box',
  'code','B'||rec.box_code,'name',rec.name,
  'box_type',rec.box_type,'dimensions',rec.rows||'x'||rec.columns,
  'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.box_id));
ELSE
  RETURN jsonb_build_object('ok',false,'error','Invalid entity type');
END IF;

RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION ai_get_item_details(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_get_item_details(uuid, text) TO authenticated;

-- ─── ai_get_item_locations: accepts ref codes, zero UUIDs out ───────────
DROP FUNCTION IF EXISTS ai_get_item_locations(uuid, uuid[], text);

CREATE OR REPLACE FUNCTION ai_get_item_locations(
  p_team_member_id uuid, p_ref_codes text[]
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
v_ws_id uuid; v_results jsonb := '[]'::jsonb; v_code text; v_entity_id uuid; rec record;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Invalid team member'); END IF;

FOREACH v_code IN ARRAY p_ref_codes LOOP
  v_entity_id := ai_resolve_ref_to_uuid(v_ws_id, v_code);
  IF v_entity_id IS NULL THEN CONTINUE; END IF;

  IF upper(left(v_code,1)) = 'I' THEN
    SELECT ii.name, ii.stock_number, ii.unit, ii.ai_code, ii.location_id, ii.sublocation_id, ii.position_id
    INTO rec FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
    WHERE ii.id = v_entity_id AND f.workspace_id = v_ws_id;
    IF rec IS NOT NULL THEN
      v_results := v_results || jsonb_build_object('code','I'||rec.ai_code,'display_name',rec.name,
      'quantity',rec.stock_number,'unit',rec.unit,
      'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
    END IF;
  ELSIF position(':' in v_code) > 1 THEN
    SELECT fc.name, fc.cell_id, fb.name AS box_name, fb.ai_code AS box_code,
    fb.location_id, fb.sublocation_id, fb.position_id, fb.id AS box_id
    INTO rec FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
    WHERE fc.id = v_entity_id AND f.workspace_id = v_ws_id;
    IF rec IS NOT NULL THEN
      v_results := v_results || jsonb_build_object('ref','B'||rec.box_code||':'||rec.cell_id,
      'display_name',rec.name,'box_name',rec.box_name,
      'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.box_id));
    END IF;
  END IF;
END LOOP;

RETURN jsonb_build_object('ok',true,'items',v_results,'count',jsonb_array_length(v_results));
END;
$fn$;

REVOKE ALL ON FUNCTION ai_get_item_locations(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_get_item_locations(uuid, text[]) TO authenticated;

-- ─── ai_list_projects: zero UUIDs ──────────────────────────────────────
CREATE OR REPLACE FUNCTION ai_list_projects(p_team_member_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
v_ws_id uuid; v_results jsonb := '[]'::jsonb; rec record; v_experiments jsonb;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Invalid team member'); END IF;

FOR rec IN
  SELECT p.id, p.name, p.ai_code,
  (SELECT count(*) FROM project_item_links pil WHERE pil.project_id = p.id) AS item_count,
  (SELECT count(*) FROM project_box_links pbl WHERE pbl.project_id = p.id) AS box_count
  FROM projects p WHERE p.workspace_id = v_ws_id ORDER BY p.display_order, p.name
LOOP
  SELECT COALESCE(jsonb_agg(jsonb_build_object('code','EX'||e.ai_code,'name',e.name) ORDER BY e.display_order, e.name),'[]'::jsonb)
  INTO v_experiments FROM experiments e WHERE e.project_id = rec.id;
  v_results := v_results || jsonb_build_object('code','PR'||rec.ai_code,'name',rec.name,
  'experiments',v_experiments,'item_count',rec.item_count,'box_count',rec.box_count);
END LOOP;

RETURN jsonb_build_object('ok',true,'projects',v_results,'total_count',jsonb_array_length(v_results));
END;
$fn$;

REVOKE ALL ON FUNCTION ai_list_projects FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_list_projects TO authenticated;

-- ─── ai_get_project_contents: accepts codes, zero UUIDs out ─────────────
DROP FUNCTION IF EXISTS ai_get_project_contents(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION ai_get_project_contents(
  p_team_member_id uuid, p_project_code text, p_experiment_code text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_ws_id uuid; v_project_id uuid; v_experiment_id uuid;
  v_project_name text; v_access text;
  v_experiments jsonb; v_items jsonb := '[]'::jsonb; v_boxes jsonb := '[]'::jsonb;
  v_custom_values jsonb; rec record;
BEGIN
IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM team_members tm_auth WHERE tm_auth.id = p_team_member_id AND tm_auth.auth_user_id = auth.uid()) THEN
  RETURN jsonb_build_object('ok',false,'error','Access denied');
END IF;

SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Team member not found'); END IF;

v_project_id := ai_resolve_ref_to_uuid(v_ws_id, p_project_code);
IF v_project_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Project not found for code '||p_project_code); END IF;

SELECT p.name INTO v_project_name FROM projects p WHERE p.id = v_project_id AND p.workspace_id = v_ws_id;
IF v_project_name IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Project not found'); END IF;
v_access := resolve_project_access(v_project_id, p_team_member_id);
IF v_access = 'none' THEN RETURN jsonb_build_object('ok',false,'error','Access denied'); END IF;

IF p_experiment_code IS NOT NULL THEN
  v_experiment_id := ai_resolve_ref_to_uuid(v_ws_id, p_experiment_code);
END IF;

SELECT COALESCE(jsonb_agg(jsonb_build_object('code','EX'||e.ai_code,'name',e.name) ORDER BY e.display_order, e.name),'[]'::jsonb)
INTO v_experiments FROM experiments e WHERE e.project_id = v_project_id;

FOR rec IN
  SELECT pil.experiment_id, e.name AS experiment_name, e.ai_code AS exp_code,
    ii.name AS item_name, ii.note, ii.stock_number, ii.unit, ii.item_type,
    ii.stock_threshold, ii.non_counted, ii.freeze_thaw_cycles, ii.ai_code AS item_code,
    ii.id AS item_id, ii.location_id, ii.sublocation_id, ii.position_id, ifo.name AS folder_name
  FROM project_item_links pil JOIN inventory_items ii ON ii.id = pil.item_id
  JOIN locations f ON f.id = ii.location_id LEFT JOIN experiments e ON e.id = pil.experiment_id
  LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id
  WHERE pil.project_id = v_project_id AND f.workspace_id = v_ws_id
  AND (v_experiment_id IS NULL OR pil.experiment_id IS NOT DISTINCT FROM v_experiment_id)
  ORDER BY pil.display_order
LOOP
  SELECT COALESCE(jsonb_agg(jsonb_build_object('header',ifh.header_text,'header_type',ifh.header_type,'value',icv.value) ORDER BY ifh.display_order),'[]'::jsonb)
  INTO v_custom_values FROM item_custom_values icv JOIN item_folder_headers ifh ON ifh.id = icv.header_id WHERE icv.item_id = rec.item_id AND icv.value != '';
  v_items := v_items || jsonb_build_object('code','I'||rec.item_code,'name',rec.item_name,'note',rec.note,
    'item_type',rec.item_type,'stock_number',rec.stock_number,'unit',rec.unit,'stock_threshold',rec.stock_threshold,
    'non_counted',rec.non_counted,'freeze_thaw_cycles',rec.freeze_thaw_cycles,'folder_name',rec.folder_name,
    'custom_values',v_custom_values,
    'experiment_code', CASE WHEN rec.exp_code IS NOT NULL THEN 'EX'||rec.exp_code ELSE NULL END,
    'experiment_name',rec.experiment_name,
    'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
END LOOP;

FOR rec IN
  SELECT pbl.experiment_id, e.name AS experiment_name, e.ai_code AS exp_code,
    fb.name AS box_name, fb.box_type, fb.ai_code AS box_code, fb.rows, fb.columns,
    fb.location_id, fb.sublocation_id, fb.position_id, fb.id AS box_id
  FROM project_box_links pbl JOIN boxes fb ON fb.id = pbl.box_id
  JOIN locations f ON f.id = fb.location_id LEFT JOIN experiments e ON e.id = pbl.experiment_id
  WHERE pbl.project_id = v_project_id AND f.workspace_id = v_ws_id
  AND (v_experiment_id IS NULL OR pbl.experiment_id IS NOT DISTINCT FROM v_experiment_id)
  ORDER BY pbl.display_order
LOOP
  v_boxes := v_boxes || jsonb_build_object('code','B'||rec.box_code,
    'name',rec.box_name,'box_type',rec.box_type,
    'grid_size',rec.rows||'x'||rec.columns,
    'experiment_code', CASE WHEN rec.exp_code IS NOT NULL THEN 'EX'||rec.exp_code ELSE NULL END,
    'experiment_name',rec.experiment_name,
    'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.box_id));
END LOOP;

RETURN jsonb_build_object('ok',true,'project_name',v_project_name,'project_code','PR'|| (SELECT ai_code FROM projects WHERE id = v_project_id),
  'access_level',v_access,'experiments',v_experiments,'items',v_items,'boxes',v_boxes);
END;
$fn$;

REVOKE ALL ON FUNCTION ai_get_project_contents(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_get_project_contents(uuid, text, text) TO authenticated;
