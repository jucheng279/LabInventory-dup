/*
# Add "preset" header type and header_preset_options table

1. Modified Tables
   - `slide_box_headers`: updated header_type CHECK constraint to allow 'preset'
   - `item_folder_headers`: updated header_type CHECK constraint to allow 'preset'

2. New Tables
   - `header_preset_options`
     - `id` (uuid, primary key) – unique option identifier
     - `header_id` (uuid, not null) – references a header in either slide_box_headers or item_folder_headers
     - `header_source` (text, not null) – either 'slide_box' or 'item_folder', identifies which header table the header_id belongs to
     - `option_label` (text, not null) – the display text for this preset option (e.g. "Yes", "No")
     - `display_order` (integer, default 0) – ordering of options within the header
     - `created_at` (timestamptz) – auto-set on creation

3. Security
   - RLS enabled on `header_preset_options`.
   - SELECT/INSERT/UPDATE/DELETE policies for authenticated users, scoped via workspace membership through the parent header tables.

4. Notes
   - The header_id is NOT a foreign key to a single table because it can reference either slide_box_headers or item_folder_headers, distinguished by header_source.
   - Preset options are plain text labels with no minimum count enforced at the database level.
   - The preset value chosen by the user is stored as regular text in the existing slide_cell_values / item_custom_values tables.
*/

-- 1. Update CHECK constraint on slide_box_headers to allow 'preset'
ALTER TABLE slide_box_headers DROP CONSTRAINT IF EXISTS slide_box_headers_header_type_check;
ALTER TABLE slide_box_headers ADD CONSTRAINT slide_box_headers_header_type_check
  CHECK (header_type = ANY (ARRAY['text'::text, 'date'::text, 'expiration'::text, 'preset'::text]));

-- 2. Update CHECK constraint on item_folder_headers to allow 'preset'
ALTER TABLE item_folder_headers DROP CONSTRAINT IF EXISTS item_folder_headers_header_type_check;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'item_folder_headers' AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%header_type%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE item_folder_headers DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'item_folder_headers' AND constraint_type = 'CHECK'
      AND constraint_name LIKE '%header_type%'
      LIMIT 1
    );
  END IF;
END $$;
ALTER TABLE item_folder_headers ADD CONSTRAINT item_folder_headers_header_type_check
  CHECK (header_type = ANY (ARRAY['text'::text, 'date'::text, 'expiration'::text, 'preset'::text]));

-- 3. Create the header_preset_options table
CREATE TABLE IF NOT EXISTS header_preset_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id uuid NOT NULL,
  header_source text NOT NULL,
  option_label text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT header_preset_options_source_check CHECK (header_source = ANY (ARRAY['slide_box'::text, 'item_folder'::text]))
);

CREATE INDEX IF NOT EXISTS idx_header_preset_options_header
  ON header_preset_options (header_id, header_source, display_order);

-- 4. Enable RLS
ALTER TABLE header_preset_options ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies – workspace-scoped through parent header tables

-- SELECT: user can read options if the header belongs to their workspace (via either header table)
DROP POLICY IF EXISTS "select_header_preset_options" ON header_preset_options;
CREATE POLICY "select_header_preset_options" ON header_preset_options FOR SELECT
TO authenticated
USING (
  (header_source = 'slide_box' AND EXISTS (
    SELECT 1 FROM slide_box_headers sbh
    JOIN boxes fb ON fb.id = sbh.box_id
    JOIN locations f ON f.id = fb.location_id
    WHERE sbh.id = header_preset_options.header_id
    AND f.workspace_id = get_user_workspace_id()
  ))
  OR
  (header_source = 'item_folder' AND EXISTS (
    SELECT 1 FROM item_folder_headers ifh
    JOIN item_folders ifo ON ifo.id = ifh.folder_id
    JOIN locations f ON f.id = ifo.location_id
    WHERE ifh.id = header_preset_options.header_id
    AND f.workspace_id = get_user_workspace_id()
  ))
);

-- INSERT
DROP POLICY IF EXISTS "insert_header_preset_options" ON header_preset_options;
CREATE POLICY "insert_header_preset_options" ON header_preset_options FOR INSERT
TO authenticated
WITH CHECK (
  (header_source = 'slide_box' AND EXISTS (
    SELECT 1 FROM slide_box_headers sbh
    JOIN boxes fb ON fb.id = sbh.box_id
    JOIN locations f ON f.id = fb.location_id
    WHERE sbh.id = header_preset_options.header_id
    AND f.workspace_id = get_user_workspace_id()
  ))
  OR
  (header_source = 'item_folder' AND EXISTS (
    SELECT 1 FROM item_folder_headers ifh
    JOIN item_folders ifo ON ifo.id = ifh.folder_id
    JOIN locations f ON f.id = ifo.location_id
    WHERE ifh.id = header_preset_options.header_id
    AND f.workspace_id = get_user_workspace_id()
  ))
);

-- UPDATE
DROP POLICY IF EXISTS "update_header_preset_options" ON header_preset_options;
CREATE POLICY "update_header_preset_options" ON header_preset_options FOR UPDATE
TO authenticated
USING (
  (header_source = 'slide_box' AND EXISTS (
    SELECT 1 FROM slide_box_headers sbh
    JOIN boxes fb ON fb.id = sbh.box_id
    JOIN locations f ON f.id = fb.location_id
    WHERE sbh.id = header_preset_options.header_id
    AND f.workspace_id = get_user_workspace_id()
  ))
  OR
  (header_source = 'item_folder' AND EXISTS (
    SELECT 1 FROM item_folder_headers ifh
    JOIN item_folders ifo ON ifo.id = ifh.folder_id
    JOIN locations f ON f.id = ifo.location_id
    WHERE ifh.id = header_preset_options.header_id
    AND f.workspace_id = get_user_workspace_id()
  ))
)
WITH CHECK (
  (header_source = 'slide_box' AND EXISTS (
    SELECT 1 FROM slide_box_headers sbh
    JOIN boxes fb ON fb.id = sbh.box_id
    JOIN locations f ON f.id = fb.location_id
    WHERE sbh.id = header_preset_options.header_id
    AND f.workspace_id = get_user_workspace_id()
  ))
  OR
  (header_source = 'item_folder' AND EXISTS (
    SELECT 1 FROM item_folder_headers ifh
    JOIN item_folders ifo ON ifo.id = ifh.folder_id
    JOIN locations f ON f.id = ifo.location_id
    WHERE ifh.id = header_preset_options.header_id
    AND f.workspace_id = get_user_workspace_id()
  ))
);

-- DELETE
DROP POLICY IF EXISTS "delete_header_preset_options" ON header_preset_options;
CREATE POLICY "delete_header_preset_options" ON header_preset_options FOR DELETE
TO authenticated
USING (
  (header_source = 'slide_box' AND EXISTS (
    SELECT 1 FROM slide_box_headers sbh
    JOIN boxes fb ON fb.id = sbh.box_id
    JOIN locations f ON f.id = fb.location_id
    WHERE sbh.id = header_preset_options.header_id
    AND f.workspace_id = get_user_workspace_id()
  ))
  OR
  (header_source = 'item_folder' AND EXISTS (
    SELECT 1 FROM item_folder_headers ifh
    JOIN item_folders ifo ON ifo.id = ifh.folder_id
    JOIN locations f ON f.id = ifo.location_id
    WHERE ifh.id = header_preset_options.header_id
    AND f.workspace_id = get_user_workspace_id()
  ))
);
