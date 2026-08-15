/*
# Add date fields to inventory_items table

1. Modified Tables
   - `inventory_items`
     - `date` (text, nullable) — stores date value as YYYY-MM-DD string, same as cell date
     - `date_type` (text, not null, default 'none') — one of 'date', 'expiration', 'none'

2. Important Notes
   - This aligns standalone items with the box grid cell structure (both now have name + info/note + date)
   - Existing items will default to date_type='none' and date=null (no date set)
   - No data loss — purely additive columns
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'date'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN date text DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'date_type'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN date_type text NOT NULL DEFAULT 'none';
  END IF;
END $$;
