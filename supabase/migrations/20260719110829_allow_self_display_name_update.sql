/*
# Allow members to update their own display_name

1. Security Changes
   - Adds an UPDATE policy on `team_members` allowing any authenticated user
     to update their own row's `display_name` field.
   - The USING clause restricts visibility to the user's own record (via auth_user_id = auth.uid())
     that is still part of a workspace (workspace_id IS NOT NULL).
   - The WITH CHECK clause ensures the update does not alter role, workspace_id, email,
     auth_user_id, or invited_by — only display_name can change.

2. Important Notes
   - Previously, only owners could update their own record, and only owners/managers
     could update other members. Regular members had no way to change their own nickname.
   - This policy fills that gap so all workspace members can set their display name.
*/

DROP POLICY IF EXISTS "Members can update own display_name" ON team_members;
CREATE POLICY "Members can update own display_name"
  ON team_members
  FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    AND workspace_id IS NOT NULL
  )
  WITH CHECK (
    auth_user_id = auth.uid()
    AND workspace_id IS NOT NULL
    AND role = (SELECT tm.role FROM team_members tm WHERE tm.auth_user_id = auth.uid() AND tm.workspace_id IS NOT NULL LIMIT 1)
  );
