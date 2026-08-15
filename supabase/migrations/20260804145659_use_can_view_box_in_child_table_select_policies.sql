/*
# Replace can_access_box with can_view_box in child-table SELECT policies

1. Security Changes
   - Updates SELECT policies on cells, box_history, slide_box_headers,
     slide_cell_values, and box_grid_item_links to use can_view_box() instead
     of can_access_box().
   - This ensures users with 'none' access can see the box card in the listing
     but CANNOT read cells, history, slide headers, slide cell values, or item links.

2. Tables Affected
   - cells (SELECT)
   - box_history (SELECT)
   - slide_box_headers (SELECT)
   - slide_cell_values (SELECT)
   - box_grid_item_links (SELECT)

3. Important Notes
   - Write policies (INSERT/UPDATE/DELETE) are unchanged -- they use can_edit_box.
   - The workspace membership check remains as the outer filter for index efficiency.
*/

-- cells SELECT
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
    AND can_view_box(box_id)
  );

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
    AND can_view_box(box_id)
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
    AND can_view_box(box_id)
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
      WHERE fc2.id = slide_cell_values.cell_id AND can_view_box(fb2.id)
    )
  );

-- box_grid_item_links SELECT
DROP POLICY IF EXISTS "Workspace members can read box_grid_item_links" ON box_grid_item_links;
CREATE POLICY "Workspace members can read box_grid_item_links"
  ON box_grid_item_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boxes fb
      JOIN locations f ON f.id = fb.location_id
      WHERE fb.id = box_grid_item_links.box_id AND f.workspace_id = get_user_workspace_id()
    )
    AND can_view_box(box_id)
  );
