/*
# Restore membership check in sync_linked_item_stock

1. Security Changes
   - Re-adds the workspace membership authorization check that was accidentally
     removed in the 20260803081056 migration.
   - When called by an authenticated user (auth.uid() IS NOT NULL), the function
     now verifies the caller belongs to the same workspace as the box referenced
     by the link. If not, the function returns silently.
   - Trigger and cron callers (which have auth.uid() IS NULL) are unaffected.

2. Important Notes
   - The function body is identical to the current version EXCEPT for the added
     membership check block after the "NOT FOUND" guard.
   - This preserves the date-filter logic added in the previous migration.
*/

CREATE OR REPLACE FUNCTION public.sync_linked_item_stock(p_link_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link box_grid_item_links%ROWTYPE;
  v_item_unit text;
  v_count integer;
BEGIN
  SELECT * INTO v_link FROM box_grid_item_links WHERE id = p_link_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Authorization: if called by a logged-in user, verify workspace membership
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM boxes b
    JOIN locations l ON l.id = b.location_id
    JOIN team_members tm_auth ON tm_auth.workspace_id = l.workspace_id
    WHERE b.id = v_link.box_id AND tm_auth.auth_user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  -- Skip sync if item has a unit set (stock is user-managed)
  SELECT COALESCE(unit, '') INTO v_item_unit FROM inventory_items WHERE id = v_link.item_id;
  IF v_item_unit != '' THEN
    RETURN;
  END IF;

  IF v_link.link_type = 'name' THEN
    SELECT COUNT(*) INTO v_count
    FROM cells
    WHERE box_id = v_link.box_id
    AND TRIM(name) = TRIM(v_link.linked_name)
    AND (is_crossed IS NULL OR is_crossed = false);
  ELSIF v_link.link_type = 'info' THEN
    SELECT COUNT(*) INTO v_count
    FROM cells
    WHERE box_id = v_link.box_id
    AND TRIM(COALESCE(information, '')) = TRIM(COALESCE(v_link.linked_info, ''))
    AND (is_crossed IS NULL OR is_crossed = false)
    AND COALESCE(date, '') = COALESCE(v_link.linked_date, '')
    AND COALESCE(date_type, 'date') = COALESCE(v_link.linked_date_type, 'none');
  ELSE
    -- name_info: match name + info + date
    SELECT COUNT(*) INTO v_count
    FROM cells
    WHERE box_id = v_link.box_id
    AND TRIM(name) = TRIM(v_link.linked_name)
    AND TRIM(COALESCE(information, '')) = TRIM(COALESCE(v_link.linked_info, ''))
    AND (is_crossed IS NULL OR is_crossed = false)
    AND COALESCE(date, '') = COALESCE(v_link.linked_date, '')
    AND COALESCE(date_type, 'date') = COALESCE(v_link.linked_date_type, 'none');
  END IF;

  UPDATE inventory_items
  SET stock_number = v_count,
  updated_at = now()
  WHERE id = v_link.item_id;
END;
$function$;
