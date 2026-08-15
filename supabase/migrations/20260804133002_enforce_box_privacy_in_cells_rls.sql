/*
# Enforce box privacy in RLS policies on cells table

1. Security Changes
   - Replaces workspace-only SELECT/UPDATE/DELETE/INSERT policies on `cells` with
     privacy-aware policies that check box access.
   - SELECT: workspace membership AND can_access_box(box_id).
   - INSERT: workspace membership AND can_edit_box(box_id).
   - UPDATE: workspace membership AND can_edit_box(box_id).
   - DELETE: workspace membership AND can_edit_box(box_id).

2. Important Notes
   - Cells inherit access from their parent box.
   - Boxes without privacy settings remain fully accessible.
*/

-- SELECT
DROP POLICY IF EXISTS "Workspace members can read fridge_cells" ON cells;
CREATE POLICY "Workspace members can read fridge_cells"
  ON cells FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boxes
      JOIN locations ON locations.id = boxes.location_id
      WHERE boxes.id = cells.box_id
      AND locations.workspace_id = get_user_workspace_id()
    )
    AND can_access_box(box_id)
  );

-- INSERT
DROP POLICY IF EXISTS "Workspace members can insert fridge_cells" ON cells;
CREATE POLICY "Workspace members can insert fridge_cells"
  ON cells FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boxes
      JOIN locations ON locations.id = boxes.location_id
      WHERE boxes.id = cells.box_id
      AND locations.workspace_id = get_user_workspace_id()
    )
    AND can_edit_box(box_id)
  );

-- UPDATE
DROP POLICY IF EXISTS "Workspace members can update fridge_cells" ON cells;
CREATE POLICY "Workspace members can update fridge_cells"
  ON cells FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boxes
      JOIN locations ON locations.id = boxes.location_id
      WHERE boxes.id = cells.box_id
      AND locations.workspace_id = get_user_workspace_id()
    )
    AND can_edit_box(box_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boxes
      JOIN locations ON locations.id = boxes.location_id
      WHERE boxes.id = cells.box_id
      AND locations.workspace_id = get_user_workspace_id()
    )
  );

-- DELETE
DROP POLICY IF EXISTS "Workspace members can delete fridge_cells" ON cells;
CREATE POLICY "Workspace members can delete fridge_cells"
  ON cells FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boxes
      JOIN locations ON locations.id = boxes.location_id
      WHERE boxes.id = cells.box_id
      AND locations.workspace_id = get_user_workspace_id()
    )
    AND can_edit_box(box_id)
  );
