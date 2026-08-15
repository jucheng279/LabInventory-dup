/*
# Fix infinite RLS recursion by making privacy helpers SECURITY DEFINER

1. Problem
   - The RLS policy on `boxes` calls `can_access_box(id)`, which calls
     `resolve_box_access(...)`, which queries the `boxes` table internally.
   - Since these functions are SECURITY INVOKER, their internal queries are
     subject to the same RLS policies, causing infinite recursion.
   - Same issue affects `projects` via `can_access_project` / `resolve_project_access`.

2. Fix
   - Convert all privacy helper functions and the resolve functions to
     SECURITY DEFINER with a fixed search_path.
   - This allows their internal queries to bypass RLS, breaking the recursion.
   - The functions already perform their own authorization logic (checking
     workspace membership + privacy settings), so this is safe.

3. Important Notes
   - No policy changes needed — only the function definitions change.
   - EXECUTE is already revoked from anon on these functions.
   - The fixed search_path prevents search_path injection attacks.
*/

-- resolve_box_access -> SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.resolve_box_access(p_box_id uuid, p_team_member_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
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

-- batch_resolve_box_access -> SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.batch_resolve_box_access(p_box_ids uuid[], p_team_member_id uuid)
 RETURNS TABLE(box_id uuid, access_level text)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bid uuid;
BEGIN
  FOREACH v_bid IN ARRAY p_box_ids LOOP
    box_id := v_bid;
    access_level := resolve_box_access(v_bid, p_team_member_id);
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- resolve_project_access -> SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.resolve_project_access(p_project_id uuid, p_team_member_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_workspace_owner_id uuid;
  v_privacy project_privacy_settings;
  v_access_level text;
BEGIN
  SELECT w.owner_id INTO v_workspace_owner_id
  FROM projects pr
  JOIN workspaces w ON w.id = pr.workspace_id
  WHERE pr.id = p_project_id;

  IF v_workspace_owner_id IS NOT NULL THEN
    IF p_team_member_id = v_workspace_owner_id THEN
      RETURN 'owner';
    END IF;
  END IF;

  SELECT * INTO v_privacy FROM project_privacy_settings WHERE project_id = p_project_id;

  IF NOT FOUND OR v_privacy.privacy_mode = 'open' THEN
    RETURN 'open';
  END IF;

  IF v_privacy.owner_id = p_team_member_id THEN
    RETURN 'owner';
  END IF;

  SELECT pal.access_level INTO v_access_level
  FROM project_access_list pal
  WHERE pal.project_id = p_project_id AND pal.team_member_id = p_team_member_id;

  IF FOUND THEN
    RETURN v_access_level;
  END IF;

  RETURN 'none';
END;
$function$;

-- batch_resolve_project_access -> SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.batch_resolve_project_access(p_project_ids uuid[], p_team_member_id uuid)
 RETURNS TABLE(project_id uuid, access_level text)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pid uuid;
BEGIN
  FOREACH v_pid IN ARRAY p_project_ids LOOP
    project_id := v_pid;
    access_level := resolve_project_access(v_pid, p_team_member_id);
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- can_access_box -> SECURITY DEFINER
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
  RETURN v_level IN ('open', 'owner', 'edit', 'view');
END;
$$;

-- can_edit_box -> SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.can_edit_box(p_box_id uuid)
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
  RETURN v_level IN ('open', 'owner', 'edit');
END;
$$;

-- can_delete_box -> SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.can_delete_box(p_box_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

  SELECT owner_only_delete INTO v_owner_only
  FROM box_privacy_settings WHERE box_id = p_box_id;

  IF v_owner_only IS TRUE AND v_level <> 'owner' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- can_access_project -> SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
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

  v_level := resolve_project_access(p_project_id, v_member_id);
  RETURN v_level IN ('open', 'owner', 'edit', 'view');
END;
$$;

-- can_edit_project -> SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.can_edit_project(p_project_id uuid)
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

  v_level := resolve_project_access(p_project_id, v_member_id);
  RETURN v_level IN ('open', 'owner', 'edit');
END;
$$;

-- can_delete_project -> SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.can_delete_project(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

-- Revoke anon from the newly-SECURITY DEFINER resolve functions
REVOKE EXECUTE ON FUNCTION public.resolve_box_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.batch_resolve_box_access(uuid[], uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_project_access(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.batch_resolve_project_access(uuid[], uuid) FROM anon;
