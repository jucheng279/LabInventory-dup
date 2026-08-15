/*
# Add item_info column and composite key to expiration_subscriptions

1. Modified Tables
   - `expiration_subscriptions`
     - Added `item_info` (text, default '') — stores the information/note text
       of the subscribed item so subscriptions are matched by name+info+date
       instead of a fixed source_id.

2. Index Changes
   - Dropped old unique index `idx_expiration_subscriptions_unique` on (team_member_id, source_id).
   - Created new unique index `idx_expiration_subscriptions_composite` on
     (team_member_id, item_name, COALESCE(item_info,''), expiration_date).
   - This makes subscriptions identified by what the item looks like rather than
     a specific database record ID, mirroring the grid-link matching logic.

3. Notes
   - Existing rows get item_info defaulted to ''.
   - source and source_id columns are kept (no data loss) but are no longer the
     primary subscription identifier.
*/

-- Add the item_info column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expiration_subscriptions' AND column_name = 'item_info'
  ) THEN
    ALTER TABLE expiration_subscriptions ADD COLUMN item_info text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Drop old unique index
DROP INDEX IF EXISTS idx_expiration_subscriptions_unique;

-- Create new composite unique constraint (plain columns for upsert compatibility)
DO $block$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expiration_subscriptions_composite_key'
  ) THEN
    ALTER TABLE expiration_subscriptions
      ADD CONSTRAINT expiration_subscriptions_composite_key
      UNIQUE (team_member_id, item_name, item_info, expiration_date);
  END IF;
END $block$;
