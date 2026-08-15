/*
# Create inventory_item_types table and add item_type_id to inventory_items

1. New Tables
   - inventory_item_types: user-defined item type categories with name, icon, and display order
2. Modified Tables
   - inventory_items: added nullable item_type_id FK to inventory_item_types (ON DELETE SET NULL)
3. Security
   - RLS enabled, workspace-scoped CRUD policies for authenticated users
4. Indexes
   - workspace_id on inventory_item_types, item_type_id on inventory_items
*/

CREATE TABLE IF NOT EXISTS inventory_item_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon_id text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_item_types_workspace
  ON inventory_item_types(workspace_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'item_type_id'
  ) THEN
    ALTER TABLE inventory_items
      ADD COLUMN item_type_id uuid REFERENCES inventory_item_types(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_items_item_type_id
  ON inventory_items(item_type_id);

ALTER TABLE inventory_item_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_inventory_item_types" ON inventory_item_types;
CREATE POLICY "select_inventory_item_types"
  ON inventory_item_types FOR SELECT TO authenticated
  USING (workspace_id = get_user_workspace_id());

DROP POLICY IF EXISTS "insert_inventory_item_types" ON inventory_item_types;
CREATE POLICY "insert_inventory_item_types"
  ON inventory_item_types FOR INSERT TO authenticated
  WITH CHECK (workspace_id = get_user_workspace_id());

DROP POLICY IF EXISTS "update_inventory_item_types" ON inventory_item_types;
CREATE POLICY "update_inventory_item_types"
  ON inventory_item_types FOR UPDATE TO authenticated
  USING (workspace_id = get_user_workspace_id())
  WITH CHECK (workspace_id = get_user_workspace_id());

DROP POLICY IF EXISTS "delete_inventory_item_types" ON inventory_item_types;
CREATE POLICY "delete_inventory_item_types"
  ON inventory_item_types FOR DELETE TO authenticated
  USING (workspace_id = get_user_workspace_id());