/*
# Fix ai_search_inventory broken column reference

1. Modified Functions
   - `ai_search_inventory`: Changed all references to `ii.description` to `ii.note`
     in the inventory_items search section. The column was renamed from `description`
     to `note` in migration 20260730190058, but this function was never updated.
     This caused the entire function to error out every time it ran (since 'item' is
     in the default entity_types), returning zero results for cells, items, and boxes.

2. Security
   - No security changes. Function retains SECURITY DEFINER, search_path = public,
     and existing GRANT to authenticated only.
*/

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
fb.id AS box_id, fb.name AS box_name, fb.box_type, fb.location_id, fb.sublocation_id, fb.position_id,
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
v_results := v_results || jsonb_build_object('entity_type', 'cell', 'id', rec.id, 'display_name', rec.name,
'information', rec.information, 'cell_id', rec.cell_id, 'box_name', rec.box_name, 'box_id', rec.box_id, 'box_type', rec.box_type,
'expiration_date', CASE WHEN rec.date_type = 'expiration' AND rec.date IS NOT NULL THEN rec.date::text ELSE NULL END,
'expiration_status', CASE WHEN rec.date_type != 'expiration' OR rec.date IS NULL THEN 'unknown' WHEN rec.date < CURRENT_DATE THEN 'expired' WHEN rec.date <= CURRENT_DATE + 30 THEN 'expiring_soon' ELSE 'valid' END,
'is_crossed', rec.is_crossed,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id),
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
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id),
'score', rec.score, 'match_reason', CASE WHEN lower(rec.name) = v_query_lower THEN 'exact_name_match' WHEN lower(rec.name) LIKE v_query_lower || '%' THEN 'name_prefix' ELSE 'partial_match' END);
v_total := v_total + 1;
END LOOP;
END IF;

IF 'box' = ANY(p_entity_types) THEN
FOR rec IN
SELECT fb.id, fb.name, fb.box_type, fb.rows AS box_rows, fb.columns AS box_cols,
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
v_results := v_results || jsonb_build_object('entity_type', 'box', 'id', rec.id, 'display_name', rec.name,
'box_type', rec.box_type, 'dimensions', rec.box_rows || 'x' || rec.box_cols,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id),
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
