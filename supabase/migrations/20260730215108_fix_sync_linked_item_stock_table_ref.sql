/*
# Fix sync_linked_item_stock: wrong table reference

1. Modified Functions
   - `sync_linked_item_stock`: The previous migration accidentally referenced the old
     table name `freezer_box_cells` which no longer exists after the fridge-to-location
     rename migration. This corrects it to `cells` (the current table name).

2. Important Notes
   - This was causing the linked stock decrement to fail because the SQL function
     would error on the non-existent table.
   - No data changes, only function body correction.
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
    AND (is_crossed IS NULL OR is_crossed = false);
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM cells
    WHERE box_id = v_link.box_id
    AND TRIM(name) = TRIM(v_link.linked_name)
    AND TRIM(COALESCE(information, '')) = TRIM(COALESCE(v_link.linked_info, ''))
    AND (is_crossed IS NULL OR is_crossed = false);
  END IF;

  UPDATE inventory_items
  SET stock_number = v_count,
      updated_at = now()
  WHERE id = v_link.item_id;
END;
$function$;
