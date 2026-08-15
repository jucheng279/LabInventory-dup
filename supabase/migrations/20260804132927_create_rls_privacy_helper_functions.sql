/*
# Create RLS-optimized privacy helper functions for boxes and projects

1. New Functions
   - `can_access_box(p_box_id uuid)`: Returns true if the current user's team_member_id
     has at least 'view' access to the box (i.e. resolve_box_access returns anything
     other than 'none'). Used in SELECT/UPDATE/DELETE policies.
   - `can_edit_box(p_box_id uuid)`: Returns true if the user has 'edit', 'owner', or
     'open' access. Used in UPDATE/INSERT policies on child tables.
   - `can_delete_box(p_box_id uuid)`: Returns true if the user can delete. When
     owner_only_delete is set, only the box privacy owner or workspace owner can delete.
   - `can_access_project(p_project_id uuid)`: Same pattern for projects.
   - `can_edit_project(p_project_id uuid)`: Edit-level check for projects.
   - `can_delete_project(p_project_id uuid)`: Delete check for projects.

2. Security Changes
   - These functions use SECURITY INVOKER (default) so they run in the caller's context.
   - They are STABLE functions (no side effects) for query planner optimization.
   - Each resolves the caller's team_member_id from auth.uid() internally.

3. Important Notes
   - Boxes/projects without privacy settings return 'open' from the resolve functions,
     so all workspace members retain full access to unconfigured boxes/projects.
   - Workspace owners always get 'owner' access in the resolve functions.
   - This preserves current behavior: no one loses access to anything they could
     previously access through the UI. It only blocks direct API bypasses.
*/

-- Box access helper (SELECT + general visibility)
CREATE OR REPLACE FUNCTION public.can_access_box(p_box_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
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

-- Box edit helper (UPDATE/INSERT on box and child tables)
CREATE OR REPLACE FUNCTION public.can_edit_box(p_box_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
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
  RETURN v_level IN ('open', 'owner', 'edit');
END;
$$;

-- Box delete helper (respects owner_only_delete)
CREATE OR REPLACE FUNCTION public.can_delete_box(p_box_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_level text;
  v_owner_only boolean;
BEGIN
  SELECT id INTO v_member_id FROM team_members
  WHERE auth_user_id = auth.uid() AND workspace_id IS NOT NULL LIMIT 1;

  IF v_member_id IS NULL THEN RETURN false; END IF;

  v_level := resolve_box_access(p_box_id, v_member_id);

  IF v_level = 'none' OR v_level = 'view' THEN RETURN false; END IF;

  -- Check owner_only_delete
  SELECT owner_only_delete INTO v_owner_only
  FROM box_privacy_settings WHERE box_id = p_box_id;

  IF v_owner_only IS TRUE AND v_level <> 'owner' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Project access helper (SELECT + general visibility)
CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_level text;
BEGIN
  SELECT id INTO v_member_id FROM team_members
  WHERE auth_user_id = auth.uid() AND workspace_id IS NOT NULL LIMIT 1;

  IF v_member_id IS NULL THEN RETURN false; END IF;

  v_level := resolve_project_access(p_project_id, v_member_id);
  RETURN v_level IN ('open', 'owner', 'edit', 'view');
END;
$$;

-- Project edit helper
CREATE OR REPLACE FUNCTION public.can_edit_project(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_level text;
BEGIN
  SELECT id INTO v_member_id FROM team_members
  WHERE auth_user_id = auth.uid() AND workspace_id IS NOT NULL LIMIT 1;

  IF v_member_id IS NULL THEN RETURN false; END IF;

  v_level := resolve_project_access(p_project_id, v_member_id);
  RETURN v_level IN ('open', 'owner', 'edit');
END;
$$;

-- Project delete helper (respects owner_only_delete)
CREATE OR REPLACE FUNCTION public.can_delete_project(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_member_id uuid;
  v_level text;
  v_owner_only boolean;
BEGIN
  SELECT id INTO v_member_id FROM team_members
  WHERE auth_user_id = auth.uid() AND workspace_id IS NOT NULL LIMIT 1;

  IF v_member_id IS NULL THEN RETURN false; END IF;

  v_level := resolve_project_access(p_project_id, v_member_id);

  IF v_level = 'none' OR v_level = 'view' THEN RETURN false; END IF;

  SELECT owner_only_delete INTO v_owner_only
  FROM project_privacy_settings WHERE project_id = p_project_id;

  IF v_owner_only IS TRUE AND v_level <> 'owner' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;
