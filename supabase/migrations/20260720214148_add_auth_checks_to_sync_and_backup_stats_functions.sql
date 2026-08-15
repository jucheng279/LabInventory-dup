/*
# Add auth checks to sync functions and get_backup_stats

1. Security Changes
   - sync_linked_item_stock(p_link_id uuid): now verifies the link's box belongs
     to the caller's workspace before modifying stock. Returns silently if unauthorized.
   - sync_all_links_for_box(p_box_id uuid): now verifies the box belongs to
     the caller's workspace before syncing. Returns silently if unauthorized.
   - get_backup_stats(p_backup_id uuid): now verifies the backup belongs to the
     caller's workspace before returning stats. Returns error JSON if unauthorized.
   - Revokes EXECUTE from anon on all three functions.

2. Important Notes
   - The sync functions are also called internally by triggers/other functions.
     When called in that context (e.g. from a trigger running as definer),
     auth.uid() will be NULL. To handle this, we only block when auth.uid() IS
     NOT NULL but fails the membership check -- allowing internal/trigger calls
     where auth.uid() is NULL to proceed.
*/

-- sync_linked_item_stock: add workspace membership check
CREATE OR REPLACE FUNCTION public.sync_linked_item_stock(p_link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_link box_grid_item_links%ROWTYPE;
  v_count integer;
  v_workspace_id uuid;
BEGIN
  SELECT * INTO v_link FROM box_grid_item_links WHERE id = p_link_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Authorization: if called by an end-user (auth.uid() is set), verify membership
  IF auth.uid() IS NOT NULL THEN
    SELECT f.workspace_id INTO v_workspace_id
    FROM boxes fb
    JOIN locations f ON f.id = fb.location_id
    WHERE fb.id = v_link.box_id;

    IF NOT EXISTS (
      SELECT 1 FROM team_members
      WHERE workspace_id = v_workspace_id AND auth_user_id = auth.uid()
    ) THEN
      RETURN;
    END IF;
  END IF;

  IF v_link.link_type = 'name' THEN
    SELECT COUNT(*) INTO v_count FROM cells WHERE box_id = v_link.box_id AND TRIM(name) = TRIM(v_link.linked_name) AND (is_crossed IS NULL OR is_crossed = false);
  ELSIF v_link.link_type = 'info' THEN
    SELECT COUNT(*) INTO v_count FROM cells WHERE box_id = v_link.box_id AND TRIM(COALESCE(information, '')) = TRIM(COALESCE(v_link.linked_info, '')) AND (is_crossed IS NULL OR is_crossed = false);
  ELSE
    SELECT COUNT(*) INTO v_count FROM cells WHERE box_id = v_link.box_id AND TRIM(name) = TRIM(v_link.linked_name) AND TRIM(COALESCE(information, '')) = TRIM(COALESCE(v_link.linked_info, '')) AND (is_crossed IS NULL OR is_crossed = false);
  END IF;

  UPDATE inventory_items SET stock_number = v_count, updated_at = now() WHERE id = v_link.item_id;
END;
$function$;

-- sync_all_links_for_box: add workspace membership check
CREATE OR REPLACE FUNCTION public.sync_all_links_for_box(p_box_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_link_id uuid;
  v_workspace_id uuid;
BEGIN
  -- Authorization: if called by an end-user, verify membership
  IF auth.uid() IS NOT NULL THEN
    SELECT f.workspace_id INTO v_workspace_id
    FROM boxes fb
    JOIN locations f ON f.id = fb.location_id
    WHERE fb.id = p_box_id;

    IF NOT EXISTS (
      SELECT 1 FROM team_members
      WHERE workspace_id = v_workspace_id AND auth_user_id = auth.uid()
    ) THEN
      RETURN;
    END IF;
  END IF;

  FOR v_link_id IN
    SELECT id FROM box_grid_item_links WHERE box_id = p_box_id
  LOOP
    PERFORM sync_linked_item_stock(v_link_id);
  END LOOP;
END;
$function$;

-- get_backup_stats: add workspace ownership check
CREATE OR REPLACE FUNCTION public.get_backup_stats(p_backup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_data jsonb;
  v_result jsonb;
  v_workspace_id uuid;
BEGIN
  -- Get the backup's workspace
  SELECT workspace_id, backup_data INTO v_workspace_id, v_data
  FROM workspace_backups WHERE id = p_backup_id;

  IF v_data IS NULL THEN
    RETURN jsonb_build_object('error', 'Backup not found');
  END IF;

  -- Authorization: verify caller belongs to this workspace
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE workspace_id = v_workspace_id AND auth_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  v_result := jsonb_build_object(
    'locations', jsonb_array_length(COALESCE(v_data->'locations', '[]'::jsonb)),
    'sublocations', jsonb_array_length(COALESCE(v_data->'sublocations', '[]'::jsonb)),
    'boxes', jsonb_array_length(COALESCE(v_data->'boxes', '[]'::jsonb)),
    'cells', jsonb_array_length(COALESCE(v_data->'cells', '[]'::jsonb)),
    'item_folders', jsonb_array_length(COALESCE(v_data->'item_folders', '[]'::jsonb)),
    'inventory_items', jsonb_array_length(COALESCE(v_data->'inventory_items', '[]'::jsonb))
  );
  RETURN v_result;
END;
$function$;

-- Revoke anon access on all three
REVOKE EXECUTE ON FUNCTION public.sync_linked_item_stock(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_all_links_for_box(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_backup_stats(uuid) FROM anon;
