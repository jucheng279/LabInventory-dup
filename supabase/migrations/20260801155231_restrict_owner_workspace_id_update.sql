-- F8: an owner could set team_members.workspace_id to ANY workspace id and gain
-- full access to that tenant. Constrain the target workspace to one they own.
CREATE OR REPLACE FUNCTION public.workspace_is_owned_by_member(p_workspace_id uuid, p_member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = p_workspace_id AND w.owner_id = p_member_id
  );
$$;

REVOKE ALL ON FUNCTION public.workspace_is_owned_by_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.workspace_is_owned_by_member(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.workspace_is_owned_by_member(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Owners can update their own workspace_id" ON public.team_members;

CREATE POLICY "Owners can update their own workspace_id"
  ON public.team_members
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid() AND role = 'owner')
  WITH CHECK (
    auth_user_id = auth.uid()
    AND role = 'owner'
    AND (
      workspace_id IS NULL
      OR public.workspace_is_owned_by_member(workspace_id, id)
    )
  );
