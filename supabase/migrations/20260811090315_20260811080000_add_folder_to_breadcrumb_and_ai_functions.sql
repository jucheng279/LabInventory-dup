/*
# Add item folder (sheet) to AI location breadcrumbs and all AI functions

1. Modified Functions
   - `ai_get_location_breadcrumb`: Added 5th parameter `p_folder_id uuid DEFAULT NULL`.
     When provided, appends the folder name with IF-prefixed code to the breadcrumb path.
   - `ai_search_inventory`: Item search results now include `folder_name` and
     `folder_code` (e.g. "IF3") fields, and pass `folder_id` to breadcrumb so the
     location trail includes the sheet name.
   - `ai_list_low_stock_items`: Now passes `folder_id` to breadcrumb (previously
     included folder_name/folder_code but not in the breadcrumb path itself).
   - `ai_get_item_details` (item branch): Now includes `folder_code` in the output
     AND passes folder_id to breadcrumb for complete location trail.
   - `ai_get_project_contents`: Item results now include `folder_code` and pass
     folder_id to breadcrumb.

2. Why
   - The AI assistant uses breadcrumbs and folder_code to build navigable links like
     `{{nav:L1.S2.IF3.I5|Item Name}}` that let users click item names to navigate
     directly to the sheet/folder containing that item.

3. Security
   - All functions retain their existing SECURITY DEFINER status and grants.
   - Only authenticated users can execute these functions.

4. Important Notes
   - The `ai_get_location_breadcrumb` signature change is backward-compatible because
     `p_folder_id` has a DEFAULT NULL so existing callers are unaffected.
   - Idempotent: uses CREATE OR REPLACE for all functions.
*/

-- 1. ai_get_location_breadcrumb: add p_folder_id parameter

CREATE OR REPLACE FUNCTION public.ai_get_location_breadcrumb(
  p_location_id uuid,
  p_sublocation_id uuid DEFAULT NULL,
  p_position_id uuid DEFAULT NULL,
  p_box_id uuid DEFAULT NULL,
  p_folder_id uuid DEFAULT NULL
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

  IF p_folder_id IS NOT NULL THEN
    SELECT ifo.name, ifo.ai_code INTO v_name, v_code FROM item_folders ifo WHERE ifo.id = p_folder_id;
    IF v_name IS NOT NULL THEN
      v_path := v_path || jsonb_build_object('code', 'IF' || v_code, 'name', v_name, 'type', 'item_folder');
      v_breadcrumb := v_breadcrumb || ' > ' || v_name;
    END IF;
  END IF;

  RETURN jsonb_build_object('path', v_path, 'breadcrumb', v_breadcrumb);
END;
$fn$;

REVOKE ALL ON FUNCTION public.ai_get_location_breadcrumb(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_get_location_breadcrumb(uuid, uuid, uuid, uuid, uuid) TO authenticated;

-- 2. ai_search_inventory: add folder_code/folder_name + folder in breadcrumb

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
ii.ai_code, ii.folder_id,
ifo.name AS folder_name, ifo.ai_code AS folder_ai_code,
CASE WHEN lower(ii.name) = v_query_lower THEN 100 WHEN lower(ii.name) LIKE v_query_lower||'%' THEN 80
WHEN lower(ii.note) = v_query_lower THEN 70 WHEN lower(ii.name) LIKE '%'||v_query_lower||'%' THEN 60
WHEN lower(ii.note) LIKE '%'||v_query_lower||'%' THEN 50 ELSE 30 END AS score
FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id
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
'folder_name', rec.folder_name,
'folder_code', CASE WHEN rec.folder_ai_code IS NOT NULL THEN 'IF'||rec.folder_ai_code ELSE NULL END,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, NULL, rec.folder_id),
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
ORDER BY score DESC, fb.name LIMIT p_limit
LOOP
v_results := v_results || jsonb_build_object('entity_type','box',
'code', 'B'||rec.ai_code, 'display_name', rec.name,
'box_type', rec.box_type, 'grid_size', rec.box_rows||'x'||rec.box_cols,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, rec.box_id),
'score', rec.score);
v_total := v_total + 1;
END LOOP;
END IF;

