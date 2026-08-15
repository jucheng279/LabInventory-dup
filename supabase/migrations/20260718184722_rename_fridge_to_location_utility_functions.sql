/*
# Update utility functions to use new location naming

## Summary
Recreates utility functions that referenced old "fridge" table/column names.

## Functions Updated
- get_workspace_freezer_box_headers
- get_workspace_item_folder_headers
- get_workspace_item_folder_names
- get_workspace_overview_stats
- get_workspace_slide_headers
- resolve_box_access
- resolve_qr_token (dropped and recreated due to return type change)
*/

-- get_workspace_freezer_box_headers
CREATE OR REPLACE FUNCTION public.get_workspace_freezer_box_headers()
 RETURNS TABLE(header_text text, header_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT DISTINCT sbh.header_text, sbh.header_type
FROM slide_box_headers sbh
JOIN boxes fb ON fb.id = sbh.box_id
JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = get_user_workspace_id()
AND fb.box_type = 'structured_freezer'
ORDER BY sbh.header_text;
$function$;

-- get_workspace_item_folder_headers
CREATE OR REPLACE FUNCTION public.get_workspace_item_folder_headers()
 RETURNS TABLE(header_text text, header_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT DISTINCT ifh.header_text, ifh.header_type
FROM item_folder_headers ifh
JOIN item_folders ifo ON ifo.id = ifh.folder_id
JOIN locations f ON f.id = ifo.location_id
WHERE f.workspace_id = get_user_workspace_id()
ORDER BY ifh.header_text;
$function$;

-- get_workspace_item_folder_names
CREATE OR REPLACE FUNCTION public.get_workspace_item_folder_names()
 RETURNS TABLE(folder_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT DISTINCT ifo.name AS folder_name
FROM item_folders ifo
JOIN locations f ON f.id = ifo.location_id
WHERE f.workspace_id = get_user_workspace_id()
ORDER BY folder_name;
$function$;

-- get_workspace_overview_stats
CREATE OR REPLACE FUNCTION public.get_workspace_overview_stats()
 RETURNS TABLE(location_count integer, sublocation_count integer, position_count integer, box_count integer, folder_count integer, item_count integer, expiring_soon_count integer, low_stock_count integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
ws_id uuid;
v_location_count integer;
v_sublocation_count integer;
v_position_count integer;
v_box_count integer;
v_folder_count integer;
v_item_count integer;
v_expiring_soon_count integer;
v_low_stock_count integer;
v_cutoff_date date;
BEGIN
ws_id := get_user_workspace_id();
IF ws_id IS NULL THEN
RETURN QUERY SELECT 0,0,0,0,0,0,0,0;
RETURN;
END IF;

v_cutoff_date := CURRENT_DATE + INTERVAL '30 days';

SELECT COUNT(*)::integer INTO v_location_count
FROM locations WHERE workspace_id = ws_id;

SELECT COUNT(*)::integer INTO v_sublocation_count
FROM sublocations fs
JOIN locations f ON f.id = fs.location_id
WHERE f.workspace_id = ws_id;

SELECT COUNT(*)::integer INTO v_position_count
FROM sublocation_positions sp
JOIN sublocations fs ON fs.id = sp.sublocation_id
JOIN locations f ON f.id = fs.location_id
WHERE f.workspace_id = ws_id;

SELECT COUNT(*)::integer INTO v_box_count
FROM boxes fb
JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = ws_id;

SELECT COUNT(*)::integer INTO v_folder_count
FROM item_folders ifo
JOIN locations f ON f.id = ifo.location_id
WHERE f.workspace_id = ws_id;

SELECT COUNT(*)::integer INTO v_item_count
FROM inventory_items ii
JOIN locations f ON f.id = ii.location_id
WHERE f.workspace_id = ws_id;

SELECT COUNT(*)::integer INTO v_expiring_soon_count
FROM (
SELECT fc.id
FROM cells fc
JOIN boxes fb ON fb.id = fc.box_id
JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = ws_id
AND fc.date_type = 'expiration'
AND fc.date IS NOT NULL
AND fc.date != ''
AND fc.is_crossed = false
AND (fc.date::date) <= v_cutoff_date

UNION ALL

SELECT icv.id
FROM item_custom_values icv
JOIN item_folder_headers ifh ON ifh.id = icv.header_id
JOIN inventory_items ii ON ii.id = icv.item_id
JOIN locations f ON f.id = ii.location_id
WHERE f.workspace_id = ws_id
AND ifh.header_type = 'expiration'
AND icv.value IS NOT NULL
AND icv.value != ''
AND (icv.value::date) <= v_cutoff_date
) AS expiring;

SELECT COUNT(*)::integer INTO v_low_stock_count
FROM inventory_items ii
JOIN locations f ON f.id = ii.location_id
WHERE f.workspace_id = ws_id
AND ii.non_counted = false
AND ii.stock_threshold IS NOT NULL
AND ii.stock_number <= ii.stock_threshold;

RETURN QUERY SELECT
v_location_count,
v_sublocation_count,
v_position_count,
v_box_count,
v_folder_count,
v_item_count,
v_expiring_soon_count,
v_low_stock_count;
END;
$function$;

-- get_workspace_slide_headers
CREATE OR REPLACE FUNCTION public.get_workspace_slide_headers()
 RETURNS TABLE(header_text text, header_type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT DISTINCT sbh.header_text, sbh.header_type
FROM slide_box_headers sbh
JOIN boxes fb ON fb.id = sbh.box_id
JOIN locations f ON f.id = fb.location_id
WHERE f.workspace_id = get_user_workspace_id()
AND fb.box_type = 'slide'
ORDER BY sbh.header_text;
$function$;

-- resolve_box_access
CREATE OR REPLACE FUNCTION public.resolve_box_access(p_box_id uuid, p_team_member_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
v_workspace_owner_id uuid;
v_privacy box_privacy_settings;
v_access_level text;
BEGIN
SELECT w.owner_id INTO v_workspace_owner_id
FROM boxes fb
JOIN locations f ON f.id = fb.location_id
JOIN workspaces w ON w.id = f.workspace_id
WHERE fb.id = p_box_id;

IF v_workspace_owner_id IS NOT NULL THEN
IF EXISTS (
SELECT 1 FROM team_members
WHERE id = p_team_member_id AND auth_user_id = (
SELECT auth_user_id FROM team_members tm2
JOIN workspaces w2 ON w2.owner_id = tm2.id
JOIN locations f2 ON f2.workspace_id = w2.id
JOIN boxes fb2 ON fb2.location_id = f2.id
WHERE fb2.id = p_box_id AND tm2.id = v_workspace_owner_id
LIMIT 1
)
) THEN
RETURN 'owner';
END IF;
IF p_team_member_id = v_workspace_owner_id THEN
RETURN 'owner';
END IF;
END IF;

SELECT * INTO v_privacy FROM box_privacy_settings WHERE box_id = p_box_id;

IF NOT FOUND OR v_privacy.privacy_mode = 'open' THEN
RETURN 'open';
END IF;

IF v_privacy.owner_id = p_team_member_id THEN
RETURN 'owner';
END IF;

SELECT bal.access_level INTO v_access_level
FROM box_access_list bal
WHERE bal.box_id = p_box_id AND bal.team_member_id = p_team_member_id;

IF FOUND THEN
RETURN v_access_level;
END IF;

RETURN 'none';
END;
$function$;

-- Drop and recreate resolve_qr_token (return type changed: fridge_id -> location_id)
DROP FUNCTION IF EXISTS public.resolve_qr_token(text);
CREATE OR REPLACE FUNCTION public.resolve_qr_token(p_token text)
 RETURNS TABLE(box_id uuid, workspace_id uuid, location_id uuid, sublocation_id uuid, position_id uuid, box_type text, box_name text, accent_color text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
RETURN QUERY
SELECT
  bqr.box_id,
  bqr.workspace_id,
  fb.location_id,
  fb.sublocation_id,
  fb.position_id,
  fb.box_type,
  fb.name AS box_name,
  fb.accent_color
FROM box_qr_codes bqr
JOIN boxes fb ON fb.id = bqr.box_id
WHERE bqr.token = p_token
AND bqr.expires_at > now();
END;
$function$;
