/*
# Enforce project privacy in RLS policies on projects table

1. Security Changes
   - SELECT: workspace membership AND at least view access (can_access_project).
   - UPDATE: workspace membership AND edit access (can_edit_project).
   - DELETE: workspace membership AND delete permission (can_delete_project).
   - INSERT: unchanged — creating a new project has no privacy yet.

2. Important Notes
   - Projects without privacy settings return 'open', so all workspace members
     retain full access to unconfigured projects.
   - This matches the UI's behavior: restricted projects are truly restricted.
*/

-- SELECT
DROP POLICY IF EXISTS "select_projects" ON projects;
CREATE POLICY "select_projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    workspace_id = get_user_workspace_id()
    AND can_access_project(id)
  );

-- UPDATE
DROP POLICY IF EXISTS "update_projects" ON projects;
CREATE POLICY "update_projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    workspace_id = get_user_workspace_id()
    AND can_edit_project(id)
  )
  WITH CHECK (
    workspace_id = get_user_workspace_id()
  );

-- DELETE
DROP POLICY IF EXISTS "delete_projects" ON projects;
CREATE POLICY "delete_projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    workspace_id = get_user_workspace_id()
    AND can_delete_project(id)
  );