RETURN jsonb_build_object('status', CASE WHEN v_total > 0 THEN 'found' ELSE 'not_found' END,
'matches', v_results, 'total_count', v_total);
END;
$fn$;

REVOKE ALL ON FUNCTION ai_search_inventory FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_search_inventory TO authenticated;

-- 3. ai_list_low_stock_items: pass folder_id to breadcrumb

CREATE OR REPLACE FUNCTION ai_list_low_stock_items(
  p_team_member_id uuid,
  p_location_id uuid DEFAULT NULL,
  p_include_out_of_stock boolean DEFAULT true,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ws_id uuid;
  v_results jsonb := '[]'::jsonb;
  rec record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Not authenticated'); END IF;
  SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
  IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Invalid team member'); END IF;

  FOR rec IN
    SELECT ii.name, ii.stock_number, ii.stock_threshold, ii.unit, ii.item_type, ii.ai_code,
      ii.location_id, ii.sublocation_id, ii.position_id, ii.folder_id,
      ifo.name AS folder_name, ifo.ai_code AS folder_ai_code
    FROM inventory_items ii
    JOIN locations f ON f.id = ii.location_id
    LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id
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
      'folder_name', rec.folder_name,
      'folder_code', CASE WHEN rec.folder_ai_code IS NOT NULL THEN 'IF'||rec.folder_ai_code ELSE NULL END,
      'severity', CASE WHEN rec.stock_number = 0 THEN 'out_of_stock'
                       WHEN rec.stock_number <= rec.stock_threshold * 0.25 THEN 'critical' ELSE 'low' END,
      'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, NULL, rec.folder_id));
  END LOOP;

  RETURN jsonb_build_object('ok',true,'items',v_results,'total_count',jsonb_array_length(v_results));
END;
$fn$;

REVOKE ALL ON FUNCTION ai_list_low_stock_items FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_list_low_stock_items TO authenticated;

-- 4. ai_get_item_details: add folder_code + pass folder_id to breadcrumb

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
  ii.ai_code, ii.folder_id, ifo.name AS folder_name, ifo.ai_code AS folder_ai_code
  INTO rec FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
  LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id WHERE ii.id = v_entity_id AND f.workspace_id = v_ws_id;
  IF rec IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Not found'); END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('header',ifh.header_text,'header_type',ifh.header_type,'value',icv.value) ORDER BY ifh.display_order),'[]'::jsonb)
  INTO v_custom_values FROM item_custom_values icv JOIN item_folder_headers ifh ON ifh.id = icv.header_id WHERE icv.item_id = v_entity_id;
  v_result := jsonb_build_object('ok',true,'entity_type','item',
  'code','I'||rec.ai_code,'name',rec.name,
  'note',rec.note,'item_type',rec.item_type,'stock_number',rec.stock_number,
  'stock_threshold',rec.stock_threshold,'unit',rec.unit,'non_counted',rec.non_counted,
  'display_mode',rec.display_mode,'freeze_thaw_cycles',rec.freeze_thaw_cycles,
  'folder_name',rec.folder_name,
  'folder_code', CASE WHEN rec.folder_ai_code IS NOT NULL THEN 'IF'||rec.folder_ai_code ELSE NULL END,
  'low_stock', CASE WHEN rec.non_counted THEN false WHEN rec.stock_threshold IS NULL THEN false ELSE rec.stock_number <= rec.stock_threshold END,
  'custom_values',v_custom_values,
  'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, NULL, rec.folder_id));

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

-- 5. ai_get_project_contents: add folder_code + folder in breadcrumb

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
    ii.id AS item_id, ii.location_id, ii.sublocation_id, ii.position_id,
    ii.folder_id, ifo.name AS folder_name, ifo.ai_code AS folder_ai_code
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
    'non_counted',rec.non_counted,'freeze_thaw_cycles',rec.freeze_thaw_cycles,
    'folder_name',rec.folder_name,
    'folder_code', CASE WHEN rec.folder_ai_code IS NOT NULL THEN 'IF'||rec.folder_ai_code ELSE NULL END,
    'custom_values',v_custom_values,
    'experiment_code', CASE WHEN rec.exp_code IS NOT NULL THEN 'EX'||rec.exp_code ELSE NULL END,
    'experiment_name',rec.experiment_name,
    'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, NULL, rec.folder_id));
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