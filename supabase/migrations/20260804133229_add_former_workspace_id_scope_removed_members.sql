/*
# Add former_workspace_id to team_members and scope removed-member policies

1. Schema Changes
   - Adds `former_workspace_id` (uuid, nullable) column to `team_members`.
   - This column is populated when a member is soft-deleted (workspace_id set to NULL).
   - It allows the "view removed members" and "restore" policies to be properly scoped.

2. Security Changes
   - Updates the soft-delete policies (manager + owner) to automatically record
     the current workspace_id into former_workspace_id via WITH CHECK.
   - Updates the "Owners and managers can view removed members" policy to only show
     removed members whose former_workspace_id matches the viewer's workspace.
   - Updates the restore policies to only allow restoring members from the caller's
     own workspace's removed members.

3. Important Notes
   - Existing removed records (former_workspace_id is NULL) will only be visible to
     the workspace that created them if we backfill. Since we cannot know which workspace
     they belonged to, we add a fallback: records with NULL former_workspace_id are
     visible to no one via the policy until restored manually by a superadmin if needed.
     This is intentionally restrictive to prevent cross-workspace data leaks.
   - The column is added to the UPDATE grant for authenticated users since the
     soft-delete policies need to write it.
*/

-- Add the column
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS former_workspace_id uuid;

-- Add to the column-level UPDATE grant (alongside existing granted columns)
GRANT UPDATE (former_workspace_id) ON public.team_members TO authenticated;

-- Update: "Managers can soft delete members from workspace" — record former_workspace_id
DROP POLICY IF EXISTS "Managers can soft delete members from workspace" ON team_members;
CREATE POLICY "Managers can soft delete members from workspace"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    is_owner_or_manager()
    AND NOT is_owner()
    AND role = 'member'
    AND workspace_id = get_user_workspace_id()
  )
  WITH CHECK (
    workspace_id IS NULL
    AND role IS NULL
    AND invited_by IS NULL
    AND former_workspace_id = get_user_workspace_id()
  );

-- Update: "Owner can update or soft delete workspace members" — record former_workspace_id
DROP POLICY IF EXISTS "Owner can update or soft delete workspace members" ON team_members;
CREATE POLICY "Owner can update or soft delete workspace members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    is_owner()
    AND workspace_id = get_user_workspace_id()
    AND auth_user_id IS DISTINCT FROM auth.uid()
  )
  WITH CHECK (
    is_owner()
    AND (
      (workspace_id = get_user_workspace_id())
      OR (workspace_id IS NULL AND role IS NULL AND invited_by IS NULL AND former_workspace_id = get_user_workspace_id())
    )
  );

-- Update: "Owners and managers can view removed members" — scope to own workspace
DROP POLICY IF EXISTS "Owners and managers can view removed members" ON team_members;
CREATE POLICY "Owners and managers can view removed members"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    is_owner_or_manager()
    AND workspace_id IS NULL
    AND role IS NULL
    AND former_workspace_id = get_user_workspace_id()
  );

-- Update: "Owner can restore removed members to workspace" — scope to own workspace
DROP POLICY IF EXISTS "Owner can restore removed members to workspace" ON team_members;
CREATE POLICY "Owner can restore removed members to workspace"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    is_owner()
    AND workspace_id IS NULL
    AND role IS NULL
    AND former_workspace_id = get_user_workspace_id()
  )
  WITH CHECK (
    is_owner()
    AND workspace_id = get_user_workspace_id()
    AND role IN ('manager', 'member')
  );

-- Update: "Managers can restore removed members as members" — scope to own workspace
DROP POLICY IF EXISTS "Managers can restore removed members as members" ON team_members;
CREATE POLICY "Managers can restore removed members as members"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    is_owner_or_manager()
    AND NOT is_owner()
    AND workspace_id IS NULL
    AND role IS NULL
    AND former_workspace_id = get_user_workspace_id()
  )
  WITH CHECK (
    is_owner_or_manager()
    AND NOT is_owner()
    AND workspace_id = get_user_workspace_id()
    AND role = 'member'
  );
