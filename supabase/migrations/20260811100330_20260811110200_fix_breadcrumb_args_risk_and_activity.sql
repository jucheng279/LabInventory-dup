/*
# Pass box_id to breadcrumb calls in risk summary and activity functions

1. Problem
   - `ai_get_inventory_risk_summary` calls `ai_get_location_breadcrumb` with only
     3 args for nearest expirations (cells), omitting the box_id. The breadcrumb
     shows "Floor 9 > Template Lab" instead of "Floor 9 > Template Lab > Internal Controls".
   - `ai_get_inventory_activity` similarly calls with only 3 args for box history
     entries, omitting the box_id from the breadcrumb.

2. Fix
   - Pass `fb.id` (box_id) as the 4th argument in both functions so box names
     appear in breadcrumbs.

3. Security
   - No security changes.
*/

-- Fix ai_get_inventory_risk_summary
CREATE OR REPLACE FUNCTION public.ai_get_inventory_risk_summary(
  p_team_member_id uuid,
  p_expiration_window_days integer DEFAULT 30,
  p_activity_window_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
'location_breadcrumb', (ai_get_location_breadcrumb(fb.location_id, fb.sublocation_id, fb.position_id, fb.id))->>'breadcrumb'
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
$$;


-- Fix ai_get_inventory_activity
CREATE OR REPLACE FUNCTION public.ai_get_inventory_activity(
  p_team_member_id uuid,
  p_date_from timestamptz DEFAULT now() - interval '7 days',
  p_date_to timestamptz DEFAULT now(),
  p_limit integer DEFAULT 20,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
'location_breadcrumb', (ai_get_location_breadcrumb(fb.location_id, fb.sublocation_id, fb.position_id, fb.id))->>'breadcrumb'
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
$$;
