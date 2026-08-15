/*
# Add batch_id column and revert/redo action types to box_history

1. Modified Tables
   - `box_history`
     - Added `batch_id` (uuid, nullable) - Groups multiple history entries that belong
       to the same logical operation (e.g., a multi-step revert creates one batch).
     - Updated `action_type` check constraint to include 'revert' and 'redo' as valid types.

2. Indexes
   - Added index on `batch_id` for efficient grouping queries.

3. Important Notes
   - 'undo' = single-step undo of one action
   - 'revert' = part of a multi-step revert operation (grouped by batch_id)
   - 'redo' = re-applies an undone/reverted action
   - batch_id is NULL for standalone undo/redo operations
   - batch_id is set to a shared UUID for all entries in a multi-step revert
*/

-- Add batch_id column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'box_history' AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE box_history ADD COLUMN batch_id uuid DEFAULT NULL;
  END IF;
END $$;

-- Update the action_type check constraint to include 'revert' and 'redo'
ALTER TABLE box_history DROP CONSTRAINT IF EXISTS box_history_action_type_check;
ALTER TABLE box_history ADD CONSTRAINT box_history_action_type_check
  CHECK (action_type = ANY (ARRAY['edit'::text, 'cross'::text, 'clear'::text, 'cut'::text, 'copy'::text, 'move'::text, 'swap'::text, 'undo'::text, 'revert'::text, 'redo'::text]));

-- Index for batch grouping
CREATE INDEX IF NOT EXISTS idx_box_history_batch_id ON box_history (batch_id) WHERE batch_id IS NOT NULL;
