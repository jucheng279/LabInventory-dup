/*
# Enrich AI expiring/low-stock results with full location path IDs

1. Modified Functions
   - `ai_list_expiring_inventory`: Changed `location_breadcrumb` field to `location`,
     now returning the full JSON object from `ai_get_location_breadcrumb` (with both
     `breadcrumb` string AND `path` array of {id, name, type} objects).
   - `ai_list_low_stock_items`: Same change.

2. Security
   - No security changes. Functions retain existing auth checks and STABLE marking.
*/

-- Update ai_list_expiring_inventory
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
fc.is_crossed, fb.id AS box_id, fb.name AS box_name, fb.box_type, fb.location_id, fb.sublocation_id, fb.position_id, fc.date AS exp_date
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
v_results := v_results || jsonb_build_object('id', rec.id, 'entity_type', rec.entity_type, 'display_name', rec.display_name,
'expiration_date', rec.expiration_date, 'days_until_expiration', rec.exp_date - CURRENT_DATE,
'status', CASE WHEN rec.exp_date < CURRENT_DATE THEN 'expired' ELSE 'expiring_soon' END,
'box_id', rec.box_id, 'box_name', rec.box_name, 'box_type', rec.box_type,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
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
v_results := v_results || jsonb_build_object('id', rec.id, 'entity_type', rec.entity_type, 'display_name', rec.display_name,
'expiration_date', rec.expiration_date, 'days_until_expiration', rec.exp_date - CURRENT_DATE,
'status', CASE WHEN rec.exp_date < CURRENT_DATE THEN 'expired' ELSE 'expiring_soon' END,
'box_id', NULL, 'box_name', NULL, 'box_type', NULL,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
END LOOP;

RETURN jsonb_build_object('ok', true, 'window_start', CURRENT_DATE::text, 'window_end', v_cutoff_date::text,
'counts', jsonb_build_object('expired', v_expired_count, 'expiring_soon', v_expiring_count),
'items', v_results, 'total_count', jsonb_array_length(v_results), 'truncated', jsonb_array_length(v_results) >= p_limit);
END;
$fn$;

-- Update ai_list_low_stock_items
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
v_results := v_results || jsonb_build_object('id', rec.id, 'display_name', rec.name, 'item_type', rec.item_type,
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

-- Preserve existing grants
REVOKE ALL ON FUNCTION ai_list_expiring_inventory FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_list_expiring_inventory TO authenticated;

REVOKE ALL ON FUNCTION ai_list_low_stock_items FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ai_list_low_stock_items TO authenticated;
