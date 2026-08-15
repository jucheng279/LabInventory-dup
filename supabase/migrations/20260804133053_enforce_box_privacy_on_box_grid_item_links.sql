/*
# Enforce box privacy on box_grid_item_links table

1. Security Changes
   - SELECT: adds can_access_box check
   - INSERT: adds can_edit_box check
   - UPDATE: adds can_edit_box check
   - DELETE: adds can_edit_box check

2. Important Notes
   - Preserves existing workspace membership checks.
   - Boxes without privacy settings remain fully accessible.
*/

-- SELECT
DROP POLICY IF EXISTS "Workspace members can view box item links" ON box_grid_item_links;
CREATE POLICY "Workspace members can view box item links"
  ON box_grid_item_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      JOIN team_members tm ON tm.workspace_id = f.workspace_id
      WHERE fb.id = box_grid_item_links.box_id
      AND tm.auth_user_id = auth.uid()
      AND tm.role IN ('owner', 'manager', 'member')
    )
    AND can_access_box(box_id)
  );

-- INSERT
DROP POLICY IF EXISTS "Workspace members can create box item links" ON box_grid_item_links;
CREATE POLICY "Workspace members can create box item links"
  ON box_grid_item_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      JOIN team_members tm ON tm.workspace_id = f.workspace_id
      WHERE fb.id = box_grid_item_links.box_id
      AND tm.auth_user_id = auth.uid()
      AND tm.role IN ('owner', 'manager', 'member')
    )
    AND can_edit_box(box_id)
  );

-- UPDATE
DROP POLICY IF EXISTS "Workspace members can update box item links" ON box_grid_item_links;
CREATE POLICY "Workspace members can update box item links"
  ON box_grid_item_links FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      JOIN team_members tm ON tm.workspace_id = f.workspace_id
      WHERE fb.id = box_grid_item_links.box_id
      AND tm.auth_user_id = auth.uid()
      AND tm.role IN ('owner', 'manager', 'member')
    )
    AND can_edit_box(box_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      JOIN team_members tm ON tm.workspace_id = f.workspace_id
      WHERE fb.id = box_grid_item_links.box_id
      AND tm.auth_user_id = auth.uid()
      AND tm.role IN ('owner', 'manager', 'member')
    )
  );

-- DELETE
DROP POLICY IF EXISTS "Workspace members can delete box item links" ON box_grid_item_links;
CREATE POLICY "Workspace members can delete box item links"
  ON box_grid_item_links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      JOIN team_members tm ON tm.workspace_id = f.workspace_id
      WHERE fb.id = box_grid_item_links.box_id
      AND tm.auth_user_id = auth.uid()
      AND tm.role IN ('owner', 'manager', 'member')
    )
    AND can_edit_box(box_id)
  );
