/*
# Add date fields to box_grid_item_links table

1. Modified Tables
   - `box_grid_item_links`
     - `linked_date` (text, nullable) — the date value the link was created with
     - `linked_date_type` (text, not null, default 'none') — 'date', 'expiration', or 'none'

2. Important Notes
   - Links now store date alongside name + info for three-field matching
   - Existing links default to linked_date_type='none' and linked_date=null (backward compatible)
   - The sync function will be updated separately to use these new fields
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'box_grid_item_links' AND column_name = 'linked_date'
  ) THEN
    ALTER TABLE box_grid_item_links ADD COLUMN linked_date text DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'box_grid_item_links' AND column_name = 'linked_date_type'
  ) THEN
    ALTER TABLE box_grid_item_links ADD COLUMN linked_date_type text NOT NULL DEFAULT 'none';
  END IF;
END $$;
