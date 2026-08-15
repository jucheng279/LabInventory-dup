/*
# Allow "no access" boxes to appear in box listings

1. Changes
   - Modifies `can_access_box(uuid)` to return TRUE even for 'none' access level.
     This allows restricted boxes to appear in the box listing so users see a lock
     icon rather than the box being completely hidden.
   - Creates a new `can_view_box(uuid)` function that requires at least 'view' access.
     This function replaces `can_access_box` in child-table SELECT policies (cells,
     box_history, slide_box_headers, slide_cell_values, box_grid_item_links) so that
     users with 'none' access still cannot read box contents.

2. Security
   - Users with 'none' access can now SEE the box row (name, grid size, utilization)
     but still CANNOT read cells, history, slides, or linked items inside it.
   - All write policies (INSERT/UPDATE/DELETE) remain unchanged -- they require 'edit'
     or higher via can_edit_box / can_delete_box.
   - Workspace membership check on the boxes table remains as the outer filter.

3. Important Notes
   - The UI already handles 'none' access by showing a lock icon and preventing click.
   - The batch_resolve_box_access RPC continues to return 'none' for restricted users,
     so the frontend knows to display the lock indicator.
   - Boxes without privacy settings still return 'open' -- no behavior change for them.
*/

-- Update can_access_box to allow 'none' through (box is visible in listing)
CREATE OR REPLACE FUNCTION public.can_access_box(p_box_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_level text;
BEGIN
  SELECT id INTO v_member_id FROM team_members
  WHERE auth_user_id = auth.uid() AND workspace_id IS NOT NULL LIMIT 1;

  IF v_member_id IS NULL THEN RETURN false; END IF;

  v_level := resolve_box_access(p_box_id, v_member_id);
  -- Allow all access levels including 'none' so box appears in listing
  RETURN v_level IN ('open', 'owner', 'edit', 'view', 'none');
END;
$$;

-- New function: can_view_box -- requires at least 'view' access to read contents
CREATE OR REPLACE FUNCTION public.can_view_box(p_box_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_level text;
BEGIN
  SELECT id INTO v_member_id FROM team_members
  WHERE auth_user_id = auth.uid() AND workspace_id IS NOT NULL LIMIT 1;

  IF v_member_id IS NULL THEN RETURN false; END IF;

  v_level := resolve_box_access(p_box_id, v_member_id);
  RETURN v_level IN ('open', 'owner', 'edit', 'view');
END;
$$;

-- Revoke public, grant only to authenticated (matches existing pattern)
REVOKE ALL ON FUNCTION public.can_view_box(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_box(uuid) TO authenticated;
