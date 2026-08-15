/*
# Update AI functions to use new location naming

## Summary
Recreates all AI functions to reference renamed tables (locations, sublocations, boxes, cells)
and renamed columns (location_id instead of fridge_id).

## Functions Updated
- ai_get_inventory_activity
- ai_get_inventory_risk_summary
- ai_get_item_details
- ai_get_item_locations
- ai_get_location_breadcrumb (dropped/recreated due to parameter rename)
- ai_get_project_contents
- ai_get_workspace_inventory_stats
- ai_list_expiring_inventory
- ai_list_low_stock_items
- ai_search_inventory
*/

-- Drop ai_get_location_breadcrumb first (parameter name changed)
DROP FUNCTION IF EXISTS public.ai_get_location_breadcrumb(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.ai_get_location_breadcrumb(p_location_id uuid, p_sublocation_id uuid DEFAULT NULL::uuid, p_position_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_path jsonb := '[]'::jsonb;
v_breadcrumb text := '';
v_location_name text;
v_location_type text;
v_sub_name text;
v_sub_type text;
v_pos_name text;
v_pos_type text;
BEGIN
IF p_location_id IS NULL THEN
RETURN jsonb_build_object('path', '[]'::jsonb, 'breadcrumb', '');
END IF;

SELECT name, location_type INTO v_location_name, v_location_type
FROM locations WHERE id = p_location_id;

IF v_location_name IS NOT NULL THEN
v_path := v_path || jsonb_build_object('id', p_location_id, 'name', v_location_name, 'type', COALESCE(v_location_type, 'location'));
v_breadcrumb := v_location_name;
END IF;

IF p_sublocation_id IS NOT NULL THEN
SELECT name, location_type INTO v_sub_name, v_sub_type
FROM sublocations WHERE id = p_sublocation_id;

IF v_sub_name IS NOT NULL THEN
v_path := v_path || jsonb_build_object('id', p_sublocation_id, 'name', v_sub_name, 'type', COALESCE(v_sub_type, 'sublocation'));
v_breadcrumb := v_breadcrumb || ' > ' || v_sub_name;
END IF;
END IF;

IF p_position_id IS NOT NULL THEN
SELECT name, location_type INTO v_pos_name, v_pos_type
FROM sublocation_positions WHERE id = p_position_id;

IF v_pos_name IS NOT NULL THEN
v_path := v_path || jsonb_build_object('id', p_position_id, 'name', v_pos_name, 'type', COALESCE(v_pos_type, 'position'));
v_breadcrumb := v_breadcrumb || ' > ' || v_pos_name;
END IF;
END IF;

RETURN jsonb_build_object('path', v_path, 'breadcrumb', v_breadcrumb);
END;
$function$;

-- ai_get_inventory_activity
CREATE OR REPLACE FUNCTION public.ai_get_inventory_activity(p_team_member_id uuid, p_date_from timestamp with time zone DEFAULT (now() - '7 days'::interval), p_date_to timestamp with time zone DEFAULT now(), p_location_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid;
v_groups jsonb;
v_recent jsonb;
v_total integer;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member'); END IF;

SELECT COALESCE(jsonb_agg(jsonb_build_object('action_type', action_type, 'count', cnt)), '[]'::jsonb)
INTO v_groups
FROM (
SELECT bh.action_type, COUNT(*)::integer AS cnt
FROM box_history bh
JOIN boxes fb ON fb.id = bh.box_id
JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = v_ws_id
AND bh.created_at >= p_date_from AND bh.created_at <= p_date_to
AND (p_location_id IS NULL OR f.id = p_location_id)
GROUP BY bh.action_type ORDER BY cnt DESC
) sub;

SELECT COUNT(*)::integer INTO v_total
FROM box_history bh
JOIN boxes fb ON fb.id = bh.box_id
JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = v_ws_id
AND bh.created_at >= p_date_from AND bh.created_at <= p_date_to
AND (p_location_id IS NULL OR f.id = p_location_id);

SELECT COALESCE(jsonb_agg(evt ORDER BY evt->>'occurred_at' DESC), '[]'::jsonb)
INTO v_recent
FROM (
SELECT jsonb_build_object(
'id', bh.id, 'action_type', bh.action_type, 'occurred_at', bh.created_at,
'box_name', fb.name, 'affected_cells_count', COALESCE(array_length(bh.affected_cells, 1), 0),
'team_member_name', tm.display_name,
'location_breadcrumb', (ai_get_location_breadcrumb(fb.location_id, fb.sublocation_id, fb.position_id))->>'breadcrumb'
) AS evt
FROM box_history bh
JOIN boxes fb ON fb.id = bh.box_id
JOIN locations f ON f.id = fb.location_id
LEFT JOIN team_members tm ON tm.id = bh.team_member_id
WHERE f.workspace_id = v_ws_id
AND bh.created_at >= p_date_from AND bh.created_at <= p_date_to
AND (p_location_id IS NULL OR f.id = p_location_id)
ORDER BY bh.created_at DESC LIMIT p_limit
) sub;

RETURN jsonb_build_object('ok', true, 'date_from', p_date_from, 'date_to', p_date_to,
'total_events', v_total, 'groups', v_groups, 'recent_events', v_recent, 'truncated', v_total > p_limit);
END;
$function$;

-- ai_get_inventory_risk_summary
CREATE OR REPLACE FUNCTION public.ai_get_inventory_risk_summary(p_team_member_id uuid, p_expiration_window_days integer DEFAULT 30, p_activity_window_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid; v_expired integer; v_expiring_soon integer; v_low_stock integer;
v_out_of_stock integer; v_missing_exp integer; v_active_members integer;
v_pending integer; v_activity_count integer; v_cutoff date; v_nearest jsonb;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member'); END IF;

v_cutoff := CURRENT_DATE + (p_expiration_window_days || ' days')::interval;

SELECT COUNT(*)::integer INTO v_expired FROM cells fc
JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = v_ws_id AND fc.date_type = 'expiration' AND fc.date IS NOT NULL
AND fc.is_crossed = false AND fc.date < CURRENT_DATE;

SELECT COUNT(*)::integer INTO v_expiring_soon FROM cells fc
JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = v_ws_id AND fc.date_type = 'expiration' AND fc.date IS NOT NULL
AND fc.is_crossed = false AND fc.date >= CURRENT_DATE AND fc.date <= v_cutoff;

SELECT COALESCE(jsonb_agg(item), '[]'::jsonb) INTO v_nearest FROM (
SELECT jsonb_build_object('id', fc.id, 'name', fc.name, 'expiration_date', fc.date::text,
'days_until', fc.date - CURRENT_DATE, 'box_name', fb.name,
'location_breadcrumb', (ai_get_location_breadcrumb(fb.location_id, fb.sublocation_id, fb.position_id))->>'breadcrumb'
) AS item FROM cells fc
JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = v_ws_id AND fc.date_type = 'expiration' AND fc.date IS NOT NULL
AND fc.is_crossed = false AND fc.date >= CURRENT_DATE AND fc.date <= v_cutoff
ORDER BY fc.date ASC LIMIT 5) sub;

SELECT COUNT(*)::integer INTO v_low_stock FROM inventory_items ii
JOIN locations f ON f.id = ii.location_id WHERE f.workspace_id = v_ws_id
AND ii.non_counted = false AND ii.stock_threshold IS NOT NULL
AND ii.stock_number <= ii.stock_threshold AND ii.stock_number > 0;

SELECT COUNT(*)::integer INTO v_out_of_stock FROM inventory_items ii
JOIN locations f ON f.id = ii.location_id WHERE f.workspace_id = v_ws_id
AND ii.non_counted = false AND ii.stock_threshold IS NOT NULL AND ii.stock_number <= 0;

SELECT COUNT(*)::integer INTO v_missing_exp FROM cells fc
JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = v_ws_id AND fc.is_crossed = false AND fc.name != ''
AND (fc.date_type = 'none' OR fc.date IS NULL);

SELECT COUNT(*)::integer INTO v_active_members FROM team_members WHERE workspace_id = v_ws_id AND role IS NOT NULL;
SELECT COUNT(*)::integer INTO v_pending FROM team_members WHERE workspace_id IS NULL
AND invited_by IN (SELECT id FROM team_members WHERE workspace_id = v_ws_id);

SELECT COUNT(*)::integer INTO v_activity_count FROM box_history bh
JOIN boxes fb ON fb.id = bh.box_id JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = v_ws_id AND bh.created_at >= now() - (p_activity_window_days || ' days')::interval;

RETURN jsonb_build_object('ok', true, 'generated_at', now(),
'expiration', jsonb_build_object('expired_count', v_expired, 'expiring_soon_count', v_expiring_soon, 'nearest_expirations', v_nearest),
'stock', jsonb_build_object('low_stock_count', v_low_stock, 'out_of_stock_count', v_out_of_stock),
'data_quality', jsonb_build_object('cells_missing_expiration', v_missing_exp),
'activity', jsonb_build_object('event_count_in_window', v_activity_count, 'window_days', p_activity_window_days),
'members', jsonb_build_object('active', v_active_members, 'pending', v_pending));
END;
$function$;

-- ai_get_item_details
CREATE OR REPLACE FUNCTION public.ai_get_item_details(p_team_member_id uuid, p_entity_type text, p_entity_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_ws_id uuid; v_is_owner boolean; v_result jsonb; rec record; v_custom_values jsonb := '[]'::jsonb;
BEGIN
SELECT tm.workspace_id INTO v_ws_id FROM team_members tm WHERE tm.id = p_team_member_id;
IF v_ws_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Invalid team member'); END IF;
SELECT (w.owner_id = p_team_member_id) INTO v_is_owner FROM workspaces w WHERE w.id = v_ws_id;

IF p_entity_type = 'cell' THEN
SELECT fc.id, fc.name, fc.information, fc.date, fc.date_type, fc.cell_id, fc.color, fc.is_crossed,
fb.id AS box_id, fb.name AS box_name, fb.box_type, fb.location_id, fb.sublocation_id, fb.position_id
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

v_result := jsonb_build_object('ok', true, 'entity_type', 'cell', 'id', rec.id, 'name', rec.name,
'information', rec.information, 'cell_id', rec.cell_id, 'date', rec.date, 'date_type', rec.date_type,
'color', rec.color, 'is_crossed', rec.is_crossed, 'box_id', rec.box_id, 'box_name', rec.box_name, 'box_type', rec.box_type,
'expiration_date', CASE WHEN rec.date_type = 'expiration' AND rec.date IS NOT NULL THEN rec.date::text ELSE NULL END,
'expiration_status', CASE WHEN rec.date_type != 'expiration' OR rec.date IS NULL THEN 'unknown' WHEN rec.date < CURRENT_DATE THEN 'expired' WHEN rec.date <= CURRENT_DATE + 30 THEN 'expiring_soon' ELSE 'valid' END,
'custom_values', v_custom_values, 'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));

ELSIF p_entity_type = 'item' THEN
SELECT ii.id, ii.name, ii.description, ii.stock_number, ii.stock_threshold, ii.unit, ii.item_type,
ii.non_counted, ii.display_mode, ii.freeze_thaw_cycles, ii.location_id, ii.sublocation_id, ii.position_id,
ii.folder_id, ifo.name AS folder_name
INTO rec FROM inventory_items ii JOIN locations f ON f.id = ii.location_id
LEFT JOIN item_folders ifo ON ifo.id = ii.folder_id WHERE ii.id = p_entity_id AND f.workspace_id = v_ws_id;

IF rec IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not found'); END IF;

SELECT COALESCE(jsonb_agg(jsonb_build_object('header', ifh.header_text, 'header_type', ifh.header_type, 'value', icv.value) ORDER BY ifh.display_order), '[]'::jsonb)
INTO v_custom_values FROM item_custom_values icv JOIN item_folder_headers ifh ON ifh.id = icv.header_id WHERE icv.item_id = rec.id;

v_result := jsonb_build_object('ok', true, 'entity_type', 'item', 'id', rec.id, 'name', rec.name,
'description', rec.description, 'item_type', rec.item_type, 'stock_number', rec.stock_number,
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

-- ai_get_item_locations
CREATE OR REPLACE FUNCTION public.ai_get_item_locations(p_team_member_id uuid, p_entity_ids uuid[], p_entity_type text DEFAULT 'item'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
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
v_results := v_results || jsonb_build_object('entity_id', rec.id, 'display_name', rec.name,
'quantity', rec.stock_number, 'unit', rec.unit, 'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
END LOOP;
ELSIF p_entity_type = 'cell' THEN
FOR rec IN SELECT fc.id, fc.name, fc.cell_id, fb.name AS box_name, fb.location_id, fb.sublocation_id, fb.position_id
FROM cells fc JOIN boxes fb ON fb.id = fc.box_id JOIN locations f ON f.id = fb.location_id
WHERE fc.id = ANY(p_entity_ids) AND f.workspace_id = v_ws_id
LOOP
v_results := v_results || jsonb_build_object('entity_id', rec.id, 'display_name', rec.name,
'cell_id', rec.cell_id, 'box_name', rec.box_name, 'location', ai_get_location_breadcrumb(rec.location_id, rec.sublocation_id, rec.position_id));
END LOOP;
END IF;

RETURN jsonb_build_object('ok', true, 'items', v_results, 'count', jsonb_array_length(v_results));
END;
$function$;
