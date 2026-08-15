/*
# Update sync_linked_item_stock to match on date fields

1. Modified Functions
   - `sync_linked_item_stock`: For `name_info` and `info` link types, now also filters cells
     by matching date and date_type against the link's `linked_date` and `linked_date_type`.
     This means cells whose date differs from the link's stored date will not count toward stock.
   - `name`-only links remain unchanged (match only by name, ignoring info/date).

2. Important Notes
   - Existing links have linked_date_type='none' and linked_date=null, so the new date filter
     becomes: cells WHERE (date IS NULL OR date = '') AND date_type IN ('none','date') — which
     matches the old behavior since most existing cells without explicit date_type default to 'date'.
   - For new links with a real date, only cells with the exact same date + date_type will count.
   - The membership check from the previous migration is preserved.
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
