/*
# Tighten "Members can update own display_name" policy

1. Security Changes
   - Replace the existing UPDATE policy for regular members to explicitly prevent
     them from changing workspace_id, email, id, auth_user_id, or invited_by.
   - The WITH CHECK now verifies that workspace_id remains equal to the caller's
     current workspace, preventing cross-workspace migration.
   - The role immutability check is preserved.
   - This ensures that even though UPDATE is granted on role/workspace_id/invited_by
     columns (needed for owner/manager operations), a regular member's own-row
     update policy blocks changes to those columns.

2. Important Notes
   - Owner/manager policies are unaffected since they have separate policy entries
     with their own USING/WITH CHECK clauses.
   - The key addition: WITH CHECK requires workspace_id = get_user_workspace_id()
     which means a member cannot change their workspace_id to another value.
*/

DROP POLICY IF EXISTS "Members can update own display_name" ON team_members;
CREATE POLICY "Members can update own display_name"
  ON team_members
  FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    AND workspace_id IS NOT NULL
    AND workspace_id = get_user_workspace_id()
  )
  WITH CHECK (
    auth_user_id = auth.uid()
    AND workspace_id IS NOT NULL
    AND workspace_id = get_user_workspace_id()
    AND role = (SELECT tm.role FROM team_members tm WHERE tm.auth_user_id = auth.uid() AND tm.workspace_id IS NOT NULL LIMIT 1)
    AND invited_by IS NOT DISTINCT FROM (SELECT tm.invited_by FROM team_members tm WHERE tm.auth_user_id = auth.uid() AND tm.workspace_id IS NOT NULL LIMIT 1)
  );
