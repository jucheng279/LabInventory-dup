/*
# Add folder/item-sheet support to ai_list_expiring_inventory

1. Problem
   - The item query in `ai_list_expiring_inventory` does not JOIN `item_folders`,
     so items returned by the expiration report have NO sheet name, NO folder code,
     and the breadcrumb omits the sheet layer entirely.
   - This means the AI cannot construct clickable `{{nav:L1.IF3.I5|...}}` links
     for items, and breadcrumbs show "Floor 12 > Freezer 001" instead of
     "Floor 12 > Freezer 001 > Reagents".

2. Fix
   - JOIN `item_folders` in the item query.
   - Include `folder_name` and `folder_code` (e.g. `IF3`) in the JSON output.
   - Pass `NULL` for box_id and `rec.folder_id` to the 5-param breadcrumb
     function so the sheet name appears in the location path.

3. Security
   - No security changes. The function retains its existing grants and auth checks.
*/

CREATE OR REPLACE FUNCTION public.ai_list_expiring_inventory(
  p_team_member_id uuid,
  p_within_days integer DEFAULT 30,
  p_include_expired boolean DEFAULT true,
  p_only_available boolean DEFAULT false,
  p_sort text DEFAULT 'expiration_ascending',
  p_limit integer DEFAULT 50,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
ii.location_id, ii.sublocation_id, ii.position_id, icv.value::date AS exp_date, ii.ai_code,
ii.folder_id, ifo.name AS folder_name, ifo.ai_code AS folder_ai_code
FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id
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
'folder_name', rec.folder_name,
'folder_code', CASE WHEN rec.folder_ai_code IS NOT NULL THEN 'IF'||rec.folder_ai_code ELSE NULL END,
'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id, NULL, rec.folder_id));
END LOOP;

RETURN jsonb_build_object('ok',true,'window_start',CURRENT_DATE::text,'window_end',v_cutoff_date::text,
'counts',jsonb_build_object('expired',v_expired_count,'expiring_soon',v_expiring_count),
'items',v_results,'total_count',jsonb_array_length(v_results),'truncated',jsonb_array_length(v_results)>=p_limit);
END;
$$;
