/*
# Enforce box privacy on box_history, slide_box_headers, slide_cell_values

1. Security Changes
   - box_history SELECT: adds can_access_box check
   - box_history INSERT/UPDATE: adds can_edit_box check
   - slide_box_headers SELECT: adds can_access_box check
   - slide_box_headers INSERT/UPDATE/DELETE: adds can_edit_box check
   - slide_cell_values SELECT: adds can_access_box via cell->box join
   - slide_cell_values INSERT/UPDATE/DELETE: adds can_edit_box via cell->box join

2. Important Notes
   - All existing workspace membership checks are preserved as the outer filter.
   - Only the privacy layer is added on top.
   - Boxes without privacy settings remain fully open.
*/

-- box_history SELECT
DROP POLICY IF EXISTS "Workspace members can read box_history" ON box_history;
CREATE POLICY "Workspace members can read box_history"
  ON box_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      WHERE fb.id = box_history.box_id AND f.workspace_id = get_user_workspace_id()
    )
    AND can_access_box(box_id)
  );

-- box_history INSERT
DROP POLICY IF EXISTS "Workspace members can insert box_history" ON box_history;
CREATE POLICY "Workspace members can insert box_history"
  ON box_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      WHERE fb.id = box_history.box_id AND f.workspace_id = get_user_workspace_id()
    )
    AND can_edit_box(box_id)
  );

-- box_history UPDATE
DROP POLICY IF EXISTS "Workspace members can update box_history" ON box_history;
CREATE POLICY "Workspace members can update box_history"
  ON box_history FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      WHERE fb.id = box_history.box_id AND f.workspace_id = get_user_workspace_id()
    )
    AND can_edit_box(box_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      WHERE fb.id = box_history.box_id AND f.workspace_id = get_user_workspace_id()
    )
  );

-- slide_box_headers SELECT
DROP POLICY IF EXISTS "Team members can read slide_box_headers" ON slide_box_headers;
CREATE POLICY "Team members can read slide_box_headers"
  ON slide_box_headers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      WHERE fb.id = slide_box_headers.box_id AND f.workspace_id = get_user_workspace_id()
    )
    AND can_access_box(box_id)
  );

-- slide_box_headers INSERT
DROP POLICY IF EXISTS "Team members can insert slide_box_headers" ON slide_box_headers;
CREATE POLICY "Team members can insert slide_box_headers"
  ON slide_box_headers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      WHERE fb.id = slide_box_headers.box_id AND f.workspace_id = get_user_workspace_id()
    )
    AND can_edit_box(box_id)
  );

-- slide_box_headers UPDATE
DROP POLICY IF EXISTS "Team members can update slide_box_headers" ON slide_box_headers;
CREATE POLICY "Team members can update slide_box_headers"
  ON slide_box_headers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      WHERE fb.id = slide_box_headers.box_id AND f.workspace_id = get_user_workspace_id()
    )
    AND can_edit_box(box_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      WHERE fb.id = slide_box_headers.box_id AND f.workspace_id = get_user_workspace_id()
    )
  );

-- slide_box_headers DELETE
DROP POLICY IF EXISTS "Team members can delete slide_box_headers" ON slide_box_headers;
CREATE POLICY "Team members can delete slide_box_headers"
  ON slide_box_headers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      WHERE fb.id = slide_box_headers.box_id AND f.workspace_id = get_user_workspace_id()
    )
    AND can_edit_box(box_id)
  );

-- slide_cell_values SELECT
DROP POLICY IF EXISTS "Team members can read slide_cell_values" ON slide_cell_values;
CREATE POLICY "Team members can read slide_cell_values"
  ON slide_cell_values FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cells fc
      JOIN boxes fb ON fb.id = fc.box_id
      JOIN locations f ON f.id = fb.location_id
      WHERE fc.id = slide_cell_values.cell_id AND f.workspace_id = get_user_workspace_id()
    )
    AND EXISTS (
      SELECT 1 FROM cells fc2
      JOIN boxes fb2 ON fb2.id = fc2.box_id
      WHERE fc2.id = slide_cell_values.cell_id AND can_access_box(fb2.id)
    )
  );

-- slide_cell_values INSERT
DROP POLICY IF EXISTS "Team members can insert slide_cell_values" ON slide_cell_values;
CREATE POLICY "Team members can insert slide_cell_values"
  ON slide_cell_values FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cells fc
      JOIN boxes fb ON fb.id = fc.box_id
      JOIN locations f ON f.id = fb.location_id
      WHERE fc.id = slide_cell_values.cell_id AND f.workspace_id = get_user_workspace_id()
    )
    AND EXISTS (
      SELECT 1 FROM cells fc2
      JOIN boxes fb2 ON fb2.id = fc2.box_id
      WHERE fc2.id = slide_cell_values.cell_id AND can_edit_box(fb2.id)
    )
  );

-- slide_cell_values UPDATE
DROP POLICY IF EXISTS "Team members can update slide_cell_values" ON slide_cell_values;
CREATE POLICY "Team members can update slide_cell_values"
  ON slide_cell_values FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cells fc
      JOIN boxes fb ON fb.id = fc.box_id
      JOIN locations f ON f.id = fb.location_id
      WHERE fc.id = slide_cell_values.cell_id AND f.workspace_id = get_user_workspace_id()
    )
    AND EXISTS (
      SELECT 1 FROM cells fc2
      JOIN boxes fb2 ON fb2.id = fc2.box_id
      WHERE fc2.id = slide_cell_values.cell_id AND can_edit_box(fb2.id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cells fc
      JOIN boxes fb ON fb.id = fc.box_id
      JOIN locations f ON f.id = fb.location_id
      WHERE fc.id = slide_cell_values.cell_id AND f.workspace_id = get_user_workspace_id()
    )
  );

-- slide_cell_values DELETE
DROP POLICY IF EXISTS "Team members can delete slide_cell_values" ON slide_cell_values;
CREATE POLICY "Team members can delete slide_cell_values"
  ON slide_cell_values FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cells fc
      JOIN boxes fb ON fb.id = fc.box_id
      JOIN locations f ON f.id = fb.location_id
      WHERE fc.id = slide_cell_values.cell_id AND f.workspace_id = get_user_workspace_id()
    )
    AND EXISTS (
      SELECT 1 FROM cells fc2
      JOIN boxes fb2 ON fb2.id = fc2.box_id
      WHERE fc2.id = slide_cell_values.cell_id AND can_edit_box(fb2.id)
    )
  );
