/*
# Enforce box privacy in RLS policies on boxes table

1. Security Changes
   - Replaces the workspace-only SELECT/UPDATE/DELETE policies on `boxes` with
     privacy-aware policies that also call the access helper functions.
   - SELECT: requires workspace membership AND at least view access (can_access_box).
   - UPDATE: requires workspace membership AND edit access (can_edit_box).
   - DELETE: requires workspace membership AND delete permission (can_delete_box).
   - INSERT: unchanged — creating a new box doesn't have privacy yet.

2. Important Notes
   - Boxes without privacy settings return 'open' from resolve_box_access, so all
     workspace members retain full access to unconfigured boxes.
   - This enforces what the UI already shows: restricted boxes are truly restricted.
   - The workspace check is kept as an outer filter for index efficiency.
*/

-- SELECT: workspace + privacy
DROP POLICY IF EXISTS "Workspace members can read fridge_boxes" ON boxes;
CREATE POLICY "Workspace members can read fridge_boxes"
  ON boxes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM locations
      WHERE locations.id = boxes.location_id
      AND locations.workspace_id = get_user_workspace_id()
    )
    AND can_access_box(id)
  );

-- UPDATE: workspace + edit access
DROP POLICY IF EXISTS "Workspace members can update fridge_boxes" ON boxes;
CREATE POLICY "Workspace members can update fridge_boxes"
  ON boxes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM locations
      WHERE locations.id = boxes.location_id
      AND locations.workspace_id = get_user_workspace_id()
    )
    AND can_edit_box(id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM locations
      WHERE locations.id = boxes.location_id
      AND locations.workspace_id = get_user_workspace_id()
    )
  );

-- DELETE: workspace + delete permission
DROP POLICY IF EXISTS "Workspace members can delete fridge_boxes" ON boxes;
CREATE POLICY "Workspace members can delete fridge_boxes"
  ON boxes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM locations
      WHERE locations.id = boxes.location_id
      AND locations.workspace_id = get_user_workspace_id()
    )
    AND can_delete_box(id)
  );
