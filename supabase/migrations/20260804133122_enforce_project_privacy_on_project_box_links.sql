/*
# Enforce project privacy on project_box_links table

1. Security Changes
   - SELECT: workspace + can_access_project check
   - INSERT: workspace + can_edit_project check
   - UPDATE: workspace + can_edit_project check
   - DELETE: workspace + can_edit_project check

2. Important Notes
   - project_box_links inherit access from their parent project.
   - Projects without privacy settings remain fully accessible.
*/

-- SELECT
DROP POLICY IF EXISTS "select_project_box_links" ON project_box_links;
CREATE POLICY "select_project_box_links"
  ON project_box_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_box_links.project_id AND p.workspace_id = get_user_workspace_id()
    )
    AND can_access_project(project_id)
  );

-- INSERT
DROP POLICY IF EXISTS "insert_project_box_links" ON project_box_links;
CREATE POLICY "insert_project_box_links"
  ON project_box_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_box_links.project_id AND p.workspace_id = get_user_workspace_id()
    )
    AND can_edit_project(project_id)
  );

-- UPDATE
DROP POLICY IF EXISTS "update_project_box_links" ON project_box_links;
CREATE POLICY "update_project_box_links"
  ON project_box_links FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_box_links.project_id AND p.workspace_id = get_user_workspace_id()
    )
    AND can_edit_project(project_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_box_links.project_id AND p.workspace_id = get_user_workspace_id()
    )
  );

-- DELETE
DROP POLICY IF EXISTS "delete_project_box_links" ON project_box_links;
CREATE POLICY "delete_project_box_links"
  ON project_box_links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_box_links.project_id AND p.workspace_id = get_user_workspace_id()
    )
    AND can_edit_project(project_id)
  );
